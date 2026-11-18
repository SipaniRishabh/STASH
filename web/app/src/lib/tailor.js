// Checks on a tailored resume (F10) and the ATS-friendly Word export. All deterministic, no model involved.
import { lint } from "./lint.js";

const flat = (r) =>
  [r.headline, r.summary, ...r.experience.flatMap((e) => [e.title, e.company, e.blurb, e.dates, ...e.bullets]), ...r.skills.flatMap((s) => s.items), ...r.certifications].join(" ");

const words = (r) => flat(r).split(/\s+/).filter(Boolean).length + r.education.length * 8;

// ponytail: word count as a one-page proxy (~600 words fits the compact layout); a real page measure needs layout.
export const ONE_PAGE_WORDS = 600;

// Impact numbers in work-experience bullets: "22%", "1.4M users", "$370K", "40+ A/B tests", "3 hrs", "11% to 17%". Bare years (2019, 2023) and digits inside words (B2C, Web3, Q3) stay plain.
const IMPACT = /(?<![A-Za-z0-9])(?:(?:[$₹€£]|\b(?:INR|USD|EUR|GBP|Rs\.?)\s?)\s?)?\d[\d,.]*(?:\s?(?:%|\+|x\b|[KMB]\b|k\b|L\b|Cr\b|lakh|crore|mn\b|bn\b))*(?:\s?(?:hrs?|hours?|mins?|minutes?|days?|weeks?|months?|years?|yrs?|users?|customers?|merchants?|clients?|people|members|countries|cities|markets))?(?![A-Za-z])/gi;

/** Split a bullet into [{ text, bold }] so impact numbers render bold in the preview, PDF and Word file. */
export function boldParts(line) {
  const out = [];
  let last = 0;
  for (const m of line.matchAll(IMPACT)) {
    const t = m[0].trim();
    if (/^(19|20)\d\d$/.test(t)) continue;
    if (m.index > last) out.push({ text: line.slice(last, m.index), bold: false });
    out.push({ text: m[0], bold: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), bold: false });
  return out;
}

/** Every check shown on the Tailor screen. Each: { id, name, ok, detail }. */
export function tailorChecks(original, tailored, keywords, evidence = []) {
  const source = `${flat(original)} ${evidence.map((e) => e.text).join(" ")}`;
  const nums = (s) => new Set(s.match(/\d[\d,.]*%?/g) || []);
  const have = nums(source);
  const newNums = [...nums(flat(tailored))].filter((n) => !have.has(n));

  const origFacts = new Set(original.experience.map((e) => `${e.title}|${e.company}|${e.dates}`));
  const changedFacts = tailored.experience.filter((e) => !origFacts.has(`${e.title}|${e.company}|${e.dates}`));

  const f = lint(tailored);
  const voice = [...f.buzz, ...f.dash, ...f.verbs];

  const text = flat(tailored).toLowerCase();
  // Stem match: "Product Management" counts for "product manager", "designing experiments" for "design experiments".
  const hit = (k) => k.toLowerCase().split(/\s+/).every((w) => text.includes(w.length > 5 ? w.slice(0, w.length - 4) : w));
  const missing = keywords.filter((k) => !hit(k));
  const n = words(tailored);

  return [
    { id: "facts", name: "No invented numbers", ok: !newNums.length, detail: newNums.length ? `New numbers not in your resume: ${newNums.join(", ")}` : "Every number comes from your resume." },
    { id: "roles", name: "Employers, titles and dates unchanged", ok: !changedFacts.length, detail: changedFacts.length ? `Changed: ${changedFacts.map((e) => `${e.title} at ${e.company}`).join("; ")}` : "Same roles as your resume." },
    { id: "voice", name: "Human voice", ok: !voice.length, detail: voice.length ? voice.map((v) => `${v.issue} "${v.text.slice(0, 80)}…"`).join(" ") : "No buzzwords, dashes or repeated openers." },
    { id: "keywords", name: "Keyword coverage", ok: missing.length <= Math.floor(keywords.length / 3), detail: `${keywords.length - missing.length} of ${keywords.length} job keywords.${missing.length ? ` Not used: ${missing.join(", ")}.` : ""}` },
    { id: "page", name: "Fits one page", ok: n <= ONE_PAGE_WORDS, detail: `About ${n} words (one page is roughly ${ONE_PAGE_WORDS}).` },
  ];
}

