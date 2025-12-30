const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;
const BASE_URL = 'https://cinesubz.co';

const API_INFO = {
  developer: 'Mr Senal',
  version: 'v1',
  api_name: 'CineSubz Movie Downloader API'
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
};

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    developer: API_INFO.developer,
    version: API_INFO.version,
    api_name: API_INFO.api_name,
    endpoints: {
      search: {
        method: 'GET',
        path: '/search?q={query}',
        description: 'Search for movies/TV shows',
        example: '/search?q=avatar'
      },
      details: {
        method: 'GET',
        path: '/details?url={encoded_url}',
        description: 'Get movie/TV show details with download links',
        example: '/details?url=https://cinesubz.co/movies/batman-ninja-vs-yakuza-league-2025-sinhala-subtitles/'
      },
      episodes: {
        method: 'GET',
        path: '/episodes?url={encoded_url}',
        description: 'Get TV show episodes list',
        example: '/episodes?url=https://cinesubz.co/tvshows/the-witcher-2019-sinhala-sub/'
      },
      download: {
        method: 'GET',
        path: '/download?url={countdown_page_url}',
        description: 'Resolve countdown page to get final download links',
        example: '/download?url=https://cinesubz.co/api-.../odcemnd9hb/'
      }
    }
  });
});

app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Missing search query. Use ?q=movie_name' });
    }

    const searchUrl = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { headers });
    const $ = cheerio.load(response.data);

    const results = [];

    $('.item-box, .display-item').each((i, el) => {
      const $item = $(el);
      const title = $item.find('.item-desc-title, .title').text().trim();
      const url = $item.find('a').first().attr('href');
      const poster = $item.find('.thumb img, .mli-thumb img, img').first().attr('src') || 
                     $item.find('img').attr('data-src');
      const rating = $item.find('.imdb-score, .rating1').text().trim();
      const quality = $item.find('.badge-quality-corner').text().trim();
      const type = url && url.includes('/tvshows/') ? 'tvshow' : 
                   url && url.includes('/movies/') ? 'movie' : 'unknown';

      if (title && url) {
        results.push({
          title,
          url,
          poster,
          rating,
          quality,
          type
        });
      }
    });

    if (results.length === 0) {
      $('.result-item').each((i, el) => {
        const $item = $(el);
        const title = $item.find('.title a').text().trim();
        const url = $item.find('.title a').attr('href');
        const poster = $item.find('.thumbnail img').attr('src');
        const year = $item.find('.year').text().trim();
        const type = url && url.includes('/tvshows/') ? 'tvshow' : 'movie';

        if (title && url) {
          results.push({
            title,
            url,
            poster,
            year,
            type
          });
        }
      });
    }

    if (results.length === 0) {
      $('article.item, article').each((i, el) => {
        const $item = $(el);
        const title = $item.find('.data h3 a, h3 a, .entry-title a').text().trim();
        const url = $item.find('a').first().attr('href');
        const poster = $item.find('img').first().attr('src') || $item.find('img').attr('data-src');
        const type = url && url.includes('/tvshows/') ? 'tvshow' : 'movie';

        if (title && url && url.includes('cinesubz')) {
          results.push({
            title,
            url,
            poster,
            type
          });
        }
      });
    }

    const uniqueResults = [...new Map(results.map(r => [r.url, r])).values()];
    
    const formattedResults = uniqueResults.map(r => ({
      title: r.title,
      type: r.type,
      quality: r.quality || 'N/A',
      rating: r.rating || 'N/A',
      poster_url: r.poster || null,
      movie_url: r.url
    }));
    
    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      query: query,
      total_results: formattedResults.length,
      results: formattedResults
    });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Failed to search', message: error.message });
  }
});

