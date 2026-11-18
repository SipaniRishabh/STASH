# Jobber: PRD

Living document. Update it in the same change as any feature that changes product behaviour, and add a line to the Changelog.

- **Owner:** Rishabh Sipani
- **Status:** v1 in design (clickable prototype at `web/prototype/`)
- **Last updated:** 2026-11-18

---

## 1. Problem

Job seekers spend hours each week on low-value work: scrolling stale listings, guessing whether they qualify,
rewriting the same resume for every role, and losing track of where each application stands. The AI tools that
help often make it worse. They pad resumes with buzzwords and invented skills, and they produce
generic text that recruiters now spot instantly.

## 2. Who it is for

- **v0 (built):** Rishabh only, as a Claude Code project (`/onboard`, `/search`, `/jd`, `/tailor`, `/apply`).
- **v1 (this PRD):** individual job seekers, starting with product managers in India applying to India-based roles
  and global remote roles. Public web app, each user brings their own Claude API key.

## 3. Goals and metrics

| Type | Metric | v1 target |
|---|---|---|
| North star | Applications that reach an interview call | Tracked in-app; baseline in first 30 days |
| Quality | Tailored resumes approved without edits | ≥ 60% |
| Trust | Fabricated claims in tailored resumes | 0 (hard rule) |
| Efficiency | Time from "found a job" to "ready to submit" | ≤ 10 minutes |
| Portfolio | Visitors who finish the demo flow | ≥ 40% of landing visitors |

## 4. Product principles

1. **Honest by design.** Jobber only reorders, cuts and rephrases what is in the user's resume. It never invents skills,
   metrics or titles. Gaps are shown, not filled.
2. **Sounds like a person.** No buzzwords, no em dashes, no AI tells. Enforced by a lint check, not just a prompt.
3. **Built for ATS (Applicant Tracking Systems).** Single-column, reverse-chronological layout, which is what Workday, Greenhouse, Lever, iCIMS and Taleo all parse reliably.
   No tables, text boxes, icons, photos or headers/footers holding contact details.
   **Default design is a compact one-pager**, and work history always comes before skills and projects.
4. **Human in the loop.** The user approves every resume and submits every application.
5. **Private by default.** No login, no server storage. Resume, key and tracker stay in the user's browser.
6. **Show the evidence.** Every score explains itself (JD requirement ↔ resume line).

## 5. v1 scope

Flow: Landing → Connect key → Resume → Resume report → Jobs → Match report → Tailor → Apply → Tracker.

| # | Feature | Acceptance criteria |
|---|---|---|
| F1 | **Bring-your-own key** | Key saved in localStorage only; sent only to `api.anthropic.com`; "Forget my key" clears it; demo mode works with no key |
| F2 | **Resume upload + understanding** | PDF/DOCX parsed in browser; summary of seniority, strengths, wins, watch-outs; user can correct it |
| F2b | **Google Docs link import** | User pastes a Doc shared as "anyone with the link can view"; Claude fetches it directly (web fetch limited to Google domains), our server never sees it; warning that link sharing exposes the doc |
| F3 | **Preferences** | Target titles, home location, per-market work mode (e.g. India: any; US/EU: remote and open to India), freshness window (default 60 days), deal-breakers |
| F4 | **Resume report** | Overall score + categories (ATS parsing, Impact, Human voice, Repetition, Length & format, Sections, Spelling & grammar); each issue shows now vs suggested and a one-click fix |
| F4b | **How this report is judged** | Panel listing every check, its exact rule, whether it's a fixed rule or Claude's judgement, the scoring formula, and the flagged word list |
| F4c | **Interview readiness (story review)** | Claude reviews the 4 achievements most likely to be probed against: problem/why it mattered/ownership; options and decision logic; metrics and how measured; what went wrong and trade-offs; individual vs team contribution. Story strength score (separate from resume health) counts only problem, metrics, ownership; the other two become practice questions. Offers a stronger bullet using only existing facts |
| F4d | **Copy fixes into your own doc** | Every suggested fix has Copy; Google Doc users also get Open my doc and Mark as fixed. Jobber never edits the user's doc |
| F5 | **Headline + summary writer** | Generates headline and summary from resume facts only; passes the human-voice lint |
| F6 | **Job feed** | Greenhouse, Lever, Ashby, Himalayas, Remotive; ≤ 60 days old; title filter; eligibility check (worldwide / region OK / not eligible / verify); de-duplicated; cached server-side 1 hr |
| F7 | **Ghost and scam signals** | Each job carries flags: posted > 30 days, link closed, no salary or vague JD, asks for payment or personal-email contact. Flagged jobs ranked lower, never hidden silently |
| F8 | **Paste a JD** | Paste text from LinkedIn/Naukri/anywhere + optional URL; same checks as feed (warnings, not blocks) |
| F9 | **Match report** | Match score (rubric: must-haves 35, seniority 20, domain 20, skills 15, location 10), interview chance (Low/Med/High + % with stated adjustments), requirement ↔ evidence table, gaps |
| F10 | **Tailored resume** | Highlighted diff vs original; checks: no invented facts, human voice, ATS parse, keyword coverage, 1 page; user can request changes; export .docx + .pdf, no Jobber branding |
| F11 | **Cover note + form answers** | Why company, why role, 120-word cover note, notice/salary from profile; copy buttons; human-voice lint |
| F12 | **Assisted apply** | "Open job page", user confirms "I've submitted", only then logged |
| F13 | **Tracker** | Table with status (Applied, Intro Call Done, Interview Scheduled, Passed, Rejected, Ghosted), notes, counts per status; export CSV and Excel |
| F14 | **Responsive** | Usable on phone and tablet widths |

