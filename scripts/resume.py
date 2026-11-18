"""Resume tooling: lint for AI-slop, build an ATS-safe .docx (+ PDF), verify it parses back cleanly.

Usage:
  .venv/bin/python scripts/resume.py check resumes/tailored/<slug>.json
  .venv/bin/python scripts/resume.py build resumes/tailored/<slug>.json [--keywords "a,b,c"] [--no-pdf]
build refuses to write if check finds issues.
"""
import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt

BANNED = [
    "spearhead", "leverag", "robust", "seamless", "dynamic", "passionate", "results-driven", "results driven",
    "cutting-edge", "cutting edge", "synergy", "synergies", "delve", "proven track record", "utiliz", "innovative",
    "best-in-class", "world-class", "game-changer", "game changing", "fast-paced", "detail-oriented", "go-getter",
    "self-starter", "thought leader", "visionary", "orchestrat", "revolutioniz", "transformative", "empower",
    "holistic", "paradigm", "unlock", "elevat", "foster", "harness", "navigat", "landscape", "tapestry",
    "meticulous", "pivotal", "instrumental in", "adept at", "in today's", "ever-evolving", "a testament to",
    "strategic thinker", "excellent communication", "team player", "hands-on experience", "wide range of",
]
HEADINGS = ["SUMMARY", "EXPERIENCE", "EDUCATION", "SKILLS", "CERTIFICATIONS"]


def lines(r):
    yield "summary", r["summary"]
    for e in r["experience"]:
        for i, b in enumerate(e["bullets"]):
            yield f"{e['company']} bullet {i + 1}", b


def check(r):
    issues = []
    openers = Counter()
    for where, s in lines(r):
        low = s.lower()
        for w in BANNED:
            if w in low:
                issues.append(f"{where}: banned word '{w}'")
        if re.search(r"[—–]", s):
            issues.append(f"{where}: em/en dash")
        if re.search(r"[^\x00-\x7Fé₹]", s):
            issues.append(f"{where}: non-ASCII char (icons/zero-width break ATS parsing)")
        if where != "summary":
            openers[s.split()[0].lower()] += 1
            if len(s) > 230:
                issues.append(f"{where}: too long ({len(s)} chars, keep <= 230)")
            if not re.search(r"\d", s):
                issues.append(f"{where}: no number or concrete result")
    issues += [f"opening verb '{v}' used {n}x (max 2)" for v, n in openers.items() if n > 2]
    return issues


def para(doc, text="", bold=False, size=10, align=None, space_after=1, style=None):
    p = doc.add_paragraph(style=style)
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.space_before = Pt(0)
    if align:
        p.alignment = align
    run = p.add_run(text)
    run.bold, run.font.size = bold, Pt(size)
    return p


def heading(doc, text):
    para(doc, text, bold=True, size=11, space_after=2).paragraph_format.space_before = Pt(6)


def build_docx(r, path):
    # Compact one-page design: work history before skills/projects (user preference, see PRD).
    doc = Document()
    for s in doc.sections:
        s.top_margin = s.bottom_margin = Inches(0.45)
        s.left_margin = s.right_margin = Inches(0.55)
    normal = doc.styles["Normal"]
    normal.font.name, normal.font.size = "Calibri", Pt(10)
    normal.paragraph_format.line_spacing = 1.0

    c = r["contact"]
    para(doc, r["name"], bold=True, size=15, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    if r.get("headline"):
        para(doc, r["headline"], size=10.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=0)
    para(doc, " | ".join(filter(None, [c.get("email"), c.get("phone"), c.get("location"), c.get("linkedin")])),
         size=9.5, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)

    heading(doc, "SUMMARY")
    para(doc, r["summary"])

    heading(doc, "EXPERIENCE")
    for e in r["experience"]:
        p = para(doc, f"{e['title']}, {e['company']}", bold=True, space_after=0)
        p.paragraph_format.space_before = Pt(3)
        p.add_run(f"  |  {e['location']}  |  {e['dates']}").bold = False
        if e.get("blurb"):
            para(doc, e["blurb"], size=9.5, space_after=0).runs[0].italic = True
        for b in e["bullets"]:
            para(doc, b, style="List Bullet", space_after=0)

    heading(doc, "EDUCATION")
    for ed in r["education"]:
        para(doc, f"{ed['degree']}, {ed['school']} | {ed['dates']}")

    heading(doc, "SKILLS")
    for s in r["skills"]:
        p = para(doc, f"{s['label']}: ", bold=True, space_after=1)
        p.add_run(", ".join(s["items"])).font.size = Pt(10)

    if r.get("certifications"):
        heading(doc, "CERTIFICATIONS")
        for cert in r["certifications"]:
            para(doc, cert)
    doc.save(path)


def verify(path, r, keywords):
    """Parse the docx back like an ATS would: plain text, in order."""
    txt = "\n".join(p.text for p in Document(path).paragraphs)
    problems = []
    pos = [txt.find(h) for h in HEADINGS if h in txt or h != "CERTIFICATIONS"]
    if -1 in pos or pos != sorted(pos):
        problems.append("headings missing or out of order")
    if r["contact"]["email"] not in txt:
        problems.append("email not in body text")
    if Document(path).tables:
        problems.append("contains tables")
    report = {"problems": problems}
    if keywords:
        low = txt.lower()
        hit = [k for k in keywords if k.lower() in low]
        report["keyword_coverage"] = f"{len(hit)}/{len(keywords)}"
        report["missing_keywords"] = [k for k in keywords if k not in hit]
    return report


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["check", "build"])
    ap.add_argument("json_path")
    ap.add_argument("--keywords", default="")
    ap.add_argument("--no-pdf", action="store_true")
    a = ap.parse_args()

    src = Path(a.json_path)
    r = json.loads(src.read_text())
    issues = check(r)
    if issues:
        print("SLOP/FORMAT ISSUES (rewrite these, then re-run):")
        print("\n".join(f"  - {i}" for i in issues))
        sys.exit(1)
    print("check: clean")
    if a.cmd == "check":
        return

    out = src.with_suffix(".docx")
    build_docx(r, out)
    report = verify(out, r, [k.strip() for k in a.keywords.split(",") if k.strip()])
    if not a.no_pdf:
        subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(out.parent), str(out)],
                       check=False, capture_output=True)
        pdf = out.with_suffix(".pdf")
        report["pdf"] = str(pdf) if pdf.exists() else "failed"
        if pdf.exists():
            info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
            pages = int(re.search(r"Pages:\s+(\d+)", info).group(1)) if "Pages:" in info else 0
            report["pages"] = pages
            if pages > 1:
                report["problems"].append(f"{pages} pages: cut weakest bullets until it fits one page")
    report["docx"] = str(out)
    print(json.dumps(report, indent=1))
    sys.exit(1 if report["problems"] else 0)


if __name__ == "__main__":
    main()
