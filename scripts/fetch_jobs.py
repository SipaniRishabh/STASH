"""Fetch PM jobs from public boards, keep fresh + location-eligible ones, write data/jobs.json.

Sources: Greenhouse / Lever / Ashby boards in companies.json, Himalayas (remote, open to India), Remotive.
Filters: title (profile.title_include/exclude), age <= profile.max_age_days, India-located OR remote.
Final eligibility for remote jobs (worldwide vs US-only) is judged by Claude in /search; `eligibility_hint` helps.

Usage: .venv/bin/python scripts/fetch_jobs.py
"""
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROFILE = json.loads((ROOT / "profile.json").read_text())
COMPANIES = json.loads((ROOT / "companies.json").read_text())
NOW = datetime.now(timezone.utc)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "personal-job-agent/0.1"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def text(s):
    s = re.sub(r"<[^>]+>", " ", html.unescape(s or ""))
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def iso(dt):
    return dt.astimezone(timezone.utc).isoformat() if dt else None


def job(source, company, title, location, remote, posted, url, desc, hint=""):
    return {"source": source, "company": company, "title": title.strip(), "location": location or "",
            "remote": remote, "posted": iso(posted), "url": url, "eligibility_hint": hint,
            "description": text(desc)[:6000]}


def greenhouse(token):
    out = []
    for j in get(f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true")["jobs"]:
        loc = (j.get("location") or {}).get("name", "")
        meta = " ".join(str(m.get("value")) for m in j.get("metadata") or [])
        posted = j.get("first_published") or j.get("updated_at")
        out.append(job("greenhouse", j.get("company_name") or token, j["title"], loc,
                       "remote" in (loc + meta).lower(), datetime.fromisoformat(posted), j["absolute_url"], j.get("content")))
    return out


def lever(token):
    out = []
    for j in get(f"https://api.lever.co/v0/postings/{token}?mode=json"):
        cats = j.get("categories") or {}
        loc = ", ".join(cats.get("allLocations") or [cats.get("location") or ""])
        posted = datetime.fromtimestamp(j["createdAt"] / 1000, timezone.utc)
        out.append(job("lever", token, j["text"], loc, j.get("workplaceType") == "remote", posted,
                       j["hostedUrl"], j.get("descriptionPlain", "") + " " + j.get("additionalPlain", "")))
    return out


def ashby(token):
    out = []
    for j in get(f"https://api.ashbyhq.com/posting-api/job-board/{token}")["jobs"]:
        locs = [j.get("location", "")] + [s.get("location", "") for s in j.get("secondaryLocations") or []]
        remote = j.get("isRemote") or j.get("workplaceType") == "Remote"
        out.append(job("ashby", token, j["title"], " | ".join(filter(None, locs)), bool(remote),
                       datetime.fromisoformat(j["publishedAt"]), j["jobUrl"], j.get("descriptionHtml")))
    return out


def himalayas(title):
    out = []
    for page in (1, 2, 3):
        q = urllib.parse.urlencode({"q": title, "country": "India", "page": page})
        jobs = get(f"https://himalayas.app/jobs/api/search?{q}").get("jobs", [])
        for j in jobs:
            restr = j.get("locationRestrictions") or []
            out.append(job("himalayas", j["companyName"], j["title"], ", ".join(restr) or "Worldwide", True,
                           datetime.fromtimestamp(int(j["pubDate"]), timezone.utc), j["applicationLink"],
                           j.get("description"), hint=f"open to: {', '.join(restr) or 'worldwide'}"))
        if len(jobs) < 20:
            break
    return out


def remotive(_):
    out = []
    for j in get("https://remotive.com/api/remote-jobs?search=product%20manager")["jobs"]:
        posted = datetime.fromisoformat(j["publication_date"]).replace(tzinfo=timezone.utc)
        out.append(job("remotive", j["company_name"], j["title"], j.get("candidate_required_location", ""), True,
                       posted, j["url"], j.get("description"), hint=f"open to: {j.get('candidate_required_location')}"))
    return out


def keep(j):
    t = j["title"].lower()
    if not any(w in t for w in PROFILE["title_include"]) or any(w in t for w in PROFILE["title_exclude"]):
        return False
    if not j["posted"] or (NOW - datetime.fromisoformat(j["posted"])).days > PROFILE["max_age_days"]:
        return False
    loc = j["location"].lower()
    in_india = any(c in loc for c in PROFILE["india_locations"])
    us_only = re.search(r"\b(usa|us-remote|us - remote|united states|, ca|, ny|, wa)\b", loc)
    return in_india or (j["remote"] and not us_only)


def prescore(j):
    # ponytail: keyword hit count, only used to order jobs before Claude's real scoring
    d = (j["title"] + " " + j["description"]).lower()
    return sum(1 for k in PROFILE["keywords"] if re.search(rf"\b{re.escape(k)}\b", d))


def main():
    tasks = [(greenhouse, c) for c in COMPANIES.get("greenhouse", [])]
    tasks += [(lever, c) for c in COMPANIES.get("lever", [])]
    tasks += [(ashby, c) for c in COMPANIES.get("ashby", [])]
    tasks += [(himalayas, "product manager"), (himalayas, "senior product manager"), (remotive, None)]

    def run(t):
        fn, arg = t
        try:
            return fn(arg)
        except Exception as e:
            print(f"  skip {fn.__name__}:{arg} ({e})", file=sys.stderr)
            return []

    with ThreadPoolExecutor(8) as ex:
        raw = [j for batch in ex.map(run, tasks) for j in batch]

    seen, jobs = set(), []
    for j in raw:
        key = (j["company"].lower(), j["title"].lower())
        if keep(j) and j["url"] not in seen and key not in seen:
            seen |= {j["url"], key}
            j["age_days"] = (NOW - datetime.fromisoformat(j["posted"])).days
            j["prescore"] = prescore(j)
            jobs.append(j)
    jobs.sort(key=lambda j: (-j["prescore"], j["age_days"]))

    (ROOT / "data" / "jobs.json").write_text(json.dumps(jobs, indent=1, ensure_ascii=False))
    print(f"fetched {len(raw)} postings, kept {len(jobs)} (fresh <= {PROFILE['max_age_days']}d, PM titles, India or remote)")
    for j in jobs[:40]:
        print(f"  [{j['prescore']:>2}] {j['age_days']:>2}d  {j['company']} | {j['title']} | {j['location'][:50]}")


if __name__ == "__main__":
    main()
