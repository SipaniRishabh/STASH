// Demo mode: a fictional product manager. Any resemblance to a real person is accidental.
// Saved Claude outputs let visitors without an API key walk through the full flow.

export const DEMO_RESUME = {
  name: "Meera Kapoor",
  headline: "Product Manager | Fintech & Consumer Apps",
  contact: { email: "meera.kapoor.pm@example.com", phone: "+91-90000-12345", location: "Bengaluru, India", linkedin: "linkedin.com/in/meera-kapoor-example" },
  summary: "Results-driven Product Manager with 5 years of experience, passionate about building delightful fintech experiences that drive growth — from payments to lending.",
  experience: [
    {
      title: "Product Manager", company: "PaySprout", blurb: "Consumer payments app (12M users)", location: "Bengaluru, India", dates: "03/2023 - Present",
      bullets: [
        "Led the redesign of UPI checkout, cutting payment failures by 22% and lifting weekly transacting users by 9%",
        "Led a squad of 6 engineers and 2 designers to launch bill reminders, reaching 1.4M users in 4 months",
        "Led the experimentation program and ran 40+ A/B tests across onboarding and checkout",
        "Spearheaded cross-functional alignment with risk and compliance teams on new KYC flows",
      ],
    },
    {
      title: "Associate Product Manager", company: "LendLoop", blurb: "Digital lending platform", location: "Mumbai, India", dates: "06/2021 - 02/2023",
      bullets: [
        "Shipped a pre-approved loan offer flow that raised offer acceptance from 11% to 17%",
        "Cut loan document drop-off by 30% by replacing manual uploads with DigiLocker fetch",
        "Worked closely with data science to improve the credit decisioning experience for thin-file users",
      ],
    },
    {
      title: "Business Analyst", company: "Northbeam Consulting", blurb: "", location: "Gurugram, India", dates: "07/2019 - 05/2021",
      bullets: [
        "Built churn dashboards for a telecom client used by 30 regional managers, cutting weekly reporting time by 6 hours",
        "Analysed 2M customer records to size a prepaid-to-postpaid upgrade campaign worth INR 40 Cr",
      ],
    },
  ],
  education: [{ degree: "B.Tech, Computer Science", school: "NIT Trichy", dates: "2015 - 2019" }],
  skills: [
    { label: "Product", items: ["Roadmapping", "Experimentation", "User Research", "Pricing"] },
    { label: "Data and tools", items: ["SQL", "Amplitude", "Mixpanel", "Figma", "JIRA"] },
  ],
  certifications: [],
};

export const DEMO_RAW_TEXT = `MEERA KAPOOR
Product Manager | Fintech & Consumer Apps
📧 meera.kapoor.pm@example.com | 📞 +91-90000-12345 | 📍 Bengaluru, India | linkedin.com/in/meera-kapoor-example
SUMMARY
${DEMO_RESUME.summary}
${DEMO_RESUME.experience.flatMap((e) => [e.title + ", " + e.company, ...e.bullets]).join("\n")}`;

export const DEMO_PAGES = 2;

export const DEMO_UNDERSTANDING = {
  seniority: "You're a mid-level Product Manager with about 5 years of experience: 2 years in analytics, then APM, then PM since 2023.",
  strengths: "You're strongest in consumer fintech, especially payments checkout, lending flows and experimentation.",
  wins: "Your best results are 22% fewer UPI payment failures, bill reminders reaching 1.4M users in 4 months, and loan offer acceptance up from 11% to 17%.",
  watchouts: "A recruiter may ask about scope beyond fintech and about direct ownership of revenue or P&L, which your resume doesn't show.",
};

export const DEMO_LANGUAGE = [];