app.get('/details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const title = $('meta[itemprop="name"]').attr('content') ||
                  $('.sheader .data h1').text().trim() || 
                  $('h1.entry-title').text().trim() ||
                  $('title').text().split('–')[0].trim();
    
    const poster = $('meta[property="og:image"]').first().attr('content') ||
                   $('.sheader .poster img').attr('src') || 
                   $('.poster img').first().attr('src');
    
    const description = $('meta[name="description"]').attr('content') ||
                        $('.wp-content p').first().text().trim() || 
                        $('.contenido p').first().text().trim();
    
    const rating = $('.imdb-score, .rating, .zt_rating_vgs').text().trim();
    
    const dateCreated = $('meta[itemprop="dateCreated"]').attr('content') || '';
    const year = dateCreated.match(/\d{4}/) ? dateCreated.match(/\d{4}/)[0] : 
                 $('.sheader .data .extra .date').text().trim();
    
    const genres = [];
    $('.sgeneros a, .genre-list a').each((i, el) => {
      genres.push($(el).text().trim());
    });

    const downloadLinks = [];

    $('a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href && (href.includes('/api-') || href.includes('cinesubz') && (
        text.toLowerCase().includes('download') ||
        text.match(/(480p|720p|1080p|2160p|4K)/i)
      ))) {
        const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K)/i);
        downloadLinks.push({
          quality: qualityMatch ? qualityMatch[1] : 'Unknown',
          text: text.replace(/\s+/g, ' ').substring(0, 100),
          url: href
        });
      }
    });

    $('[class*="download"] a, [id*="download"] a, .linklist a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href && href.includes('cinesubz')) {
        const qualityMatch = text.match(/(480p|720p|1080p|2160p|4K)/i);
        downloadLinks.push({
          quality: qualityMatch ? qualityMatch[1] : 'Unknown',
          text: text.replace(/\s+/g, ' ').substring(0, 100),
          url: href
        });
      }
    });

    const isMovie = url.includes('/movies/');
    const isTvShow = url.includes('/tvshows/');
    
    const uniqueDownloads = [...new Map(downloadLinks.filter(l => l.url).map(l => [l.url, l])).values()];
    
    const formattedDownloads = uniqueDownloads.map(d => ({
      quality: d.quality,
      size: d.text.match(/(\d+(?:\.\d+)?\s*(?:MB|GB))/i)?.[1] || 'N/A',
      countdown_url: d.url
    }));

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      
      movie_info: {
        title: title || 'N/A',
        type: isMovie ? 'movie' : (isTvShow ? 'tvshow' : 'unknown'),
        year: year || 'N/A',
        rating: rating || 'N/A',
        genres: genres.length > 0 ? genres : ['N/A'],
        description: description || 'N/A'
      },
      
      poster_url: poster || null,
      movie_url: url,
      
      download_links: formattedDownloads
    });
  } catch (error) {
    console.error('Details error:', error.message);
    res.status(500).json({ error: 'Failed to get details', message: error.message });
  }
});

app.get('/episodes', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const title = $('.sheader .data h1').text().trim();
    const poster = $('.sheader .poster img').attr('src');
    
    const seasons = [];

    $('#seasons .se-c').each((i, seasonEl) => {
      const $season = $(seasonEl);
      const seasonNum = $season.find('.se-t').text().trim();
      const episodes = [];

      $season.find('.se-a ul li').each((j, epEl) => {
        const $ep = $(epEl);
        const epNum = $ep.find('.numerando').text().trim();
        const epTitle = $ep.find('.episodiotitle a').text().trim();
        const epUrl = $ep.find('.episodiotitle a').attr('href');
        const epImg = $ep.find('img').attr('src');
        const epDate = $ep.find('.date').text().trim();

        if (epUrl) {
          episodes.push({
            episode: epNum,
            title: epTitle,
            url: epUrl,
            image: epImg,
            date: epDate
          });
        }
      });

      if (episodes.length > 0) {
        seasons.push({
          season: seasonNum,
          episodeCount: episodes.length,
          episodes
        });
      }
    });

    res.json({
      title,
      poster,
      url,
      seasonCount: seasons.length,
      seasons
    });
  } catch (error) {
    console.error('Episodes error:', error.message);
    res.status(500).json({ error: 'Failed to get episodes', message: error.message });
  }
});