## 6. Prioritisation of competitor features

Reference: a leading resume-builder's feature list (Nov 2026). Scored on value to the job seeker, effort, and fit with our principles.

| Feature in reference | Decision | Why |
|---|---|---|
| Built-in ATS check with parse score | **v1** (F4) | Core of the resume report; we already run the checks locally |
| AI coach that reviews draft and suggests rewrites | **v1** (F4) | Same report, with one-click fixes |
| Detect spelling, grammar, clichés, weak phrasing | **v1** (F4) | Clichés and weak phrasing already covered by our lint; add spelling/grammar |
| Generate headlines, summaries, skills sections | **v1** (F5) | Cheap, high value; facts-only |
| Paste any JD and get tailoring | **v1** (F8, F10) | Already the core flow |
| Keyword optimisation per role | **v1** (F9, F10) | Keyword coverage + honest gap list |
| Matching cover letter per job | **v1** (F11) | Drafted in Apply step |
| Export with no branding | **v1** (F10) | Free for us |
| Relevance score before applying | **v1** (F9) | Our match score + interview chance |
| Job feed that avoids ghost jobs | **v1** (F6, F7) | 60-day freshness + live-link check + flags |
| Flag suspicious listings | **v1** (F7) | One extra field in the scoring prompt |
| Visual dashboard for many applications | **v1 table → v1.1 board** | Table ships first; Kanban board by status next |
| Edit from desktop, mobile, tablet | **v1** (F14) | Responsive layout |
| Add jobs from a URL automatically | **v1.1** | Needs server-side page fetch; LinkedIn blocks it, so paste stays the fallback |
| Task reminders with due dates | **v1.1** | "Next action + due date" in tracker, "due today" list, calendar (.ics) export; no push in browser-only mode |
| Optimise LinkedIn profile | **v1.1** | Paste headline/About/experience, get suggestions under the same honesty rules |
| Multiple ATS-safe templates | **v1.1** | v1 ships the compact one-page single-column design (always preferred); later variants keep work history above skills/projects |
| AI mock interview questions for each role | **v2** | Triggered when status becomes "Interview Scheduled"; uses JD + tailored resume |
| Day-before interview checklist and prep frameworks | **v2** | Bundled with mock interviews |
| Save jobs from any board via browser extension | **v2** | Separate build and store review; paste covers it until then |
| Translate resume | **Later** | Few target markets need it; revisit for EU non-English roles |
| Salary negotiation help | **Later** | Prefer AI salary research per role over static guides |
| Cloud storage for documents | **Later** | Conflicts with browser-only v1; only if login is added |
| Data on encrypted servers | **N/A** | We store nothing on servers |
| 10,000+ pre-written bullet suggestions | **Won't do** | Conflicts with principle 1; we strengthen the user's own bullets instead |
| Expert-written template and guide library | **Won't do** | Content business, not our edge |

