// Netlify Streaming Function — the Practice Library personalised plan generator.
//
// Flow (two sequential Claude calls per request, both via Netlify AI Gateway,
// no API key management needed — ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL are
// auto-provisioned once this site has a production deploy):
//
//   1. SCOPE CHECK — cheap, fast call. Is what the reader described something
//      the Practice Library's actual content can address? If not (or if it
//      reads as something needing professional help this library isn't), stop
//      here with a polite, honest message. No card data is sent for this step.
//
//   2. PLAN GENERATION — only runs if step 1 passes. The full corpus of real,
//      published items (practice-corpus.json — Posted cards only, so every
//      citation resolves to a live URL) is sent alongside the reader's
//      situation, and Claude is asked to select and explain specific items by
//      id, in strict JSON.
//
//   3. VALIDATION — every item id Claude returns is checked against the real
//      corpus before anything is sent to the browser. Nothing that doesn't
//      resolve to an actual item gets shown. This is the hard rule: the
//      system cannot present anything not directly linked to a real card.
//
// Declared as a Streaming Function (ReadableStream body) to get Netlify's
// 60-second execution budget instead of the ~10-26s synchronous limit — the
// generation call, with the full item corpus as context, needs the room.
// The client does not receive partial/unvalidated tokens: the stream carries
// exactly one enqueue, the finished and validated payload, then closes.
//
// Routed via netlify.toml (from "/generate-plan" -> this function), NOT via
// this file's own `config.path` — routing through the classic redirect is
// what lets netlify.toml attach a [redirects.rate_limit] block to the path.
// A function-declared path and a netlify.toml redirect to the same path
// would be redundant/ambiguous, so this function deliberately has no
// `export const config` at the bottom.
//
// Accepts an optional `exclude_ids` array in the request body (used by the
// page's "show a different angle" button) — item ids already shown to this
// reader that Claude should avoid repeating unless nothing else fits.

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Read (rather than `import ... with { type: "json" }`) so this doesn't
// depend on a specific Node version's support for JSON import attributes —
// Netlify's Functions runtime version can change independently of this code.
// NOTE: not named `__dirname` — Netlify's esbuild bundler injects its own
// `__dirname` shim into bundled ESM functions, and a second `const
// __dirname` at module scope collides with it ("Identifier '__dirname' has
// already been declared"). Own name, no collision.
const moduleDir = dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(readFileSync(join(moduleDir, "lib", "practice-corpus.json"), "utf8"));

const MODEL = "claude-sonnet-5";
const MAX_INPUT_CHARS = 3000;
const MIN_INPUT_CHARS = 8;

// Approved copy (19 Aug 2026) — combination of two drafted options, chosen
// and adjusted by Neil.
const POLITE_STOP_FALLBACK =
  "Thanks for sharing that. It's just outside what this particular library " +
  "is built to help with — these cards cover practical technology-and-life " +
  "territory, attention, identity, digital safety, work, meaning, not " +
  "everything a person might be carrying. That's not a judgement on the " +
  "situation, just an honest limit on what this tool can actually do. If " +
  "it's something more personal or urgent, a professional or someone you " +
  "trust is the better next step.";

const NO_GROUNDED_PLAN_MESSAGE =
  "I wasn't able to put together a plan grounded in real cards for this one. " +
  "Try describing the situation a little more concretely, or browse the " +
  "collection directly.";

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    ...extra,
  };
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: corsHeaders() });
}

// Claude is asked for strict JSON but models occasionally wrap it in prose
// or a fenced code block — this pulls the first {...} or [...] out safely.
function extractJSON(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function runScopeCheck(anthropic, situation) {
  const categoryList = [
    "attention & focus", "identity & reputation", "security & digital safety",
    "persuasion & misinformation", "AI & algorithmic ethics",
    "governance & institutions", "work & economic change",
    "relationships & intimacy in a digital age", "meaning & reinvention",
    "wellbeing & mental load from digital life",
    "organisational / design leadership on technology", "civic & collective action",
  ].join(", ");

  const system =
    "You are a scope classifier for a practical reference library called " +
    "The Practice Library. The library covers these themes only: " + categoryList + ". " +
    "It offers concrete practices, not therapy, medical, legal, or financial advice, " +
    "and not crisis support. Given a reader's free-text description of a challenge, " +
    "decide whether the library's actual subject matter can meaningfully help. " +
    "Answer strictly as JSON: {\"in_scope\": true|false, \"reason\": \"one short " +
    "clause, internal use only\"}. Mark in_scope false for: topics unrelated to " +
    "technology/self/organisations/society (e.g. recipes, unrelated trivia); " +
    "requests that actually need professional medical, legal, financial, or " +
    "mental-health support rather than reference material; and anything where " +
    "the reader appears to be in crisis or distress, since this tool is not " +
    "equipped for that. When genuinely unsure, prefer true only if the library's " +
    "listed themes clearly apply.";

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    system,
    messages: [{ role: "user", content: situation }],
  });

  const text = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
  const parsed = extractJSON(text);
  if (!parsed || typeof parsed.in_scope !== "boolean") {
    // Fail closed on an unparseable classification — better a false decline
    // than an ungrounded pass-through.
    return { in_scope: false, reason: "classification_unparseable" };
  }
  return parsed;
}

