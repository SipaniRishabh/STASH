// Deterministic resume checks (port of scripts/resume.py check). Same input, same result, no model involved.

export const BANNED = [
  "spearhead", "leverag", "robust", "seamless", "dynamic", "passionate", "results-driven", "results driven",
  "cutting-edge", "cutting edge", "synergy", "synergies", "delve", "proven track record", "utiliz", "innovative",
  "best-in-class", "world-class", "game-changer", "game changing", "fast-paced", "detail-oriented", "go-getter",
  "self-starter", "thought leader", "visionary", "orchestrat", "revolutioniz", "transformative", "empower",
  "holistic", "paradigm", "unlock", "elevat", "foster", "harness", "navigat", "landscape", "tapestry",
  "meticulous", "pivotal", "instrumental in", "adept at", "in today's", "ever-evolving", "a testament to",
  "strategic thinker", "excellent communication", "team player", "hands-on experience", "wide range of",
];

// `rule` is shown verbatim in "How this report is judged", so keep it in sync with the code below.
export const CATEGORIES = [
  { id: "ats", name: "ATS parsing", checks: [
    { id: "extract", name: "Text extraction", by: "rule",
      about: "Jobber read your resume the way an Applicant Tracking System does. Icons, emoji and hidden characters can turn into garbage or make your contact details disappear.",
      rule: "Flags any emoji, icon symbol, private-use glyph or zero-width character in the extracted text. Parse rate = share of words (4+ letters) from your summary and bullets that appear in the plain-text extraction." },
    { id: "sections", name: "Standard sections", by: "rule",
      about: "Recruiters and ATS look for contact details, Summary, Experience, Education and Skills.",
      rule: "One issue for each missing item: email, phone, summary, experience, education, skills." },
  ]},
  { id: "impact", name: "Impact", checks: [
    { id: "numbers", name: "Quantified results", by: "rule",
      about: "Bullets with a number or concrete result get read. Bullets without one get skimmed.",
      rule: "One issue for each experience bullet that contains no digit." },
  ]},
  { id: "voice", name: "Human voice", checks: [
    { id: "buzz", name: "Buzzwords and AI tells", by: "rule",
      about: "Words like leveraged, spearheaded or passionate read as filler, and recruiters now associate them with AI-written resumes.",
      rule: `One issue for each summary line or bullet containing any of ${BANNED.length} listed words or word stems (e.g. leverag-, spearhead-, passionate, robust).` },
    { id: "dash", name: "Dashes", by: "rule",
      about: "Em and en dashes are one of the most common signs of AI-written text. Use a comma or a full stop.",
      rule: "One issue for each summary line or bullet containing an em dash or en dash." },
  ]},
  { id: "repeat", name: "Repetition", checks: [
    { id: "verbs", name: "Opening verbs", by: "rule",
      about: "When several bullets start with the same verb, the resume reads as a template. Use any verb at most twice.",
      rule: "One issue for each bullet after the second that starts with the same word." },
  ]},
  { id: "length", name: "Length & format", checks: [
    { id: "pages", name: "Page count", by: "rule",
      about: "A compact one-page resume reads stronger for most roles. Jobber exports one page by default.",
      rule: "One issue if the resume is longer than one page (PDF page count; for Google Docs, estimated at about 600 words per page)." },
    { id: "long", name: "Bullet length", by: "rule",
      about: "Bullets over two lines get skimmed past. Keep each under about 230 characters.",
      rule: "One issue for each bullet longer than 230 characters." },
  ]},
  { id: "lang", name: "Spelling & grammar", checks: [
    { id: "grammar", name: "Spelling and grammar", by: "ai",
      about: "Typos are the fastest way to lose a recruiter's attention.",
      rule: "Claude lists real spelling and grammar mistakes when it reads your resume. British and American spellings both count as correct." },
  ]},
];

const ICONS = /[​-‍⁠﻿]|\p{Extended_Pictographic}|[☀-➿]|[-]/gu;

function lines(r) {
  const out = [];
  if (r.summary) out.push({ where: "Summary", text: r.summary, kind: "summary" });
  r.experience.forEach((e) => e.bullets.forEach((b) => out.push({ where: e.company, text: b, kind: "bullet" })));
  return out;
}