**Our differentiators (not in the reference):** zero-fabrication guardrail, human-voice lint, eligibility check for remote roles
from the user's country, evidence-backed match score, interview chance that will be calibrated on the user's own outcomes, key and data never leave the browser.

## 6b. Role coverage

- **Resume review works for any role.** The checks are role-neutral, except "every bullet has a number", which is too strict for
  roles like design, writing, teaching or healthcare. Open: soften it to a tip when the target role isn't metric-driven.
- **Job search works for any target title**, but v1 sources (Greenhouse, Lever, Ashby, Himalayas, Remotive) are mostly tech, startup and
  remote companies. Non-tech roles are poorly covered; pasting a JD is their path until broader sources (Adzuna, JSearch) are added.

## 7. Out of scope for v1

Auto-submitting applications, editing the user's Google Doc directly (needs Google sign-in and Google's app review), LinkedIn/Naukri scraping, user accounts, server-side storage, Google Sheets sync (local Claude Code version keeps it), payments.

## 8. Architecture (v1)

- **Frontend:** Next.js on Vercel; all Claude calls from the browser with the user's key.
- **Server:** one route, `/api/jobs`, fetches public job boards and caches for 1 hour. Never sees the key or resume.
- **Models:** Claude Opus 5.5 (`claude-opus-5-5`) for reading resumes, scoring and tailoring, with server-side refusal fallbacks on.
  Effort `medium` for reading, `low` for single-line fixes. Cheaper models (Sonnet/Haiku) can be swapped in per call if cost per user matters.
- **Code:** `web/app` (Vite + React). Build 1 screens: Landing, Connect key, Resume, Resume report, Tracker. Jobs, Match, Tailor, Apply show "coming in build 2/3".
- **Storage:** localStorage / IndexedDB in the browser.
- **Documents:** .docx built in browser; PDF via print-ready resume page.

## 9. Security

- No third-party scripts; strict Content Security Policy (scripts self only; connect to self + `api.anthropic.com`).
- All job text and model output rendered as plain text, never HTML.
- UI tells users to create a dedicated key with a spend limit.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Key theft via injected script | CSP, no third-party code, plain-text rendering |
| Job boards change APIs or block | Multiple sources; per-source failures don't break the feed |
| Interview chance is uncalibrated at launch | Labelled as an estimate with stated reasons; calibrate from tracker outcomes (v2) |
| Visitors without a key bounce | Demo mode with sample resume and saved results |
| Model rewrites drift into AI-speak | Deterministic lint after every rewrite; fail and rewrite until clean |

## 11. Open questions

- Which extra resume designs (if any) for v1.1, given compact one-page is the default.

Decided:
- Demo mode uses a made-up sample resume (fictional PM persona), with saved results so it runs without a key.
- v1 launches on the free `*.vercel.app` link; move to `jobber.<own-domain>` once a domain is bought.
- Resume design: compact one-page single column, work history above skills and projects.

## Changelog

- **2026-11-18:** v0 Claude Code agent built (job fetch, scoring rules, human-voice lint, ATS docx/PDF, Google Sheet tracker).
- **2026-11-18:** Web app named Jobber. Decisions: bring-your-own key, guided steps, browser-only storage, in-app tracker with export.
  Clickable prototype built. Competitor feature list prioritised (section 6); added F5 headline/summary writer, F7 ghost and scam signals, spelling/grammar check to v1.
  Demo mode will use a made-up resume. Compact one-pager is the default resume design; launch on free Vercel link.
- **2026-11-18:** Build 1 of the web app (`web/app`): bring-your-own key, PDF read in browser, Claude resume reading
  (structured resume, plain-language summary, spelling/grammar), deterministic resume report with Claude-suggested fixes
  and one-click apply, preferences, tracker with CSV export, demo mode (fictional "Meera Kapoor"), strict CSP.
  Local CLI resume export switched to the compact one-page layout with a page-count check.
- **2026-11-18:** Added Google Docs link import (F2b), "How this report is judged" panel (F4b), interview-readiness story review
  with a separate Story strength score (F4c), and Copy / Open my doc on every fix (F4d). Documented role coverage (6b).
