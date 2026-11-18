Assisted apply for job slug: $ARGUMENTS. The user submits; you prepare and log. Follow CLAUDE.md.

1. Require an approved tailored resume at `resumes/tailored/<slug>.pdf` (else run /tailor first).
2. If there is a URL, check the posting still looks open (fetch it; look for "no longer accepting", 404, "job not found"). Warn if closed.
3. Draft answers to the usual form questions, in the same human voice as the resume (short, specific, no banned words):
   why this company (use specifics from the JD), why this role, a 120-word cover note, notice period and salary expectation from `profile.preferences`.
   Run the cover note through `scripts/resume.py check`-style rules mentally: no em dashes, no buzzwords.
4. Open the apply URL and the resume folder: `open "<url>"`, `open resumes/tailored/`.
5. Wait for the user to say they submitted. Do not log before that.
6. Log it: `.venv/bin/python scripts/tracker.py add '<json>'` with Company, Role, Location, Eligibility, Posted, Match,
   Confidence ("Medium 45%"), Resume file, URL, Source. Never set Next action or Notes. Status defaults to Applied.
