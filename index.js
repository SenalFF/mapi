/**
 * CineSubz Vercel-Ready API Engine (v2.0)
 * ---------------------------------------
 * Root Endpoints: /search, /details, /extract
 * Features: Absolute Image Fixing, Bot-Friendly Output, Vercel Serverless.
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
};

// URL mapping config for link resolution
const URL_MAPPINGS = [
  { search: ['https://google.com/server11/1:/'], replace: 'https://cloud.sonic-cloud.online/server1/' },
  { search: ['https://google.com/server21/1:/'], replace: 'https://cloud.sonic-cloud.online/server2/' },
  { search: ['https://google.com/server3/1:/'], replace: 'https://cloud.sonic-cloud.online/server3/' }
];

/**
 * Ensures images and URLs are absolute and fixed
 */
const fixUrl = (url, base = 'https://cinesubz.co') => {
  if (!url) return '';
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return base + url;
  return url;
};

function transformDownloadUrl(url) {
  if (!url) return url;
  let modifiedUrl = url;
  let isSonic = false;
  for (const mapping of URL_MAPPINGS) {
    for (const searchStr of mapping.search) {
      if (modifiedUrl.includes(searchStr)) {
        modifiedUrl = modifiedUrl.replace(searchStr, mapping.replace);
        isSonic = true; break;
      }
    }
    if (isSonic) break;
  }
  if (isSonic) {
    modifiedUrl = modifiedUrl.replace(".mp4", "?ext=mp4").replace(".mkv", "?ext=mkv");
  }
  return modifiedUrl;
}

/**
 * ROOT ENDPOINTS
 */

// 1. SEARCH
app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query required' });
  try {
    const { data } = await axios.get(`https://cinesubz.co/?s=${encodeURIComponent(q)}`, { headers: HEADERS });
    const $ = cheerio.load(data);
    const results = [];

    $('.result-item').each((_, el) => {
      const $item = $(el);
      results.push({
        title: $item.find('.title a').text().trim(),
        url: fixUrl($item.find('.title a').attr('href')),
        poster: fixUrl($item.find('.thumbnail img').attr('src')),
        type: $item.find('.type').text().trim().toLowerCase() || 'movie',
        year: $item.find('.year').text().trim()
      });
    });

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// 2. DETAILS (With Bot Friendly Formatting)
app.get('/details', async (req, res) => {
  const { url, format } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const { data } = await axios.get(url, { headers: HEADERS });
    const $ = cheerio.load(data);

    const title = $('.data h1').text().trim();
    const poster = fixUrl($('.poster img').attr('src'));
    const plot = $('.wp-content p').first().text().trim();
    const qualities = [];

    $('.res-options a, .download-links a').each((_, el) => {
      const $btn = $(el);
      const label = $btn.text().trim();
      qualities.push({
        quality: label.match(/(\d+p)/i)?.[1] || 'HD',
        size: label.match(/(\d+\.?\d*\s*(?:GB|MB))/i)?.[1] || 'N/A',
        url: fixUrl($btn.attr('href'))
      });
    });

    // WhatsApp Bot Format
    if (format === 'bot') {
      let text = `*🎬 ${title.toUpperCase()}*\n\n`;
      text += `⭐ Info: ${$('.rating').text().trim() || 'N/A'}\n`;
      text += `🎭 Genres: ${$('.genres').text().trim() || 'N/A'}\n\n`;
      text += `*⬇️ DOWNLOADS:*\n`;
      qualities.forEach(q => {
        text += `• ${q.quality} (${q.size}): ${q.url}\n`;
      });
      return res.send(text);
    }

    res.json({ title, plot, poster, qualities });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

// 3. EXTRACT
app.get('/extract', async (req, res) => {
  const { url } = req.query;
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 8000 });
    const $ = cheerio.load(data);
    const options = [];
    $('a').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      if (!href || href.startsWith('#')) return;
      const type = $a.attr('id') === 'link' ? 'direct' : 'mirror';
      options.push({
        type,
        label: $a.text().trim(),
        url: type === 'direct' ? transformDownloadUrl(href) : href
      });
    });
    res.json({ success: options.length > 0, download_options: options });
  } catch (error) {
    res.status(500).json({ error: 'Extraction failed' });
  }
});

// For Vercel Serverless
module.exports = app;
