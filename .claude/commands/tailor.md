Tailor the resume for job slug: $ARGUMENTS. Follow CLAUDE.md (no fabrication, human writing, ATS format).

1. Load `data/shortlist.json` entry + `data/jds/<slug>.txt` + `resumes/base.json`.
2. Write `resumes/tailored/<slug>.json` (same schema as base.json):
   - Summary: 2-3 plain sentences aimed at this role, built only from base facts.
   - Per role: reorder bullets so the most JD-relevant come first; rephrase to use the JD's exact terms where true; cut weak or off-target bullets
     (keep at least 2 per role). Never invent metrics, tools, skills or scope.
   - Skills: reorder so JD-matching items come first; drop irrelevant ones; add nothing new.
   - Aim for one page (roughly <= 14 bullets total).
3. Run `.venv/bin/python scripts/resume.py build resumes/tailored/<slug>.json --keywords "<must_have_keywords comma-separated>"`.
   If it exits with slop/format issues, rewrite those lines in plain human language and re-run until clean.
   Missing keywords: add only where the user truly has that experience; otherwise list them as gaps.
4. Present for review:
   - What changed vs base (short list: reordered / rephrased / cut), with before -> after for rephrased bullets
   - Keyword coverage and gaps you could not honestly cover
   - Paths to the .docx and .pdf (open the PDF with `open`)
5. Ask: approve, or what to change. Apply edits and rebuild until the user approves. Then offer /apply <slug>.