/** Share of resume words that survived plain-text extraction. Scanned/image PDFs score near 0. */
export function parseRate(resume, rawText) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const raw = new Set(norm(rawText).split(" "));
  const words = norm(lines(resume).map((l) => l.text).join(" ")).split(" ").filter((w) => w.length > 3);
  if (!words.length) return 0;
  return Math.round((100 * words.filter((w) => raw.has(w)).length) / words.length);
}

/** Returns {checkId: [{text, issue, fixable}]}. text is the exact line to fix (or null). */
export function lint(resume, rawText = "", pages = 1, languageIssues = []) {
  const f = Object.fromEntries(CATEGORIES.flatMap((c) => c.checks.map((k) => [k.id, []])));

  const icons = [...new Set(rawText.match(ICONS) || [])];
  if (icons.length) {
    const one = new RegExp(ICONS.source, "u");
    const firstLine = rawText.split("\n").find((l) => one.test(l)) || "";
    f.extract.push({
      text: firstLine.trim().slice(0, 200),
      issue: `Found ${icons.length} icon or hidden character${icons.length > 1 ? "s" : ""} (${icons.filter((c) => /\S/.test(c)).join(" ") || "invisible"}). Jobber's export uses plain text instead.`,
      fixable: false,
      suggested: [resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.linkedin].filter(Boolean).join(" | "),
    });
  }
  const c = resume.contact;
  if (!c.email) f.sections.push({ text: null, issue: "No email address found." });
  if (!c.phone) f.sections.push({ text: null, issue: "No phone number found." });
  if (!resume.summary) f.sections.push({ text: null, issue: "No summary. A 2-3 sentence summary helps recruiters place you fast." });
  if (!resume.experience.length) f.sections.push({ text: null, issue: "No work experience found." });
  if (!resume.education.length) f.sections.push({ text: null, issue: "No education found." });
  if (!resume.skills.length) f.sections.push({ text: null, issue: "No skills section found." });

  const openers = {};
  for (const l of lines(resume)) {
    const low = l.text.toLowerCase();
    const hits = BANNED.filter((w) => low.includes(w));
    if (hits.length) f.buzz.push({ text: l.text, issue: `Uses ${hits.map((h) => `"${h}…"`).join(", ")}.`, fixable: true });
    if (/[—–]/.test(l.text)) f.dash.push({ text: l.text, issue: "Contains an em or en dash.", fixable: true });
    if (l.kind === "bullet") {
      if (!/\d/.test(l.text)) f.numbers.push({ text: l.text, issue: "No number or concrete result.", fixable: true });
      if (l.text.length > 230) f.long.push({ text: l.text, issue: `${l.text.length} characters. Aim for under 230.`, fixable: true });
      const v = (l.text.split(/\s+/)[0] || "").toLowerCase().replace(/[^a-z]/g, "");
      (openers[v] ||= []).push(l.text);
    }
  }
  for (const [v, ls] of Object.entries(openers)) {
    if (ls.length > 2) ls.slice(2).forEach((t) => f.verbs.push({ text: t, issue: `"${v[0].toUpperCase() + v.slice(1)}" opens ${ls.length} bullets.`, fixable: true }));
  }
  if (pages > 1) f.pages.push({ text: null, issue: `Your resume is ${pages} pages. Jobber's tailored versions cut it to one page by dropping the bullets least relevant to each job.` });
  languageIssues.forEach((x) => f.grammar.push({ text: x.text, issue: x.issue, fixable: true }));
  return f;
}

/** Category % and overall score. ponytail: flat penalty per issue; tune weights once we see real resumes. */
export function score(findings) {
  const cats = CATEGORIES.map((cat) => {
    const n = cat.checks.reduce((s, k) => s + findings[k.id].length, 0);
    return { ...cat, issues: n, pct: Math.max(40, 100 - 12 * n) };
  });
  return { cats, overall: Math.round(cats.reduce((s, c) => s + c.pct, 0) / cats.length) };
}

/** Replace one exact line (summary or bullet) in the resume. Returns a new resume object. */
export function replaceLine(resume, from, to) {
  const r = structuredClone(resume);
  if (r.summary === from) r.summary = to;
  r.experience.forEach((e) => (e.bullets = e.bullets.map((b) => (b === from ? to : b))));
  return r;
}
