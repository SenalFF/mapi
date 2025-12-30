const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const BASE_URL = 'https://cinesubz.co';

const API_INFO = {
  developer: 'Mr Senal',
  version: 'v1',
  api_name: 'CineSubz Movie Downloader API'
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    ...API_INFO,
    status: 'online',
    endpoints: {
      search: '/search?q={query}',
      details: '/details?url={url}',
      episodes: '/episodes?url={url}',
      download: '/download?url={url}'
    }
  });
});

// Search endpoint
app.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing query parameter' });

    const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(q)}`, { 
      headers,
      timeout: 8000 
    });
    
    const $ = cheerio.load(data);
    const results = [];

    $('.item-box, article').each((i, el) => {
      if (i >= 10) return false; // Limit to 10 results
      const $item = $(el);
      const title = $item.find('.title, h3 a').first().text().trim();
      const url = $item.find('a').first().attr('href');
      const poster = $item.find('img').first().attr('src');
      
      if (title && url && url.includes('cinesubz')) {
        results.push({
          title,
          type: url.includes('/tvshows/') ? 'tvshow' : 'movie',
          quality: $item.find('.badge-quality-corner').text().trim() || 'N/A',
          rating: $item.find('.imdb-score, .rating').text().trim() || 'N/A',
          poster_url: poster || null,
          movie_url: url
        });
      }
    });

    res.json({
      ...API_INFO,
      query: q,
      total_results: results.length,
      results
    });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// Details endpoint
app.get('/details', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const { data } = await axios.get(url, { headers, timeout: 8000 });
    const $ = cheerio.load(data);

    const title = $('meta[itemprop="name"]').attr('content') || 
                  $('.sheader h1').text().trim() || 
                  $('h1').first().text().trim();
    
    const poster = $('meta[property="og:image"]').attr('content') || 
                   $('.poster img').first().attr('src');
    
    const description = $('meta[name="description"]').attr('content') || 
                        $('.wp-content p').first().text().trim();
    
    const year = $('meta[itemprop="dateCreated"]').attr('content')?.match(/\d{4}/)?.[0] || 
                 $('.date').text().trim();
    
    const rating = $('.imdb-score, .rating').text().trim();
    const genres = [];
    $('.sgeneros a, .genre-list a').each((i, el) => genres.push($(el).text().trim()));

    const downloadLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && href.includes('/api-') && text.match(/(480p|720p|1080p)/i)) {
        downloadLinks.push({
          quality: text.match(/(480p|720p|1080p)/i)?.[1] || 'Unknown',
          size: text.match(/(\d+\.?\d*\s*(?:GB|MB))/i)?.[1] || 'N/A',
          countdown_url: href
        });
      }
    });

    res.json({
      ...API_INFO,
      movie_info: {
        title: title || 'N/A',
        type: url.includes('/movies/') ? 'movie' : 'tvshow',
        year: year || 'N/A',
        rating: rating || 'N/A',
        genres: genres.length > 0 ? genres : ['N/A'],
        description: description || 'N/A'
      },
      poster_url: poster || null,
      movie_url: url,
      download_links: downloadLinks
    });
  } catch (error) {
    console.error('Details error:', error.message);
    res.status(500).json({ error: 'Failed to get details', message: error.message });
  }
});

// Episodes endpoint
app.get('/episodes', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const { data } = await axios.get(url, { headers, timeout: 8000 });
    const $ = cheerio.load(data);

    const seasons = [];
    $('#seasons .se-c').each((i, el) => {
      const $season = $(el);
      const episodes = [];
      
      $season.find('.se-a ul li').each((j, epEl) => {
        const $ep = $(epEl);
        const epUrl = $ep.find('a').attr('href');
        if (epUrl) {
          episodes.push({
            episode: $ep.find('.numerando').text().trim(),
            title: $ep.find('.episodiotitle a').text().trim(),
            url: epUrl
          });
        }
      });

      if (episodes.length > 0) {
        seasons.push({
          season: $season.find('.se-t').text().trim(),
          episodeCount: episodes.length,
          episodes
        });
      }
    });

    res.json({
      ...API_INFO,
      url,
      seasonCount: seasons.length,
      seasons
    });
  } catch (error) {
    console.error('Episodes error:', error.message);
    res.status(500).json({ error: 'Failed to get episodes', message: error.message });
  }
});

// URL transformation function
function transformDownloadUrl(url) {
  let modified = url;
  const mappings = [
    { from: 'https://google.com/server11/1:/', to: 'https://cloud.sonic-cloud.online/server1/' },
    { from: 'https://google.com/server12/1:/', to: 'https://cloud.sonic-cloud.online/server1/' },
    { from: 'https://google.com/server21/1:/', to: 'https://cloud.sonic-cloud.online/server2/' }
  ];

  for (const map of mappings) {
    if (url.includes(map.from)) {
      modified = url.replace(map.from, map.to);
      if (modified.includes('.mp4')) {
        modified = modified.replace('.mp4', '?ext=mp4');
      } else if (modified.includes('.mkv')) {
        modified = modified.replace('.mkv', '?ext=mkv');
      }
      break;
    }
  }
  
  return modified;
}

// Download endpoint - optimized for speed
app.get('/download', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url parameter' });

    const { data } = await axios.get(url, { 
      headers, 
      timeout: 8000,
      maxRedirects: 3
    });
    
    const $ = cheerio.load(data);
    
    // Extract direct download link
    const linkElement = $('#link');
    const rawLink = linkElement.attr('href');
    
    if (!rawLink || !rawLink.includes('google.com/server')) {
      return res.json({
        ...API_INFO,
        success: false,
        countdown_url: url,
        message: 'Could not extract download link. Please visit the countdown page directly.'
      });
    }

    const directUrl = transformDownloadUrl(rawLink);
    const bodyText = $('body').text();
    const fileName = bodyText.match(/CineSubz\.com[^\n]+\.(mp4|mkv)/)?.[0] || 'video.mp4';
    const fileSize = bodyText.match(/(\d+\.?\d*\s*(?:GB|MB))/i)?.[1] || 'Unknown';

    res.json({
      ...API_INFO,
      success: true,
      countdown_url: url,
      raw_link: rawLink,
      download_url: directUrl,
      file_info: {
        name: fileName,
        size: fileSize
      }
    });
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ 
      error: 'Failed to resolve download link', 
      message: error.message 
    });
  }
});

// Export for Vercel
module.exports = app;

// For local testing
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
  });
      }