const urlMappings = [
  { search: ['https://google.com/server11/1:/', 'https://google.com/server12/1:/', 'https://google.com/server13/1:/'], replace: 'https://cloud.sonic-cloud.online/server1/' },
  { search: ['https://google.com/server21/1:/', 'https://google.com/server22/1:/', 'https://google.com/server23/1:/'], replace: 'https://cloud.sonic-cloud.online/server2/' },
  { search: ['https://google.com/server3/1:/'], replace: 'https://cloud.sonic-cloud.online/server3/' },
  { search: ['https://google.com/server4/1:/'], replace: 'https://cloud.sonic-cloud.online/server4/' },
  { search: ['https://google.com/server5/1:/'], replace: 'https://cloud.sonic-cloud.online/server5/' }
];

function transformDownloadUrl(originalUrl) {
  let modifiedUrl = originalUrl;
  
  for (const mapping of urlMappings) {
    for (const searchUrl of mapping.search) {
      if (originalUrl.includes(searchUrl)) {
        modifiedUrl = originalUrl.replace(searchUrl, mapping.replace);
        
        if (modifiedUrl.includes('.mp4?bot=cscloud2bot&code=')) {
          modifiedUrl = modifiedUrl.replace('.mp4?bot=cscloud2bot&code=', '?ext=mp4&bot=cscloud2bot&code=');
        } else if (modifiedUrl.includes('.mp4')) {
          modifiedUrl = modifiedUrl.replace('.mp4', '?ext=mp4');
        } else if (modifiedUrl.includes('.mkv?bot=cscloud2bot&code=')) {
          modifiedUrl = modifiedUrl.replace('.mkv?bot=cscloud2bot&code=', '?ext=mkv&bot=cscloud2bot&code=');
        } else if (modifiedUrl.includes('.mkv')) {
          modifiedUrl = modifiedUrl.replace('.mkv', '?ext=mkv');
        } else if (modifiedUrl.includes('.zip')) {
          modifiedUrl = modifiedUrl.replace('.zip', '?ext=zip');
        }
        
        return modifiedUrl;
      }
    }
  }
  
  return modifiedUrl;
}

