# STASH
## Jobber: tracing Claude calls with Langfuse

Users who tick **Share my sessions** on the Connect screen send a trace of every Claude call to
[Langfuse](https://langfuse.com), through Jobber's own `/api/trace` relay. It is off by default. Name, email, phone, LinkedIn
and API keys are removed in the browser first, and resume PDFs are never sent. See PRD F15.

**What a trace looks like**

- **Session:** one browser tab, so you can replay a user's whole journey. **User:** an anonymous id per browser.
- **Trace:** one feature call: `read_resume`, `read_resume_doc`, `review_stories`, `suggest_fix`, `score_job`,
  `tailor_resume`, `company_info`, `cover_note`. Tagged `error` when it failed.
- **Generation** inside it: each Claude request, with prompt, output, the model actually used, effort, tokens (including cache
  reads and writes), stop reason and error message.
- **Scores:** Jobber's deterministic checks on the answer, e.g. `check_facts` / `check_terms` / `check_keywords` on a tailored
  resume, `evidence_quoted_exactly` and `match_score` on a match report, `voice_ok` on fixes and cover notes.
- **Release / environment:** the deployed commit, and `production` vs `development`.

**Set it up**

1. Create a free project on [Langfuse Cloud](https://cloud.langfuse.com) (or self-host Langfuse) and copy its public and
   secret keys from Settings > API keys.
2. Production (Render): in the `jobber` web service, set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` and, if not on Langfuse
   Cloud EU, `LANGFUSE_HOST`. Vercel: same variables in the project settings.
3. Local: put the same three lines in `web/app/.env.local` (git-ignored), run `npm run dev`, tick **Share my sessions** and use
   the app. Dev traces are tagged `environment: development`.

**Error analysis**

In Langfuse, filter traces by the `error` tag, by a failed score (e.g. `check_terms = 0`), or take a random sample. Add them to
an annotation queue and write what went wrong on each (open coding), then group the notes into failure types (axial coding)
and count them. Traces can also be exported as CSV/JSON for analysis elsewhere.
