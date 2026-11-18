// All Claude calls go straight from the browser to api.anthropic.com with the user's own key.
// Our server never sees the key or the resume.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { BANNED } from "./lint.js";

export const MODEL = "claude-opus-5-5";

const Resume = z.object({
  name: z.string(),
  headline: z.string(),
  contact: z.object({ email: z.string(), phone: z.string(), location: z.string(), linkedin: z.string() }),
  summary: z.string(),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      blurb: z.string(),
      location: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(z.object({ degree: z.string(), school: z.string(), dates: z.string() })),
  skills: z.array(z.object({ label: z.string(), items: z.array(z.string()) })),
  certifications: z.array(z.string()),
});

const ResumeRead = z.object({
  resume: Resume,
  understanding: z.object({
    seniority: z.string(),
    strengths: z.string(),
    wins: z.string(),
    watchouts: z.string(),
  }),
  language_issues: z.array(z.object({ text: z.string(), issue: z.string() })),
});

const Fix = z.object({ suggested: z.string(), note: z.string() });

const WRITING_RULES = `Writing rules for any rewrite:
- Keep every fact, number, employer, tool and title exactly as the source states. Never add a skill, metric, tool, scope or claim.
- Plain, specific, human language. Concrete nouns and numbers. One to two lines (max 230 characters for a bullet).
- No em dashes or en dashes. No rule-of-three padding. No grand framing.
- Never use these words or stems: ${BANNED.join(", ")}.`;

function client(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

async function ask(apiKey, schema, content, effort = "medium", tools) {
  try {
    const messages = [{ role: "user", content }];
    let res;
    for (let turn = 0; turn < 4; turn++) {
      res = await client(apiKey).beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort, format: betaZodOutputFormat(schema) },
        messages,
        ...(tools && { tools }),
      });
      // Server tools (web fetch) can pause a long turn; resend the assistant turn so the server resumes it.
      if (res.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: res.content.map(({ parsed_output, ...b }) => b) });
    }
    if (res.stop_reason === "refusal") throw new Error("Claude declined this request. Try a different file.");
    if (res.stop_reason === "max_tokens") throw new Error("The answer was cut off. Try again.");
    if (!res.parsed_output) throw new Error("Claude's answer could not be read. Try again.");
    return res.parsed_output;
  } catch (e) {
    throw new Error(friendly(e));
  }
}

function friendly(e) {
  if (e instanceof Anthropic.AuthenticationError) return "That API key was rejected. Check it on the Connect screen.";
  if (e instanceof Anthropic.PermissionDeniedError) return "This key doesn't have access to the model. Check your Anthropic console.";
  if (e instanceof Anthropic.RateLimitError) return "Rate limited by Anthropic. Wait a minute and try again.";
  if (e instanceof Anthropic.BadRequestError) return `Request rejected: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic. Check your connection.";
  if (e instanceof Anthropic.APIError) return `Anthropic error ${e.status}. Try again.`;
  return e.message || String(e);
}

const READ_STEPS = `1. resume: transcribe it into the schema word for word. Do not improve, shorten or fix anything. Drop icons, emoji and
   decorative symbols. Use "" for missing fields. Work history goes in experience in the order shown; put projects as
   experience entries only if they are listed as roles. blurb = the one-line company description if present.
2. understanding: four short plain sentences about the person, written to them ("you"):
   seniority (level and years, career path), strengths (domains and product types they are strongest in),
   wins (their 2-3 most impressive results with numbers), watchouts (what a recruiter might question, honestly).
3. language_issues: real spelling or grammar mistakes only, each with the exact text containing it (copied verbatim from
   the summary or a bullet) and a short description. British and American spelling are both fine. Empty list if none.`;

/** Read a resume PDF: structured resume, a plain summary of the person, and spelling/grammar issues. */
export function readResume(apiKey, pdfBase64) {
  return ask(apiKey, ResumeRead, [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
    { type: "text", text: `Read this resume.\n\n${READ_STEPS}` },
  ]);
}

const DocRead = ResumeRead.extend({
  source_text: z.string(),
  fetch_failed: z.boolean(),
});

/** Google Docs link ("anyone with the link can view") -> plain-text export URL, or null if it isn't a Docs link. */
export function docExportUrl(url) {
  const m = /^https:\/\/docs\.google\.com\/document\/d\/([\w-]{20,})/.exec(url.trim());
  return m ? `https://docs.google.com/document/d/${m[1]}/export?format=txt` : null;
}

/** Read a resume from a public Google Doc. Claude fetches it directly; our server never sees it. */
export async function readResumeFromDoc(apiKey, url) {
  const exportUrl = docExportUrl(url);
  if (!exportUrl) throw new Error("That isn't a Google Docs link. It should look like https://docs.google.com/document/d/…");
  const out = await ask(
    apiKey,
    DocRead,
    [{
      type: "text",
      text: `Fetch this Google Doc with the web_fetch tool: ${exportUrl}
It is a resume. If the fetch fails or returns a sign-in page, set fetch_failed to true and leave other fields empty.
Otherwise set fetch_failed to false, copy the fetched text verbatim (including any symbols) into source_text, and:

${READ_STEPS}`,
    }],
    "medium",
    [{ type: "web_fetch_20260209", name: "web_fetch", max_uses: 2, allowed_domains: ["docs.google.com", "googleusercontent.com"] }],
  );
  if (out.fetch_failed) throw new Error("Couldn't open that doc. In Google Docs, set Share > General access to \"Anyone with the link\" (Viewer), then try again.");
  return out;
}

const Dim = z.object({ status: z.enum(["shown", "partial", "missing"]), note: z.string() });
const Stories = z.object({
  stories: z.array(z.object({
    achievement: z.string(),
    company: z.string(),
    problem: Dim,
    options: Dim,
    metrics: Dim,
    tradeoffs: Dim,
    ownership: Dim,
    questions: z.array(z.string()),
    improved: z.string(),
  })),
});

/** Interview-readiness review of the strongest achievements, using a five-part story framework. */
export function reviewStories(apiKey, resume) {
  return ask(apiKey, Stories, [{
    type: "text",
    text: `Here is a resume as JSON:\n${JSON.stringify(resume)}

Pick the 4 achievements (bullets) an interviewer is most likely to dig into. For each, judge it against five parts of a
strong story. For each part give status (shown = the bullet itself makes it clear, partial = hinted, missing = not in the
resume) and a one-sentence note saying what is there or what is missing:
- problem: the problem, why it mattered, and why this person owned it
- options: options considered and the decision logic
- metrics: the metrics, and whether it is clear how each number was measured
- tradeoffs: what went wrong, trade-offs made, what they would do differently
- ownership: their individual contribution versus the team's

achievement = the bullet copied exactly. questions = 3 to 5 pointed questions an interviewer will ask about this
achievement, aimed at the missing or partial parts (e.g. how a number was measured, what the baseline was).
improved = a rewrite of the bullet that makes problem, metric and ownership clearer using ONLY facts already in the
resume, or "" if the bullet is already strong. Options and trade-offs usually belong in the interview, not the bullet.

${WRITING_RULES}`,
  }]);
}

/** Suggest an honest rewrite for one flagged line. */
export function suggestFix(apiKey, resume, line, issue) {
  return ask(
    apiKey,
    Fix,
    [
      {
        type: "text",
        text: `Here is a resume as JSON:\n${JSON.stringify(resume)}\n\nRewrite this one line to fix the issue.\nLine: ${line}\nIssue: ${issue}\n\n${WRITING_RULES}\n\nsuggested = the replacement line only. note = one short sentence on what changed.`,
      },
    ],
    "low",
  );
}