const S = (status, note) => ({ status, note });
export const DEMO_STORIES = {
  stories: [
    {
      achievement: DEMO_RESUME.experience[0].bullets[0],
      company: "PaySprout",
      problem: S("partial", "Payment failures are named, but not why they mattered (lost revenue, churn) or why you owned the fix."),
      options: S("missing", "No sign of which redesign options you weighed or why you picked this one."),
      metrics: S("partial", "22% and 9% are clear outcomes, but not the baseline, time window or how failures were counted."),
      tradeoffs: S("missing", "Nothing on what went wrong or what you gave up."),
      ownership: S("partial", "\"Led the redesign\" suggests ownership, but not what you personally did versus design and engineering."),
      questions: [
        "What was the payment failure rate before and after, and over what period did you measure it?",
        "Which causes of failure did you find, and which did you choose not to fix?",
        "What else shipped at the same time that could explain the 9% lift in transacting users?",
        "What did you personally decide versus the design and engineering leads?",
      ],
      improved: "Led the UPI checkout redesign to fix payment failures, cutting failures by 22% and lifting weekly transacting users by 9%",
    },
    {
      achievement: DEMO_RESUME.experience[0].bullets[1],
      company: "PaySprout",
      problem: S("missing", "The bullet says what launched, not the user problem bill reminders solved."),
      options: S("missing", "No mention of alternatives considered."),
      metrics: S("partial", "1.4M users in 4 months is clear reach, but not whether reminders changed bill payments."),
      tradeoffs: S("missing", "No trade-offs mentioned."),
      ownership: S("shown", "Clear team size and that you led it."),
      questions: [
        "Did bill reminders increase on-time payments or app engagement, or only reach?",
        "How did you decide which bills to remind about first?",
        "What did you cut from the first version to launch in 4 months?",
      ],
      improved: "",
    },
    {
      achievement: DEMO_RESUME.experience[1].bullets[0],
      company: "LendLoop",
      problem: S("partial", "Low offer acceptance is implied by the before number, but not why it mattered to the business."),
      options: S("missing", "No sign of what you tried before the pre-approved flow."),
      metrics: S("shown", "Acceptance from 11% to 17% gives a clear before and after."),
      tradeoffs: S("missing", "No mention of risk trade-offs, which lending interviewers will ask about."),
      ownership: S("partial", "\"Shipped\" doesn't say what you owned as an APM versus your PM."),
      questions: [
        "How was offer acceptance measured, and over what cohort?",
        "Did default rates change for the users who accepted pre-approved offers?",
        "What was your role as APM versus the PM you reported to?",
      ],
      improved: "",
    },
    {
      achievement: DEMO_RESUME.experience[2].bullets[1],
      company: "Northbeam Consulting",
      problem: S("shown", "Sizing an upgrade campaign is a clear business problem."),
      options: S("missing", "No sign of the sizing approaches considered."),
      metrics: S("partial", "INR 40 Cr is the campaign size you estimated, not a result. Interviewers may read it as revenue earned."),
      tradeoffs: S("missing", "No assumptions or limits mentioned."),
      ownership: S("partial", "\"Analysed\" is clear, but not whether you built the model alone or with a team."),
      questions: [
        "Is INR 40 Cr the projected opportunity or realised revenue?",
        "What assumptions drove the estimate, and which was the shakiest?",
        "Did the client run the campaign, and what happened?",
      ],
      improved: "Analysed 2M customer records to size a prepaid-to-postpaid upgrade campaign, estimating an INR 40 Cr opportunity",
    },
  ],
};

// Saved suggestions keyed by the exact flagged line.
export const DEMO_FIXES = {
  [DEMO_RESUME.summary]: {
    suggested: "Product Manager with 5 years in consumer fintech, across payments and lending. At PaySprout I cut UPI payment failures by 22% and took bill reminders to 1.4M users in 4 months.",
    note: "Replaced filler words and the dash with two real results from your resume.",
  },
  "Spearheaded cross-functional alignment with risk and compliance teams on new KYC flows": {
    suggested: "Worked with risk and compliance teams to agree requirements for new KYC flows",
    note: "Plainer verb. There is no number in your original, so none was added. Add one if you have it.",
  },
  "Led the experimentation program and ran 40+ A/B tests across onboarding and checkout": {
    suggested: "Ran the experimentation program, with 40+ A/B tests across onboarding and checkout",
    note: "Changed the opening verb so 'Led' isn't used three times.",
  },
  "Worked closely with data science to improve the credit decisioning experience for thin-file users": {
    suggested: "Worked with data science on credit decisioning for thin-file users",
    note: "Shorter. Add the result (approval rate, default rate) if you know it; Jobber won't invent one.",
  },
};