async function runPlanGeneration(anthropic, situation, excludeIds = []) {
  const itemsForPrompt = corpus.items.map(i => ({
    id: i.id, card: i.card, book: i.book, type: i.type, aud: i.aud,
    lead: i.lead, body: i.body, tag: i.tag, tag2: i.tag2,
  }));

  const excludeNote = excludeIds.length
    ? "\n\nThe reader has already seen this plan once and asked for a " +
      "different angle. These item ids were already shown — avoid repeating " +
      "them unless nothing else in the list genuinely fits the situation, in " +
      "which case it's fine to reuse one rather than force a worse match: " +
      JSON.stringify(excludeIds)
    : "";

  const system =
    "You write short, grounded personal plans for The Practice Library, drawn " +
    "from Neil Catton's trilogy on technology, ethics, and human purpose. " +
    "Voice: thoughtful, direct, unhurried. Confident without arrogant, serious " +
    "without heavy — a conversation with someone who has thought about this and " +
    "wants to help, not a listicle or a consultancy deck. The core conviction " +
    "behind the material: the problem is almost always systemic, not personal " +
    "failure — write accordingly, don't imply the reader is doing something wrong.\n\n" +
    "You will be given the reader's own description of their situation and the " +
    "complete list of real, published items currently available in the library " +
    "(each with a stable id). You must select ONLY from this list — never invent " +
    "an item, a card, or advice not present in it. Choose 3 to 6 items that " +
    "genuinely fit the situation (fewer is better than padding). For each, " +
    "write one or two sentences on why it applies to THIS reader's situation " +
    "specifically, in your own words — not a copy of the lead/body text." +
    excludeNote + "\n\n" +
    "Respond with strict JSON only, no prose outside it, no markdown fences:\n" +
    "{\"summary\": \"2-3 sentence framing of the situation, in voice\", " +
    "\"selections\": [{\"id\": \"<exact item id from the list>\", \"why\": \"...\"}], " +
    "\"closing\": \"1-2 sentence closing thought, in voice, no rallying-cry energy\"}\n\n" +
    "Every \"id\" must be copied exactly from the provided list. If nothing in " +
    "the list genuinely fits, return an empty selections array rather than " +
    "forcing a weak match.\n\nLIBRARY ITEMS:\n" + JSON.stringify(itemsForPrompt);

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: situation }],
  });

  const text = res.content.map(b => (b.type === "text" ? b.text : "")).join("");
  return extractJSON(text);
}

function validateAndEnrich(planJSON) {
  if (!planJSON || !Array.isArray(planJSON.selections)) return null;

  const byId = new Map(corpus.items.map(i => [i.id, i]));
  const cardsById = new Map(corpus.cards.map(c => [c.card_id, c]));

  const grounded = [];
  for (const sel of planJSON.selections) {
    if (!sel || typeof sel.id !== "string") continue;
    const item = byId.get(sel.id);
    if (!item) continue; // hard rule: drop anything that doesn't resolve to a real item
    const card = cardsById.get(item.card_id);
    grounded.push({
      id: item.id,
      why: typeof sel.why === "string" ? sel.why : "",
      lead: item.lead,
      body: item.body,
      card_title: item.card,
      book: item.book,
      link: card ? card.link : null,
      date: card ? card.date : null,
    });
  }

  return {
    summary: typeof planJSON.summary === "string" ? planJSON.summary : "",
    closing: typeof planJSON.closing === "string" ? planJSON.closing : "",
    items: grounded,
    dropped_count: planJSON.selections.length - grounded.length,
  };
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 200, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "POST only" }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  const situation = typeof body?.situation === "string" ? body.situation.trim() : "";
  if (situation.length < MIN_INPUT_CHARS) {
    return jsonResponse({ status: "error", message: "Tell me a bit more about the situation." }, 400);
  }
  if (situation.length > MAX_INPUT_CHARS) {
    return jsonResponse({ status: "error", message: "That's a lot — could you say it in a couple of sentences?" }, 400);
  }

  // Defensive: only ever a small array of strings, ignore anything else
  // rather than error — this is a UX nicety (better "different angle"
  // results), not something the citation validation step depends on.
  const excludeIds = Array.isArray(body?.exclude_ids)
    ? body.exclude_ids.filter(id => typeof id === "string").slice(0, 20)
    : [];

  const encoder = new TextEncoder();

  const body_stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropic = new Anthropic();

        const scope = await runScopeCheck(anthropic, situation);
        if (!scope.in_scope) {
          controller.enqueue(encoder.encode(JSON.stringify({
            status: "declined",
            message: POLITE_STOP_FALLBACK,
          })));
          controller.close();
          return;
        }

        const planJSON = await runPlanGeneration(anthropic, situation, excludeIds);
        const plan = validateAndEnrich(planJSON);

        if (!plan || plan.items.length === 0) {
          controller.enqueue(encoder.encode(JSON.stringify({
            status: "no_match",
            message: NO_GROUNDED_PLAN_MESSAGE,
          })));
          controller.close();
          return;
        }

        controller.enqueue(encoder.encode(JSON.stringify({
          status: "ok",
          plan,
        })));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode(JSON.stringify({
          status: "error",
          message: "Something went wrong generating the plan. Please try again.",
          detail: String(err && err.message || err),
        })));
        controller.close();
      }
    },
  });

  return new Response(body_stream, { status: 200, headers: corsHeaders() });
};
