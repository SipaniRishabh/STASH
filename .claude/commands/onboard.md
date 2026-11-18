Refresh who the user is. Follow CLAUDE.md.

1. Extract the resume: `pdftotext -layout "<profile.resume_pdf>" -`. If `resumes/base.json` is missing or the PDF changed,
   rewrite `resumes/base.json` from it word for word (same schema; strip icons and zero-width characters). Do not improve the wording here.
2. Summarize back to the user in 4 lines: seniority, strongest domains, signature wins, obvious gaps for target roles.
3. Read `profile.json`. For each `preferences` field that is null, ask (AskUserQuestion, max 4 per round): salary floor (INR and USD),
   industries preferred/avoided, company stage, deal-breakers, notice period, relocation. Save answers into `profile.json`.
4. Update `profile.keywords` if the resume shows strengths not listed there.
