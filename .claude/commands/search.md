Find and score fresh jobs. Follow CLAUDE.md (freshness, location, scoring rules).

1. Run `.venv/bin/python scripts/fetch_jobs.py`. It writes `data/jobs.json` (already filtered for title, <= 60 days, India or remote, sorted by keyword prescore).
2. Drop any whose URL is already tracked: `.venv/bin/python scripts/tracker.py list` once, compare URLs (skip if sheet not set up yet).
3. Take the top $ARGUMENTS jobs (default 25). For each remote job outside India, judge eligibility from location + description
   (worldwide / India-or-APAC OK / US-or-EU-only = drop / unclear = "verify"). Respect `profile.preferences` deal-breakers.
4. Score each remaining job with the CLAUDE.md rubric. Save to `data/shortlist.json` as a list of
   `{slug, company, title, location, eligibility, posted, age_days, url, source, match, confidence, confidence_pct, why, gaps, must_have_keywords}`,
   merging with existing entries by slug. Save each JD text to `data/jds/<slug>.txt`.
5. Show a compact table sorted by match: #, company, role, location/eligibility, age, match, confidence. Below it, top 3 with their `why`.
6. Ask which ones to tailor for (then run the /tailor flow for each pick).
