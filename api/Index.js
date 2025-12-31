/**
 * Senal Tech - Ultimate Media Scraper Engine v2.0
 * movie tv series cartoons ultimate
 * 
 * VERCEL DEPLOYMENT:
 * Save this file as: /api/index.js
 */
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const BASE_URL = 'https://cinesubz.co';

app.use(cors());
app.use(express.json());

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': BASE_URL
};

/**
 * Sonic Cloud Resolver
 * Maps legacy storage nodes to active high-speed cloud mirrors.
 */
function resolveMirror(url) {
  if (!url) return '';
  let final = url;
  const maps = [
    { from: 'google.com/server1', to: 'cloud.sonic-cloud.online/server1' },
    { from: 'google.com/server2', to: 'cloud.sonic-cloud.online/server2' },
    { from: 'google.com/server3', to: 'cloud.sonic-cloud.online/server3' }
  ];
  
  maps.forEach(m => {
    if (final.includes(m.from)) final = final.replace(m.from, m.to);
  });

  if (final.includes('sonic-cloud.online')) {
    final = final.replace(/.mp4($|?)/, '?ext=mp4').replace(/.mkv($|?)/, '?ext=mkv');
  }
  return final;
}

// --- API ROUTES ---

// 1. Health Check
app.get('/health', (req, res) => {
  res.json({ success: true, status: "Engine Operational", version: "2.0" });
});

// 2. Search (Movies, Series, Cartoons)
app.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: "Search query 'q' is required" });
    
    const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(q)}`, { headers });
    const $ = cheerio.load(data);
    const results = [];

    $('.item-box, article, .result-item').each((_, el) => {
      const title = $(el).find('h1, h2, h3, .title').first().text().trim();
      const url = $(el).find('a').first().attr('href');
      const poster = $(el).find('img').first().attr('src') || $(el).find('img').attr('data-src');
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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Details & Quality Links
app.get('/details', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL parameter is required" });

    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const download_links = [];

    $('a').each((_, el) => {
      const h = $(el).attr('href') || '';
      const t = $(el).text().trim();
      if (h.includes('/api-') || h.includes('/links/') || t.match(/\d+p/i)) {
        download_links.push({
          quality: t.match(/\d+p/i)?.[0] || 'HD',
          countdown_url: h
        });
      }
    });

    res.json({
      success: true,
      data: {
        title: $('.entry-title, .sheader h1').first().text().trim(),
        description: $('.wp-content p').first().text().trim() || "No description available.",
        download_links: [...new Map(download_links.map(item => [item.countdown_url, item])).values()]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Download Resolver
app.get('/download', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "URL parameter is required" });

    const { data } = await axios.get(url, { headers });
    const $ = cheerio.load(data);
    const options = [];

    $('a').each((_, el) => {
      const h = $(el).attr('href') || '';
      const t = $(el).text().trim().toLowerCase();
      if (h.includes('sonic-cloud.online') || h.includes('google.com/server') || $(el).attr('id') === 'link') {
        options.push({
          label: t.includes('sonic') ? "Sonic Cloud" : "Direct Mirror",
          download_url: resolveMirror(h)
        });
      }
    });

    res.json({ success: options.length > 0, count: options.length, download_options: options });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// IMPORTANT FOR VERCEL: Export the app instance
module.exports = app;

// Local test runner
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Senal Tech Local Engine: http://localhost:${PORT}`));
          }
