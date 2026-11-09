// Netlify serverless function — returns recent Practice Library card posts as JSON.
// Companion to substack-feed.js (the main publication feed).
//
// Rewritten 2026-11-09. The previous version read /api/v1/posts and filtered
// on the section id. Two things broke that:
//   1. Substack changed /api/v1/posts to return { posts, nextCursor } and to
//      reject the `offset` parameter, so the old call returned HTTP 400.
//   2. The Practice Library section is now set to "Hide posts on homepage",
//      and hidden sections are left out of /api/v1/posts altogether.
// The publication RSS feed (/feed) still carries hidden-section posts, so this
// version reads that. RSS carries no section, so card posts are recognised by
// the card post format (OUTPUTS/InfoGraphics/post-format.md): the subtitle
// names the reader's moment ("For when …") or the body talks about "the card".
// The site only uses this for the "Not yet catalogued" list and the
// practice-library-sync skill matches titles exactly against the register,
// so an occasional false positive is harmless.
//
// Output shape is unchanged: { items: [{ title, link, pubDate, excerpt, image }] }.
// The image is the post's cover (the card PNG), taken from the RSS enclosure.

const https = require("https");

const FEED_URL = "https://writing.neilcatton.com/feed";

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NeilCattonSite/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml"
      }
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchURL(res.headers.location));
      }
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function field(item, tag) {
  const m = item.match(new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">"));
  if (!m) return "";
  return m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim();
}

function isCard(description, content) {
  return /^for when\b/i.test(description) || /\b(the|this) card\b/i.test(content);
}

function parse(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const it = m[1];
    const title = field(it, "title");
    const link = field(it, "link");
    const description = field(it, "description");
    const content = field(it, "content:encoded");
    const enc = it.match(/<enclosure[^>]*url="([^"]+)"/);
    if (!title || !link || !isCard(description, content)) continue;
    items.push({
      title,
      link,
      pubDate: field(it, "pubDate") ? new Date(field(it, "pubDate")).toISOString() : "",
      excerpt: description.slice(0, 200),
      image: enc ? enc[1] : ""
    });
  }
  return items;
}

exports.parse = parse;

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, s-maxage=900"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const xml = await fetchURL(FEED_URL);
    const items = parse(xml);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
