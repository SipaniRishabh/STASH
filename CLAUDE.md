# Job Agent

Personal job-hunt agent for Rishabh. Claude Code is the agent loop; `scripts/` do the deterministic work.
Python: always `.venv/bin/python`.

## Workflow (slash commands)
- `/onboard` – build/refresh `profile.json` + `resumes/base.json` from the resume PDF
- `/search` – fetch fresh jobs, filter, score, shortlist
- `/jd` – user pastes a JD (LinkedIn, Naukri, anywhere); same scoring + tailoring flow
- `/tailor <slug>` – tailored resume draft for one job, then user review
- `/apply <slug>` – assisted apply + log to Google Sheet

## Files
- `profile.json` – who the user is + preferences (source of truth for filtering/scoring)
- `resumes/base.json` – factual resume content. **Only source of facts** for any rewrite.
- `resumes/tailored/<slug>.json|.docx|.pdf` – per-job versions
- `data/jobs.json` – last fetch (raw, filtered); `data/shortlist.json` – scored jobs; `data/jds/<slug>.txt` – JD text
- `companies.json` – Greenhouse/Lever/Ashby boards to poll (add more anytime)
- `config.json` + `credentials/` – Google Sheet id + service account key (never print or commit)

Slug format: `company-role` lowercase, hyphens (e.g. `groww-senior-product-manager`).

## Hard rules
1. **Freshness**: never shortlist a job posted > 60 days ago. Pasted JD with unknown or old date: warn, let user decide.
2. **Location**: job in India = any work mode OK. Job outside India = must be remote AND open to candidates in India
   (worldwide, APAC, India, or contractor/EOR). "Remote – US only", needs US/EU work authorization, or overlaps only US timezones strictly = drop.
   Unclear = keep, mark `eligibility: "verify"`.
3. **No fabrication**: tailored resume may reorder, cut, rephrase and re-emphasize what is in `base.json`. Never add a skill, tool,
   metric, title, employer, or claim that is not there. If the JD wants something the user lacks, say so in the gap list. Don't paper over it.
4. **Human review**: never mark anything applied, and never submit anything, without the user's explicit OK.
5. **Never write** Status / Next action / Notes in the sheet. User owns them. Agent only appends rows.

## Scoring (per job)
Match score 0–100, weighted. Every part cites evidence (JD phrase ↔ resume line):
- Must-have requirements met: 35
- Seniority / years fit (user: 6+ yrs, PM since 2022, APM before): 20
- Domain fit (AI/LLM products, B2C, consumer subscription, e-commerce, enterprise SaaS): 20
- Skills / tools overlap: 15
- Location + eligibility fit: 10

Interview confidence: Low / Medium / High plus a %. Start from match, then adjust:
- missing a hard must-have: cap at Low
- posted > 30 days: −10; > 45 days: −20
- seniority gap ≥ 2 levels either way: −15
- eligibility "verify": −10
- referral available (ask user): +15
State it is an estimate. Give the top 2 reasons.

Output per job: `match`, `confidence`, `confidence_pct`, `why` (2–3 bullets), `gaps`, `must_have_keywords` (exact JD wording, 8–15 terms).

## Resume writing rules (human, not AI)
- Keep the user's own phrasing where it already works. Change emphasis and order before changing words.
- Concrete nouns and numbers. Each bullet: what was done + the result. One to two lines.
- Mirror the JD's exact terms where they are true for the user ("stakeholder management", not a synonym).
- Vary opening verbs; no verb more than twice across the resume.
- No banned words, no em/en dashes, no rule-of-three padding, no grand framing ("in a fast-paced environment").
  `scripts/resume.py check` enforces this. Fix every flag by rewriting, not by synonym-swapping one buzzword for another.
- Summary: 2–3 plain sentences, no adjectives about the user's character.

## ATS format (enforced by `scripts/resume.py build`)
Single column .docx (+ PDF), no tables/text boxes/images/icons, contact info in body, standard headings
(Summary, Experience, Education, Skills, Certifications), MM/YYYY dates.

## PRD
`PRD.md` is the living product spec. Update it (feature table + Changelog) in the same change as any product-behaviour change.
