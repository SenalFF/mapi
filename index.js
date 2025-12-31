/**
 * CineSubz Full Movie API Server (Search + Details + Extraction)
 * Features:
 * - /api/v1/search?q=query (Search for Movies/TV)
 * - /api/v1/details?url=link (Get info, poster, and qualities)
 * - /api/v1/extract?url=link (Resolve direct links from countdown)
 */

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 5000;

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
};

// URL mapping config
const URL_MAPPINGS = [
  { search: ['https://google.com/server11/1:/', 'https://google.com/server12/1:/', 'https://google.com/server13/1:/'], replace: 'https://cloud.sonic-cloud.online/server1/' },
  { search: ['https://google.com/server21/1:/', 'https://google.com/server22/1:/', 'https://google.com/server23/1:/'], replace: 'https://cloud.sonic-cloud.online/server2/' },
  { search: ['https://google.com/server3/1:/'], replace: 'https://cloud.sonic-cloud.online/server3/' },
  { search: ['https://google.com/server4/1:/'], replace: 'https://cloud.sonic-cloud.online/server4/' },
  { search: ['https://google.com/server5/1:/'], replace: 'https://cloud.sonic-cloud.online/server5/' }
];

function transformDownloadUrl(url) {
  if (!url) return url;
  let modifiedUrl = url;
  let isSonicCloud = false;

  for (const mapping of URL_MAPPINGS) {
    for (const searchStr of mapping.search) {
      if (modifiedUrl.includes(searchStr)) {
        modifiedUrl = modifiedUrl.replace(searchStr, mapping.replace);
        isSonicCloud = true; break;
      }
    }
    if (isSonicCloud) break;
  }

  if (isSonicCloud) {
    const patterns = [
      { find: ".mp4?bot=cscloud2bot&code=", replace: "?ext=mp4&bot=cscloud2bot&code=" },
      { find: ".mp4", replace: "?ext=mp4" },
      { find: ".mkv?bot=cscloud2bot&code=", replace: "?ext=mkv&bot=cscloud2bot&code=" },
      { find: ".mkv", replace: "?ext=mkv" },
      { find: ".zip", replace: "?ext=zip" }
    ];
    for (const p of patterns) {
      if (modifiedUrl.includes(p.find)) {
        modifiedUrl = modifiedUrl.replace(p.find, p.replace); break;
      }
    }
  }
  return modifiedUrl;
}

/**
 * 1. SEARCH ENDPOINT
 */
app.get('/api/v1/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Search query required' });
  try {
    const response = await axios.get(`https://cinesubz.co/?s=${encodeURIComponent(q)}`, { headers });
    const $ = cheerio.load(response.data);
    const results = [];

    $('.result-item').each((_, el) => {
      const $item = $(el);
      results.push({
        title: $item.find('.title a').text().trim(),
        url: $item.find('.title a').attr('href'),
        poster: $item.find('.thumbnail img').attr('src'),
        type: $item.find('.type').text().toLowerCase() || 'movie',
        year: $item.find('.year').text().trim()
      });
    });

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * 2. DETAILS ENDPOINT
 */
app.get('/api/v1/details', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });
  try {
    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const qualities = [];
    // WordPress/Zetaflix specific: scrape download buttons
    $('.res-options a, .download-links a').each((_, el) => {
      const $btn = $(el);
      const label = $btn.text().trim(); // e.g. "720p (2.1GB)"
      const sizeMatch = label.match(/(\d+\.?\d*\s*(?:GB|MB))/i);
      const qualityMatch = label.match(/(\d+p)/i);

      qualities.push({
        quality: qualityMatch ? qualityMatch[1] : 'Unknown',
        size: sizeMatch ? sizeMatch[1] : 'Unknown',
        format: label.toLowerCase().includes('mkv') ? 'MKV' : 'MP4',
        url: $btn.attr('href')
      });
    });

    res.json({
      title: $('.data h1').text().trim(),
      plot: $('.wp-content p').first().text().trim(),
      poster: $('.poster img').attr('src'),
      info: {
        release_date: $('.date').text().trim(),
        runtime: $('.runtime').text().trim(),
        rating: $('.rating').text().trim()
      },
      qualities
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch details' });
  }
});

/**
 * 3. EXTRACTION ENDPOINT
 */
app.get('/api/v1/extract', async (req, res) => {
  const { url } = req.query;
  try {
    const response = await axios.get(url, { headers, timeout: 10000 });
    const $ = cheerio.load(response.data);
    const options = [];

    $('a').each((_, el) => {
      const $a = $(el);
      const href = $a.attr('href');
      const label = $a.text().trim();
      const id = $a.attr('id');

      if (!href || href.startsWith('#')) return;

      const type = id === 'link' ? 'direct' : 'mirror';
      options.push({
        type: type,
        label: label || (type === 'direct' ? 'Main Download' : 'Mirror'),
        raw_url: href,
        download_url: type === 'direct' ? transformDownloadUrl(href) : href
      });
    });

    res.json({
      success: options.length > 0,
      download_options: options,
      file_info: {
        name: $('title').text().replace('CineSubz.com - ', '').trim(),
        size: $('body').text().match(/(\d+\.?\d*\s*(?:GB|MB))/i)?.[1] || 'N/A'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Extraction engine failure' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