app.get('/download', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    const response = await axios.get(url, { 
      headers,
      maxRedirects: 5
    });
    const $ = cheerio.load(response.data);

    const downloadLinks = [];

    // Extract the direct download link from #link element
    const linkElement = $('#link');
    
    if (linkElement.length > 0) {
      const rawLink = linkElement.attr('href');
      if (rawLink && rawLink.includes('google.com/server')) {
        const directUrl = transformDownloadUrl(rawLink);
        downloadLinks.push({
          type: 'direct',
          label: 'Direct Download',
          raw_url: rawLink,
          download_url: directUrl
        });
      }
    }

    // Extract file info
    const bodyText = $('body').text();
    const fileName = bodyText.match(/CineSubz\.com[^\n]+\.(mp4|mkv)/)?.[0] || 'video.mp4';
    const fileSize = bodyText.match(/(\d+\.?\d*\s*(?:GB|MB))/i)?.[1] || 'Unknown';

    if (downloadLinks.length > 0) {
      res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        file_info: {
          name: fileName,
          size: fileSize
        },
        total_links: 1,
        download_options: downloadLinks,
        additional_info: {
          message: 'Direct download link is available. Google Drive and Telegram mirrors can be accessed by visiting the countdown page in a browser.',
          alternative_downloads: [
            {
              type: 'google_drive',
              label: 'Google Drive Mirror',
              access_method: 'Visit countdown page → Wait for countdown → Click Google Download button'
            },
            {
              type: 'telegram',
              label: 'Telegram Channel',
              access_method: 'Visit countdown page → Wait for countdown → Click Telegram Download button'
            }
          ]
        }
      });
    } else {
      res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: false,
        countdown_url: url,
        message: 'Could not extract download link from countdown page.',
        troubleshooting: {
          reason: 'The page uses JavaScript-based protection and dynamic loading',
          solution: 'Visit the countdown page directly in a browser, wait for the countdown to finish, then manually copy the download link'
        }
      });
    }
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ 
      error: 'Failed to resolve download link', 
      message: error.message
    });
  }
});
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    const response = await axios.get(url, { 
      headers,
      maxRedirects: 5
    });
    const $ = cheerio.load(response.data);

    const downloadLinks = [];

    // Method 1: Extract from #link element (main direct link)
    const linkElement = $('#link');
    if (linkElement.length > 0) {
      const rawLink = linkElement.attr('href');
      if (rawLink && rawLink.includes('google.com/server')) {
        downloadLinks.push({
          type: 'direct',
          label: 'Direct Download',
          raw_url: rawLink,
          download_url: transformDownloadUrl(rawLink)
        });
      }
    }

    // Method 2: Look for the countdown page structure specifically
    // CineSubz uses a specific pattern with download buttons after countdown
    $('.wait-done, .download-options, .dwnl-link, .link-holder').each((i, el) => {
      $(el).find('a').each((j, linkEl) => {
        const $link = $(linkEl);
        const href = $link.attr('href');
        const text = $link.text().trim();
        
        if (href) {
          if (href.includes('google.com/server')) {
            downloadLinks.push({
              type: 'direct',
              label: text || 'Direct Download',
              raw_url: href,
              download_url: transformDownloadUrl(href)
            });
          } else if (href.includes('drive.google.com')) {
            downloadLinks.push({
              type: 'google_drive',
              label: text || 'Google Drive',
              raw_url: href,
              download_url: href
            });
          } else if (href.includes('t.me') && !href.includes('Admin')) {
            downloadLinks.push({
              type: 'telegram',
              label: text || 'Telegram Download',
              raw_url: href,
              download_url: href
            });
          } else if (href.includes('mega.nz')) {
            downloadLinks.push({
              type: 'mega',
              label: text || 'Mega Download',
              raw_url: href,
              download_url: href
            });
          }
        }
      });
    });

    // Method 3: Find all buttons with specific patterns
    $('a.btn, a.button, button a, .download-btn a, [class*="download"] a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      const classes = $el.attr('class') || '';
      
      if (href) {
        // Skip admin links
        if (href.includes('Admin') || text.toLowerCase().includes('admin')) {
          return;
        }

        if (href.includes('google.com/server')) {
          downloadLinks.push({
            type: 'direct',
            label: text || 'Direct Download',
            raw_url: href,
            download_url: transformDownloadUrl(href)
          });
        } else if (href.includes('drive.google.com')) {
          downloadLinks.push({
            type: 'google_drive',
            label: text || 'Google Drive',
            raw_url: href,
            download_url: href
          });
        } else if (href.includes('t.me')) {
          downloadLinks.push({
            type: 'telegram',
            label: text || 'Telegram Channel',
            raw_url: href,
            download_url: href
          });
        } else if (href.includes('mega.nz')) {
          downloadLinks.push({
            type: 'mega',
            label: text || 'Mega Download',
            raw_url: href,
            download_url: href
          });
        }
      }
    });

    // Method 4: Check for links in text/scripts that might be dynamically loaded
    const pageText = $.html();
    
    // Find Google Drive links
    const driveMatches = pageText.match(/https?:\/\/drive\.google\.com\/[^\s"'<>]+/g);
    if (driveMatches) {
      driveMatches.forEach((match, idx) => {
        downloadLinks.push({
          type: 'google_drive',
          label: `Google Drive ${idx + 1}`,
          raw_url: match,
          download_url: match
        });
      });
    }

    // Find Mega links
    const megaMatches = pageText.match(/https?:\/\/mega\.nz\/[^\s"'<>]+/g);
    if (megaMatches) {
      megaMatches.forEach((match, idx) => {
        downloadLinks.push({
          type: 'mega',
          label: `Mega Download ${idx + 1}`,
          raw_url: match,
          download_url: match
        });
      });
    }

    // Find additional Telegram links (not admin)
    const telegramMatches = pageText.match(/https?:\/\/t\.me\/[^\s"'<>]+/g);
    if (telegramMatches) {
      telegramMatches.forEach(match => {
        if (!match.includes('Admin')) {
          downloadLinks.push({
            type: 'telegram',
            label: 'Telegram Channel',
            raw_url: match,
            download_url: match
          });
        }
      });
    }

    // Method 5: Look for onclick handlers
    $('[onclick]').each((i, el) => {
      const onclick = $(el).attr('onclick');
      if (onclick) {
        const urlMatch = onclick.match(/['"]([^'"]+)['"]/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          const text = $(el).text().trim();
          
          if (url.includes('google.com/server')) {
            downloadLinks.push({
              type: 'direct',
              label: text || 'Direct D
