// Netlify serverless function — fetches the Practice Library section feed
// from Substack and returns JSON, including each card's image.
// Companion to substack-feed.js (the main publication feed).
//
// The section is now live at https://writing.neilcatton.com/s/the-practice-library
// (nothing published to it yet). IMPORTANT: FEED_URL below still points at
// the main publication feed, not the section feed. Substack exposes section
// feeds at https://writing.neilcatton.com/feed/sections/<section-id> — the
// id is visible in the section's settings in the Substack dashboard, or in
// the RSS autodiscovery link on the section page once at least one post is
// live. Grab the exact URL and swap it in below when the first card is
// published. Until then this falls back to the main publication feed, which
// is harmless: the page merges feed items with data/practice-library.json
// and the front-end guard only accepts feed items titled "How To…", so
// nothing from the main feed leaks onto the Practice Library page.

const https = require("https");

// TODO(Neil): replace with the Practice Library section feed URL once the
// first card is published — see note above.
const FEED_URL = "https://writing.neilcatton.com/feed";

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NeilCattonSite/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
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

function parseXML(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const get = (tag) => {
      const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`).exec(block);
      if (cdata) return cdata[1].trim();
      const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return plain ? plain[1].trim() : "";
    };

    let link = get("link");
    if (!link) {
      const linkMatch = /<link\s*\/>([^<]+)/.exec(block) || /<link>([^<]+)/.exec(block);
      link = linkMatch ? linkMatch[1].trim() : "";
    }

    const title = get("title");
    const pubDate = get("pubDate");
    const description = get("description");

    // Card image: prefer the RSS enclosure, fall back to the first <img>
    // in the post body — Substack sets the enclosure to the post's cover
    // image, which for a Practice Library post is the card itself.
    let image = "";
    const enclosure = /<enclosure[^>]*url="([^"]+)"/.exec(block);
    if (enclosure) {
      image = enclosure[1];
    } else {
      const body = get("content:encoded") || description;
      const img = /<img[^>]*src="([^"]+)"/.exec(body);
      if (img) image = img[1];
    }

    const excerpt = description
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    if (title && link) {
      items.push({ title, link, pubDate, excerpt, image });
    }
  }

  return items;
}

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
    const items = parseXML(xml);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: items.slice(0, 30) })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
