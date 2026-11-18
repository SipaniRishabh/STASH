// Checks on a tailored resume (F10) and the ATS-friendly Word export. All deterministic, no model involved.
import { lint } from "./lint.js";

const flat = (r) =>
  [r.headline, r.summary, ...r.experience.flatMap((e) => [e.title, e.company, e.blurb, e.dates, ...e.bullets]), ...r.skills.flatMap((s) => s.items), ...r.certifications].join(" ");

const words = (r) => flat(r).split(/\s+/).filter(Boolean).length + r.education.length * 8;

// ponytail: word count as a one-page proxy (~600 words fits the compact layout); a real page measure needs layout.
export const ONE_PAGE_WORDS = 600;

// Impact numbers: "22%", "1.4M users", "$370K", "40+ A/B tests", "3 hrs", "11% to 17%". Bare years (2019, 2023) stay plain.
const IMPACT = /(?:(?:[$₹€£]|\b(?:INR|USD|EUR|GBP|Rs\.?)\s?)\s?)?\d[\d,.]*(?:\s?(?:%|\+|x\b|[KMB]\b|k\b|L\b|Cr\b|lakh|crore|mn\b|bn\b))*(?:\s?(?:hrs?|hours?|mins?|minutes?|days?|weeks?|months?|years?|yrs?|users?|customers?|merchants?|clients?|people|members|countries|cities|markets))?/gi;

/** Split a line into [{ text, bold }] so impact numbers render bold in the preview, PDF and Word file. */
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
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import("docx");
  const font = "Calibri";
  const p = (text, opts = {}) => new Paragraph({ spacing: { after: 60 }, ...opts, children: [new TextRun({ text, font, size: 21, ...(opts.run || {}) })] });
  // Summary and bullets: impact numbers in bold.
  const pb = (text, opts = {}) => new Paragraph({ spacing: { after: 60 }, ...opts, children: boldParts(text).map((x) => new TextRun({ text: x.text, bold: x.bold, font, size: 21 })) });
  const h = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 60 }, children: [new TextRun({ text: text.toUpperCase(), font, size: 22, bold: true })] });
  const contact = [r.contact.email, r.contact.phone, r.contact.location, r.contact.linkedin].filter(Boolean).join(" | ");

  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.name, font, size: 32, bold: true })] }),
    ...(r.headline ? [p(r.headline, { alignment: AlignmentType.CENTER })] : []),
    p(contact, { alignment: AlignmentType.CENTER }),
    ...(r.summary ? [h("Summary"), pb(r.summary)] : []),
    h("Experience"),
    ...r.experience.flatMap((e) => [
      new Paragraph({ spacing: { before: 100, after: 20 }, children: [
        new TextRun({ text: `${e.title}, ${e.company}`, font, size: 21, bold: true }),
        new TextRun({ text: `  ${[e.location, e.dates].filter(Boolean).join(" | ")}`, font, size: 21 }),
      ] }),
      ...(e.blurb ? [p(e.blurb, { run: { italics: true } })] : []),
      ...e.bullets.map((b) => pb(b, { bullet: { level: 0 } })),
    ]),
    ...(r.education.length ? [h("Education"), ...r.education.map((e) => p(`${e.degree}, ${e.school}${e.dates ? ` | ${e.dates}` : ""}`))] : []),
    ...(r.skills.length ? [h("Skills"), ...r.skills.map((s) => p(`${s.label ? `${s.label}: ` : ""}${s.items.join(", ")}`))] : []),
    ...(r.certifications.length ? [h("Certifications"), ...r.certifications.map((c) => p(c))] : []),
  ];
  const doc = new Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 800, right: 800 } } }, children }] });
  return Packer.toBlob(doc);
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
  if (boldParts("No numbers here").length !== 1) throw new Error("plain");
  if (boldParts("a 22% b").map((x) => x.text).join("") !== "a 22% b") throw new Error("lossy");
  console.log("tailor.js ok");
}