/** Single-column .docx with standard headings and contact in the body, for ATS parsing. */
export async function resumeDocx(r) {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Tab, TabStopType } = await import("docx");
  // A4 with 12 mm margins (twips). The date tab stop sits exactly on the right margin.
  const PAGE = { width: 11906, height: 16838 }, M = 680, RIGHT = PAGE.width - 2 * M;
  // ponytail: font size from word count as a one-page fit; a real fit needs Word's layout engine.
  const n = words(r), size = n > 700 ? 18 : n > 600 ? 19 : 20;
  const font = "Calibri", tight = { line: 250, after: 20 };
  // Left text, dates flush right on the same line (work experience and education alike).
  const line = (left, right, opts = {}) => new Paragraph({ spacing: { before: 90, after: 10, line: 250 }, tabStops: [{ type: TabStopType.RIGHT, position: RIGHT }], ...opts, children: [
    new TextRun({ text: left, font, size, bold: true }),
    ...(right ? [new TextRun({ children: [new Tab(), right], font, size })] : []),
  ] });
  const p = (text, opts = {}) => new Paragraph({ spacing: tight, ...opts, children: [new TextRun({ text, font, size, ...(opts.run || {}) })] });
  // Work-experience bullets: impact numbers in bold, small hanging indent.
  const pb = (text) => new Paragraph({ spacing: tight, bullet: { level: 0 }, indent: { left: 280, hanging: 200 }, children: boldParts(text).map((x) => new TextRun({ text: x.text, bold: x.bold, font, size })) });
  const h = (text) => new Paragraph({ spacing: { before: 140, after: 40 }, border: { bottom: { style: "single", size: 4, color: "999999", space: 1 } }, children: [new TextRun({ text: text.toUpperCase(), font, size: size + 1, bold: true })] });
  const contact = [r.contact.email, r.contact.phone, r.contact.location, r.contact.linkedin].filter(Boolean).join(" | ");

  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.name, font, size: size + 10, bold: true })] }),
    ...(r.headline ? [p(r.headline, { alignment: AlignmentType.CENTER })] : []),
    p(contact, { alignment: AlignmentType.CENTER }),
    ...(r.summary ? [h("Summary"), p(r.summary)] : []),
    h("Experience"),
    ...r.experience.flatMap((e) => [
      line(`${e.title}, ${e.company}`, [e.location, e.dates].filter(Boolean).join(" | ")),
      ...(e.blurb ? [p(e.blurb, { run: { italics: true } })] : []),
      ...e.bullets.map((b) => pb(b)),
    ]),
    ...(r.education.length ? [h("Education"), ...r.education.map((e) => line(`${e.degree}, ${e.school}`, e.dates, { spacing: { before: 40, after: 20 } }))] : []),
    ...(r.skills.length ? [h("Skills"), ...r.skills.map((s) => p(`${s.label ? `${s.label}: ` : ""}${s.items.join(", ")}`))] : []),
    ...(r.certifications.length ? [h("Certifications"), ...r.certifications.map((c) => p(c))] : []),
  ];
  const doc = new Document({ sections: [{ properties: { page: { size: PAGE, margin: { top: M, bottom: M, left: M, right: M } } }, children }] });
  return Packer.toBlob(doc);
}

// A4 at 96 dpi, minus the 12 mm page padding top and bottom.
const A4_PX = 1123 - 2 * 45;

/**
 * Print only the resume, from a hidden frame: no browser header/footer (date, title, URL, page numbers),
 * none of the app around it, and scaled down (to 80% at most) so it fits one A4 page.
 */
export function printResume(el, title) {
  const copy = el.cloneNode(true);
  copy.querySelectorAll("mark").forEach((m) => m.replaceWith(...m.childNodes));
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:794px;height:0;border:0;visibility:hidden";
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><title></title><style>
    @page{size:A4;margin:0}
    html,body{margin:0;background:#fff;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .page{box-sizing:border-box;width:794px;padding:45px 52px;font:10pt/1.38 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif}
    h4{margin:10px 0 3px;font-size:9.5pt;letter-spacing:.7px;border-bottom:1px solid #bbb;padding-bottom:2px}
    ul{margin:2px 0 4px;padding-left:16px} li{margin:1px 0}
    p{margin:0} b{font-weight:700}
    .row{display:flex;gap:10px;align-items:baseline}.between{justify-content:space-between}
    .row>span{white-space:nowrap}
  </style></head><body><div class="page">${copy.innerHTML}</div></body></html>`);
  d.close();
  d.title = title; // becomes the default PDF file name
  const page = d.querySelector(".page");
  const h = page.scrollHeight - 90;
  if (h > A4_PX) page.style.zoom = Math.max(0.8, A4_PX / h).toFixed(3);
  f.contentWindow.focus();
  f.contentWindow.print();
  setTimeout(() => f.remove(), 1000);
}

export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Self-check: node src/lib/tailor.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("tailor.js")) {
  const base = { name: "A", headline: "", contact: { email: "a@b.c", phone: "1", location: "", linkedin: "" }, summary: "Product manager with 5 years.",
    experience: [{ title: "PM", company: "X", blurb: "", location: "", dates: "01/2020 - Present", bullets: ["Cut failures 22%", "Ran 40 tests"] }],
    education: [], skills: [{ label: "", items: ["SQL"] }], certifications: [] };
  const good = structuredClone(base); good.experience[0].bullets.reverse();
  const bad = structuredClone(base); bad.experience[0].bullets[0] = "Cut failures 35% using a robust pipeline"; bad.experience[0].company = "Y";
  const ok = (c, id) => c.find((x) => x.id === id).ok;
  const g = tailorChecks(base, good, ["sql", "Product Management"]), b = tailorChecks(base, bad, ["sql", "kubernetes", "go", "rust"]);
  if (!ok(g, "facts") || !ok(g, "roles") || !ok(g, "voice") || !ok(g, "keywords")) throw new Error("good flagged");
  if (ok(b, "facts") || ok(b, "roles") || ok(b, "voice") || ok(b, "keywords")) throw new Error("bad passed");
  const bolded = (s) => boldParts(s).filter((x) => x.bold).map((x) => x.text.trim());
  const eqA = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`bold: ${JSON.stringify(a)}`); };
  eqA(bolded("Cut UPI payment failures by 22% for 12M users in 2023"), ["22%", "12M users"]);
  eqA(bolded("Saved ~270hrs/week ($370K/yr) and ran 40+ A/B tests"), ["270hrs", "$370K", "40+"]);
  eqA(bolded("Campaign worth INR 40 Cr and Rs. 5 lakh"), ["INR 40 Cr", "Rs. 5 lakh"]);
  eqA(bolded("Raised acceptance from 11% to 17%, cutting review from 3 hrs to 30 min"), ["11%", "17%", "3 hrs", "30 min"]);
  eqA(bolded("Built B2C and B2B flows on Web3 rails in Q3, 4G only"), []);
  if (boldParts("No numbers here").length !== 1) throw new Error("plain");
  if (boldParts("a 22% b").map((x) => x.text).join("") !== "a 22% b") throw new Error("lossy");
  console.log("tailor.js ok");
}
