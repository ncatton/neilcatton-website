// Netlify serverless function — returns the full Substack post archive as JSON,
// for the site-wide search feature (search.js).
// Companion to substack-feed.js (which only returns the latest 20 posts for the
// "Latest essays" grid) and practice-library-feed.js (which filters to one section).
// This one is deliberately unfiltered by section, and paginates past Substack's
// per-request cap so search can reach the full archive, not just the newest page.

const https = require("https");

const PUB_API = "https://writing.neilcatton.com/api/v1/posts";
const PAGE_SIZE = 50;
const MAX_PAGES = 6; // safety cap — 300 posts, well beyond current archive size

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NeilCattonSite/1.0)",
        "Accept": "application/json"
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

async function fetchAllPosts() {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const url = `${PUB_API}?limit=${PAGE_SIZE}&offset=${offset}`;
    let raw;
    try {
      raw = await fetchURL(url);
    } catch (e) {
      break;
    }
    let posts;
    try {
      posts = JSON.parse(raw);
    } catch (e) {
      break;
    }
    if (!Array.isArray(posts) || posts.length === 0) break;
    all.push(...posts);
    if (posts.length < PAGE_SIZE) break; // reached the end of the archive
  }
  return all;
}

exports.handler = async function (event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, s-maxage=1800" // cache 30 mins — search data doesn't need to be as fresh as the live feed
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const posts = await fetchAllPosts();

    const items = posts
      .filter(p => p.audience === "everyone")
      .map(p => ({
        title: p.title || "Untitled",
        link: p.canonical_url || "",
        pubDate: p.post_date || p.published_at || "",
        excerpt: (p.subtitle || "").slice(0, 200)
      }))
      .filter(i => i.title && i.link);

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
