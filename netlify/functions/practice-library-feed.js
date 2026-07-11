// Netlify serverless function — returns the Practice Library cards as JSON.
// Companion to substack-feed.js (the main publication feed).
//
// Why the JSON API and not RSS: Substack does not expose a working RSS feed
// per section on this publication (verified 2026-07-11 — both
// /s/the-practice-library/feed and /feed/sections/419813 return nothing).
// The publication's JSON API does carry the section id on every post, so
// this function fetches /api/v1/posts and filters to the Practice Library
// section. It also returns the post's cover image directly, which is the
// card PNG — better than scraping it out of RSS HTML.
//
// SECTION_ID 419813 = the-practice-library (confirmed from the API on
// 2026-07-11, first card post). If the section is ever deleted and
// recreated, the id changes — re-check via
// https://writing.neilcatton.com/api/v1/posts?limit=3 (section_id field).

const https = require("https");

const API_URL = "https://writing.neilcatton.com/api/v1/posts?limit=50&offset=0";
const SECTION_ID = 419813;

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
    const raw = await fetchURL(API_URL);
    const posts = JSON.parse(raw);

    const items = (Array.isArray(posts) ? posts : [])
      .filter(p => p.section_id === SECTION_ID && p.audience === "everyone")
      .map(p => ({
        title:   p.title || "Untitled",
        link:    p.canonical_url || "",
        pubDate: p.post_date || "",
        excerpt: (p.subtitle || "").slice(0, 200),
        image:   p.cover_image || ""
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
