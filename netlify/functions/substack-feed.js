// Netlify serverless function — fetches Substack RSS and returns JSON
// No CORS issues — runs server-side on Netlify's infrastructure
// Deploy: place this file at netlify/functions/substack-feed.js in your repo

const https = require("https");

const FEED_URL = "https://writing.neilcatton.com/feed";

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NeilCattonSite/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*"
      }
    }, (res) => {
      // Follow redirects
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
  // Simple regex-based RSS parser — no dependencies needed
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const get = (tag) => {
      // Handle CDATA
      const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`).exec(block);
      if (cdata) return cdata[1].trim();
      // Plain text
      const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return plain ? plain[1].trim() : "";
    };

    // Substack puts link as text node between tags with no closing tag in some feeds
    let link = get("link");
    if (!link) {
      const linkMatch = /<link\s*\/>([^<]+)/.exec(block) || /<link>([^<]+)/.exec(block);
      link = linkMatch ? linkMatch[1].trim() : "";
    }

    const title = get("title");
    const pubDate = get("pubDate");
    const description = get("description");

    // Strip HTML from description for excerpt
    const excerpt = description
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200);

    if (title && link) {
      items.push({ title, link, pubDate, excerpt });
    }
  }

  return items;
}

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, s-maxage=900" // cache for 15 mins
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const xml = await fetchURL(FEED_URL);
    const items = parseXML(xml);

    if (!items.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: "No items parsed", items: [] })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: items.slice(0, 20) })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
