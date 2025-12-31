/**
 * Senal Tech - Ultimate Media Scraper Engine v2.0
 * movie tv series cartoons ultimate
 * 
 * VERCEL DEPLOYMENT REQUIREMENTS:
 * 1. File must be saved as: api/index.js
 * 2. Root directory must have: vercel.json
 */
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://cinesubz.co';

app.use(cors());
app.use(express.json());

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Referer': BASE_URL
};

/**
 * Sonic Cloud Transformation Engine
 */
const urlMappings = [
  { search: ['https://google.com/server11/1:/', 'https://google.com/server12/1:/'], replace: 'https://cloud.sonic-cloud.online/server1/' },
  { search: ['https://google.com/server21/1:/', 'https://google.com/server22/1:/'], replace: 'https://cloud.sonic-cloud.online/server2/' }
];

function transformUrl(raw) {
  if (!raw || raw.startsWith('#')) return '';
  let finalUrl = raw;
  for (const mapping of urlMappings) {
    for (const pattern of mapping.search) {
      if (finalUrl.startsWith(pattern)) {
        finalUrl = finalUrl.replace(pattern, mapping.replace);
        break;
      }
    }
  }
  if (finalUrl.includes('sonic-cloud.online')) {
    finalUrl = finalUrl.replace(/.mp4(?|$)/, '?ext=mp4').replace(/.mkv(?|$)/, '?ext=mkv');
    finalUrl = finalUrl.replace('??', '?').replace('?ext=', '&ext=');
    if (!finalUrl.includes('?') && finalUrl.includes('&')) finalUrl = finalUrl.replace('&', '?');
  }
  return finalUrl;
}

// ENDPOINTS
app.get('/health', async (req, res) => {
  res.json({ success: true, engine: "Senal Tech v2.0", status: "Operational", time: new Date().toISOString() });
});

app.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Query 'q' is required" });
    const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(q)}`, { headers });
    const $ = cheerio.load(data);
    const results = [];
    $('.item-box, .result-item, article').each((_, el) => {
      const $el = $(el);
      const title = $el.find('h1, h2, h3, .title').first().text().trim();
      const url = $el.find('a').first().attr('href');
      const poster = $el.find('img').first().attr('src') || $el.find('img').attr('data-src');
      if (title && url) {
        results.push({
          title,
          type: url.includes('/tvshows/') ? 'tvshow' : 'movie',
          poster_url: poster,
          movie_url: url
        });
      }
    });
    res.json({ success: true, count: results.length, results });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/details', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const download_links = [];
    $('a').each((_, el) => {
      const h = $(el).attr('href') || '';
      const t = $(el).text().trim();
      if (h.includes('/api-') || h.includes('/links/') || t.match(/\d+p/i)) {
        download_links.push({ quality: t.match(/\d+p/i)?.[0] || 'HD', countdown_url: h });
      }
    });
    res.json({
      success: true,
      data: {
        title: $('.entry-title, .sheader h1').first().text().trim(),
        description: $('.wp-content p').first().text().trim(),
        download_links: [...new Map(download_links.map(d => [d.countdown_url, d])).values()]
      }
    });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/download', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL is required" });
    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const resolved = [];
    $('a').each((_, el) => {
      const h = $(el).attr('href') || '';
      if (h.includes('sonic-cloud.online') || h.includes('google.com/server')) {
        resolved.push({ label: $(el).text().trim() || "Cloud Stream", download_url: transformUrl(h) });
      }
    });
    res.json({ success: true, count: resolved.length, download_options: resolved });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

// VERCEL EXPORT
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Running on ${PORT}`));
}
