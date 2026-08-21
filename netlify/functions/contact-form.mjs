// Netlify Function — receives both of the site's contact forms
// (contact.html's full enquiry form and the homepage's shorter one) and
// sends the message as an email via Microsoft Graph, using Neil's own
// Microsoft 365 mailbox. Replaces Formspree.
//
// Requires three Netlify environment variables (Site settings > Environment
// variables, or `netlify env:set`):
//
//   MSGRAPH_TENANT_ID      Entra ID (Azure AD) tenant ID or domain
//   MSGRAPH_CLIENT_ID      Application (client) ID of the app registration
//   MSGRAPH_CLIENT_SECRET  A client secret created for that app registration
//
// The app registration needs the Microsoft Graph *application* permission
// Mail.Send, with tenant admin consent granted — see the setup notes
// alongside this change. Mail is sent as, and delivered to, nc@neilcatton.com;
// the visitor's own address is set as replyTo so a reply goes straight back
// to them without CC'ing anyone else in.
//
// Routed via netlify.toml (from "/contact-submit" -> this function), NOT
// via this file's own `config.path` — the same pattern generate-plan.mjs
// uses, for the same reason: rate_limit is a redirects-only feature, so the
// friendly path needs to be a netlify.toml redirect for the rate limit
// block to attach to it. A function-declared path here as well would be
// redundant. A public POST endpoint that triggers a real send through
// Exchange Online (which has its own throttling) needs a floor under it
// regardless of Graph's own limits.
//
// Accepts two request shapes, so the form keeps degrading gracefully with
// JavaScript disabled exactly as it did pointed at Formspree:
//   - Content-Type: application/json                  (site.js's fetch path)
//   - Content-Type: application/x-www-form-urlencoded (a plain
//     <form method="post"> submit with no enctype set — the browser default
//     for a form with JavaScript not running)
// A JSON request gets a JSON response, which is what site.js's contact-form
// handler reads. A plain form submission has no script to read a JSON body,
// so it gets a 302 redirect back to the referring page with ?sent=1 or
// ?error=1 instead.

const MAILBOX = "nc@neilcatton.com";
const SENDMAIL_URL = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(MAILBOX)}/sendMail`;
const tokenURL = (tenant) => `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;

const MAX_LEN = { name: 200, organisation: 200, email: 254, enquiry_type: 40, subject: 200, message: 5000 };

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function redirectTo(url, status = 302) {
  return new Response(null, { status, headers: { Location: url } });
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

async function getGraphToken() {
  const tenant = process.env.MSGRAPH_TENANT_ID;
  const clientId = process.env.MSGRAPH_CLIENT_ID;
  const clientSecret = process.env.MSGRAPH_CLIENT_SECRET;
  if (!tenant || !clientId || !clientSecret) {
    throw new Error(
      "Microsoft Graph credentials are not configured — set MSGRAPH_TENANT_ID, " +
      "MSGRAPH_CLIENT_ID and MSGRAPH_CLIENT_SECRET in Netlify's environment variables."
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const res = await fetch(tokenURL(tenant), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph token request failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = await res.json();
  return json.access_token;
}

function buildMessage(fields) {
  const lines = [`A new enquiry came in through neilcatton.com.`, ``, `Name: ${fields.name}`];
  if (fields.organisation) lines.push(`Organisation: ${fields.organisation}`);
  lines.push(`Email: ${fields.email}`);
  if (fields.enquiry_type) lines.push(`Enquiry type: ${fields.enquiry_type}`);
  if (fields.subject) lines.push(`Subject: ${fields.subject}`);
  lines.push(``, `Message:`, fields.message);

  const subjectLine = fields.enquiry_type
    ? `Website enquiry (${fields.enquiry_type}) — ${fields.name}`
    : fields.subject
    ? `Website enquiry: ${fields.subject}`
    : `Website enquiry — ${fields.name}`;

  return {
    message: {
      subject: subjectLine,
      body: { contentType: "Text", content: lines.join("\n") },
      toRecipients: [{ emailAddress: { address: MAILBOX } }],
      replyTo: [{ emailAddress: { address: fields.email } }],
    },
    saveToSentItems: true,
  };
}

async function sendViaGraph(fields) {
  const token = await getGraphToken();
  const res = await fetch(SENDMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildMessage(fields)),
  });

  if (res.status !== 202) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Graph sendMail failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}

function validate(fields) {
  const errors = [];
  if (!fields.name) errors.push("Name is required.");
  if (!fields.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) errors.push("A valid email address is required.");
  if (!fields.message) errors.push("A message is required.");
  return errors;
}

export default async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ errors: [{ message: "POST only." }] }, 405);
  }

  const contentType = req.headers.get("content-type") || "";
  const isJSON = contentType.includes("application/json");
  const referer = req.headers.get("referer") || "/contact.html";

  let raw;
  try {
    raw = isJSON ? await req.json() : Object.fromEntries(new URLSearchParams(await req.text()));
  } catch {
    return isJSON
      ? jsonResponse({ errors: [{ message: "Invalid request." }] }, 400)
      : redirectTo(referer + "?error=1");
  }

  // Honeypot — Formspree's own convention (a field named _gotcha), kept as
  // the contract so the existing hidden field in both forms needs no
  // change. A filled trap gets a fake success: real visitors never see or
  // fill it, and a bot that does gets no signal its submission was caught.
  if (clean(raw._gotcha, 100)) {
    return isJSON ? jsonResponse({}, 200) : redirectTo(referer + "?sent=1");
  }

  const fields = {
    name: clean(raw.name, MAX_LEN.name),
    organisation: clean(raw.organisation, MAX_LEN.organisation),
    email: clean(raw.email, MAX_LEN.email),
    enquiry_type: clean(raw.enquiry_type, MAX_LEN.enquiry_type),
    subject: clean(raw.subject, MAX_LEN.subject),
    message: clean(raw.message, MAX_LEN.message),
  };

  const errors = validate(fields);
  if (errors.length) {
    return isJSON
      ? jsonResponse({ errors: errors.map((message) => ({ message })) }, 400)
      : redirectTo(referer + "?error=1");
  }

  try {
    await sendViaGraph(fields);
  } catch (err) {
    console.error("contact-form:", err.message);
    return isJSON
      ? jsonResponse({ errors: [{ message: "Something went wrong sending that." }] }, 502)
      : redirectTo(referer + "?error=1");
  }

  return isJSON ? jsonResponse({ ok: true }, 200) : redirectTo(referer + "?sent=1");
};
