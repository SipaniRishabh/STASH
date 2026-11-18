The user pasted a job description (from LinkedIn, Naukri, a careers page, anywhere): $ARGUMENTS
If nothing was pasted, ask them to paste the full JD text (and the job URL if they have it). Follow CLAUDE.md.

1. Pull out: company, title, location / work mode, posted date or "posted X days ago" text, apply URL. Ask only for what is missing and matters (URL, posted date).
2. Rule checks, as warnings (the user chose this job, so don't block):
   - older than 60 days or date unknown: warn
   - outside India and not remote, or remote but not open to India: warn
   - title outside target roles (PM, PM I, PM II, Senior PM): mention
3. Make a slug, save the JD to `data/jds/<slug>.txt`, score with the CLAUDE.md rubric, and add/merge the entry into `data/shortlist.json` (source: "pasted").
4. Show: match, confidence + %, why (2-3 bullets), gaps, must-have keywords.
5. Ask whether to tailor. On yes, run the /tailor flow for this slug.
