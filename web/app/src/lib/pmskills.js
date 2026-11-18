// Implied PM skills: what any PM at a given experience level does as part of the job, even if no bullet says so.
// Sent with every match-scoring call so "Write clear PRDs" isn't marked a gap for someone with 4 years as a PM.
// Implied skills count toward the match score only. Tailoring never writes them into the resume unless the user
// confirms them in their own words on the Match report.

export const PM_LEVELS = [
  {
    minYears: 0,
    label: "Any APM or PM role",
    skills: [
      "Writing PRDs, product specs and user stories with clear goals, scope and acceptance criteria",
      "Working cross-functionally with engineering, design, data and business teams",
      "Backlog grooming, sprint planning and prioritising within a release",
      "Defining and tracking feature-level metrics and dashboards",
      "Running UAT and coordinating launches",
    ],
  },
  {
    minYears: 2,
    label: "2+ years as a PM",
    skills: [
      "Owning a roadmap and making prioritisation trade-offs",
      "Stakeholder management and written and verbal communication with leadership",
      "User research, customer interviews and usability feedback loops",
      "Setting success metrics and KPIs before launch",
      "Go-to-market coordination with marketing, sales and support",
    ],
  },
  {
    minYears: 4,
    label: "4+ years as a PM",
    skills: [
      "Owning a product area end to end, from discovery to iteration",
      "Turning ambiguous problems into a scoped plan",
      "Guiding and reviewing the work of APMs or junior PMs informally",
      "Presenting product plans and results to senior leadership",
    ],
  },
  {
    minYears: 7,
    label: "7+ years as a PM",
    skills: [
      "Setting product strategy and multi-quarter vision for a product line",
      "Influencing across teams without direct authority",
    ],
  },
];

// Practices that count when the resume shows the matching kind of work. Each: [skill, resume signal].
export const SIGNALED = [
  ["A/B testing and experiment design", /\b(a\/b|ab test|experiment|split test|variant)/i],
  ["SQL and self-serve data analysis", /\b(sql|analytics|data analyst|business analyst|looker|tableau|metabase|amplitude|mixpanel)/i],
  ["Working with ML or data science teams", /\b(ml|machine learning|model|data science|recommendation|llm|ai)\b/i],
  ["Payments, compliance and risk trade-offs", /\b(payment|upi|kyc|lending|credit|fraud|compliance)/i],
  ["Growth funnels, activation and retention", /\b(funnel|activation|retention|conversion|onboarding|churn|growth)/i],
];

const PM_TITLE = /\b(product (manager|owner|lead)|associate product|apm|\bpm\b|group product|head of product)/i;

/** Years in PM/APM roles, from "MM/YYYY - MM/YYYY|Present" or "YYYY - YYYY" dates. */
export function pmYears(resume, now = new Date()) {
  let months = 0;
  for (const e of resume?.experience || []) {
    if (!PM_TITLE.test(e.title)) continue;
    const [a, b] = (e.dates || "").split(/\s*(?:-|–|—|\bto\b)\s*/i);
    const start = toMonths(a);
    const end = /present|current|now/i.test(b || "") ? now.getFullYear() * 12 + now.getMonth() : toMonths(b);
    if (start != null && end != null && end >= start) months += end - start + 1;
  }
  return Math.round((months / 12) * 10) / 10;
}

function toMonths(s) {
  const m = /(?:(\d{1,2})\/)?(\d{4})/.exec(s || "");
  return m ? +m[2] * 12 + (m[1] ? +m[1] - 1 : 0) : null;
}

/** The ruleset text for the scoring prompt, specific to this resume. */
export function impliedSkills(resume) {
  const years = pmYears(resume);
  const text = JSON.stringify(resume).toLowerCase();
  const levels = years > 0 ? PM_LEVELS.filter((l) => years >= l.minYears) : [];
  const signaled = years > 0 ? SIGNALED.filter(([, re]) => re.test(text)).map(([s]) => s) : [];
  return { years, levels, signaled };
}

// Self-check: node src/lib/pmskills.js
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("pmskills.js")) {
  const r = { experience: [
    { title: "Product Manager", dates: "03/2023 - 02/2025" },
    { title: "Associate Product Manager", dates: "06/2021 - 02/2023" },
    { title: "Business Analyst", dates: "07/2019 - 05/2021" },
  ], skills: [{ items: ["A/B testing", "SQL"] }] };
  const y = pmYears(r);
  if (y !== 3.8) throw new Error(`pmYears ${y}`);
  const imp = impliedSkills(r);
  if (imp.levels.length !== 2 || !imp.signaled.includes("A/B testing and experiment design")) throw new Error("implied");
  if (pmYears({ experience: [{ title: "Senior Product Manager", dates: "01/2024 to Present" }] }, new Date(2025, 11, 1)) !== 2) throw new Error("present");
  if (pmYears({ experience: [{ title: "Engineer", dates: "2015 - 2020" }] }) !== 0) throw new Error("non-PM");
  console.log("pmskills.js ok", y, imp.signaled);
}
