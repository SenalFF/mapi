const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;
const BASE_URL = 'https://cinesubz.co';

const API_INFO = {
  developer: 'Mr Senal',
  version: 'v1.3',
  api_name: 'CineSubz Movie Downloader API'
};

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Referer': 'https://cinesubz.co/'
};

app.use(express.json());

// Root endpoint
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
      episode_details: {
        method: 'GET',
        path: '/episode-details?url={encoded_url}',
        description: 'Get episode download links',
        example: '/episode-details?url=https://cinesubz.co/...'
      },
      download: {
        method: 'GET',
        path: '/download?url={countdown_page_url}',
        description: 'Resolve countdown page to get final download link',
        example: '/download?url=https://cinesubz.co/api-.../odcemnd9hb/'
      }
    }
  });
});

// Search endpoint
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
    res.status(500).json({ 
      developer: API_INFO.developer,
      version: API_INFO.version,
      error: 'Failed to search', 
      message: error.message 
    });
  }
});

// Details endpoint with direct csplayer link detection
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
    const directDownloadLinks = [];

    // Look for direct csplayer/download links in the page
    const pageHtml = response.data;
    
    // Pattern 1: csplayer links
    const csplayerPattern = /https?:\/\/[^"'\s]+\.csplayer\d+\.store\/[^"'\s]+/gi;
    const csplayerMatches = pageHtml.match(csplayerPattern);
    
    if (csplayerMatches) {
      console.log('Found csplayer links:', csplayerMatches.length);
      csplayerMatches.forEach(link => {
        // Clean the link from quotes or brackets if any
        let cleanLink = link.replace(/["'\]]/g, '');
        const decodedLink = decodeURIComponent(cleanLink);
        const qualityMatch = decodedLink.match(/-(480p|720p|1080p|2160p|4K|2080p)\.(mp4|mkv)/i);
        const quality = qualityMatch ? qualityMatch[1] : 'Unknown';
        const fileName = decodedLink.split('/').pop();
        
        if (!directDownloadLinks.some(d => d.download_url === decodedLink)) {
          directDownloadLinks.push({
            quality: quality,
            type: 'csplayer',
            download_url: decodedLink,
            file_name: fileName
          });
        }
      });
    }

    // Pattern 2: Look for other direct download domains
    const directLinkPatterns = [
      /https?:\/\/[^"'\s]+\.(mp4|mkv|avi)/gi
    ];

    directLinkPatterns.forEach(pattern => {
      const matches = pageHtml.match(pattern);
      if (matches) {
        matches.forEach(link => {
          let cleanLink = link.replace(/["'\]]/g, '');
          if (cleanLink.includes('tmdb.org') || cleanLink.includes('image')) return;
          if (directDownloadLinks.some(d => d.download_url === cleanLink)) return;
          
          const qualityMatch = cleanLink.match(/-(480p|720p|1080p|2160p|4K|2080p)/i);
          const quality = qualityMatch ? qualityMatch[1] : 'Unknown';
          
          directDownloadLinks.push({
            quality: quality,
            type: 'direct',
            download_url: decodeURIComponent(cleanLink),
            file_name: cleanLink.split('/').pop()
          });
        });
      }
    });

    // Look for countdown/API links (existing functionality)
    $('a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href && (href.includes('/api-') || (href.includes('cinesubz') && (
        text.toLowerCase().includes('download') ||
        text.match(/(480p|720p|1080p|2160p|4K)/i)
      )))) {
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

    const uniqueDirectLinks = [...new Map(directDownloadLinks.map(l => [l.download_url, l])).values()];

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
      
      direct_downloads: uniqueDirectLinks.length > 0 ? uniqueDirectLinks : null,
      download_links: formattedDownloads
    });
  } catch (error) {
    console.error('Details error:', error.message);
    res.status(500).json({ 
      developer: API_INFO.developer,
      version: API_INFO.version,
      error: 'Failed to get details', 
      message: error.message 
    });
  }
});

// Episodes endpoint
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
      developer: API_INFO.developer,
      version: API_INFO.version,
      title,
      poster,
      url,
      seasonCount: seasons.length,
      seasons
    });
  } catch (error) {
    console.error('Episodes error:', error.message);
    res.status(500).json({ 
      developer: API_INFO.developer,
      version: API_INFO.version,
      error: 'Failed to get episodes', 
      message: error.message 
    });
  }
});

// Episode details endpoint
app.get('/episode-details', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ error: 'Missing URL parameter' });
    }

    const response = await axios.get(url, { headers });
    const $ = cheerio.load(response.data);

    const title = $('.sheader .data h1').text().trim() || $('h1').first().text().trim();
    const poster = $('.sheader .poster img').attr('src') || $('img.poster').attr('src');

    const downloadLinks = [];

    $('#download tbody tr').each((i, el) => {
      const $row = $(el);
      const quality = $row.find('td').eq(1).text().trim();
      const size = $row.find('td').eq(2).text().trim();
      const link = $row.find('a').attr('href');

      if (link) {
        downloadLinks.push({
          quality: quality || 'Unknown',
          size,
          url: link
        });
      }
    });

    $('.sp-body a, .dload a, .download a').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href');
      const text = $el.text().trim();
      
      if (href && href.includes('cinesubz')) {
        const qualityMatch = text.match(/(480p|720p|1080p|2160p)/i);
        downloadLinks.push({
          quality: qualityMatch ? qualityMatch[1] : 'Unknown',
          text: text.substring(0, 100),
          url: href
        });
      }
    });

    res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      title,
      poster,
      url,
      downloadLinks: [...new Map(downloadLinks.filter(l => l.url).map(l => [l.url, l])).values()]
    });
  } catch (error) {
    console.error('Episode details error:', error.message);
    res.status(500).json({ 
      developer: API_INFO.developer,
      version: API_INFO.version,
      error: 'Failed to get episode details', 
      message: error.message 
    });
  }
});

// URL transformation mappings
const urlMappings = [
  { search: ['https://google.com/server11/1:/', 'https://google.com/server12/1:/', 'https://google.com/server13/1:/'], replace: 'https://cloud.sonic-cloud.online/server1/' },
  { search: ['https://google.com/server21/1:/', 'https://google.com/server22/1:/', 'https://google.com/server23/1:/'], replace: 'https://cloud.sonic-cloud.online/server2/' },
  { search: ['https://google.com/server3/1:/'], replace: 'https://cloud.sonic-cloud.online/server3/' },
  { search: ['https://google.com/server4/1:/'], replace: 'https://cloud.sonic-cloud.online/server4/' },
  { search: ['https://google.com/server5/1:/'], replace: 'https://cloud.sonic-cloud.online/server5/' }
];

function transformDownloadUrl(originalUrl) {
  let modifiedUrl = originalUrl;
  let urlChanged = false;
  
  for (const mapping of urlMappings) {
    if (urlChanged) break;
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
        
        urlChanged = true;
        break;
      }
    }
  }

  if (!urlChanged) {
    let tempUrl = originalUrl;
    if (tempUrl.includes('srilank222')) {
      tempUrl = tempUrl.replace('srilank222', 'srilanka2222');
      urlChanged = true;
    }
    if (tempUrl.includes('https://tsadsdaas.me/')) {
      tempUrl = tempUrl.replace('https://tsadsdaas.me/', 'http://tdsdfasdaddd.me/');
      urlChanged = true;
    }
    if (tempUrl.includes('https://t.me/')) {
      urlChanged = true;
    }
    modifiedUrl = tempUrl;
  }
  
  return modifiedUrl;
}

// Helper function to extract file info from sonic-cloud page
async function extractSonicCloudLinks(sonicCloudUrl) {
  try {
    console.log('Fetching sonic-cloud page:', sonicCloudUrl);
    const response = await axios.get(sonicCloudUrl, { 
      headers,
      maxRedirects: 5,
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);

    const downloadLinks = {
      file_name: null,
      file_size: null
    };

    $('.file-info').each((i, el) => {
      const $el = $(el);
      const text = $el.text();
      
      if (text.includes('File Name:')) {
        downloadLinks.file_name = $el.find('span').text().trim();
      }
      if (text.includes('File Size:')) {
        downloadLinks.file_size = $el.find('span').text().trim();
      }
    });

    return downloadLinks;
  } catch (error) {
    console.error('Error extracting sonic-cloud info:', error.message);
    return { file_name: null, file_size: null };
  }
}

// Download endpoint - Direct extraction without sonic-cloud
app.get('/download', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) {
      return res.status(400).json({ 
        developer: API_INFO.developer,
        version: API_INFO.version,
        error: 'Missing URL parameter' 
      });
    }

    const response = await axios.get(url, { 
      headers, 
      timeout: 15000, 
      maxRedirects: 5 
    });
    const $ = cheerio.load(response.data);
    const pageHtml = response.data;

    let rawLink = null;
    const downloadOptions = [];

    // Strategy 1: Extract from #link element
    const linkElement = $('#link');
    if (linkElement.length > 0) {
      rawLink = linkElement.attr('href');
      console.log('Found link in #link element');
    }

    // Strategy 2: Extract from .wait-done div
    if (!rawLink) {
      $('.wait-done a').each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim().toLowerCase();
        
        if (href && 
            !href.includes('/movies/') && 
            !href.includes('/tvshows/') && 
            !text.includes('sinhala') &&
            !text.includes('previous') &&
            !text.includes('back')) {
          rawLink = href;
          console.log('Found link in .wait-done');
          return false;
        }
      });
    }

    // Strategy 3: General search
    if (!rawLink) {
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && (
          href.includes('google.com/server') || 
          href.includes('csplayer') ||
          href.includes('t.me/') ||
          href.includes('drive.google.com') ||
          href.includes('mega.nz')
        )) {
          rawLink = href;
          console.log('Found link in general search');
          return false;
        }
      });
    }

    // Strategy 4: Look for csplayer direct links in page HTML
    const csplayerPattern = /https?:\/\/[^"'\s]+\.csplayer\d+\.store\/[^"'\s]+/gi;
    const csplayerMatches = pageHtml.match(csplayerPattern);
    
    if (csplayerMatches && csplayerMatches.length > 0) {
      console.log('Found csplayer direct links:', csplayerMatches.length);
      
      const downloadOptions = [];
      csplayerMatches.forEach(link => {
        let cleanLink = link.replace(/["'\]]/g, '');
        const decodedLink = decodeURIComponent(cleanLink);
        const qualityMatch = decodedLink.match(/-(480p|720p|1080p|2160p|4K|2080p)\.(mp4|mkv)/i);
        const quality = qualityMatch ? qualityMatch[1] : 'Unknown';
        const fileName = decodedLink.split('/').pop();
        
        downloadOptions.push({
          quality: quality,
          type: 'csplayer',
          download_url: decodedLink,
          file_name: fileName
        });
      });

      // Remove duplicates
      const uniqueOptions = [...new Map(downloadOptions.map(d => [d.download_url, d])).values()];

      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        link_type: 'csplayer',
        total_links: uniqueOptions.length,
        download_options: uniqueOptions,
        message: 'Direct csplayer download links extracted successfully',
        instructions: 'Click any download_url to start downloading directly'
      });
    }

    // If direct csplayer links not found, process other link types
    if (!rawLink) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: false,
        countdown_url: url,
        message: 'Could not extract download links from this page'
      });
    }

    // Handle Telegram links
    if (rawLink.includes('t.me/')) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        link_type: 'telegram',
        download_url: rawLink,
        instructions: 'Join Telegram channel/group to access the download'
      });
    }

    // Handle Google Drive links
    if (rawLink.includes('drive.google.com')) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        link_type: 'google_drive',
        download_url: rawLink,
        instructions: 'Open Google Drive link to download the file'
      });
    }

    // Handle Mega links
    if (rawLink.includes('mega.nz')) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        link_type: 'mega',
        download_url: rawLink,
        instructions: 'Open Mega.nz link to download the file'
      });
    }

    // If it's a google.com/server link, transform it but don't fetch
    if (rawLink.includes('google.com/server')) {
      const transformedUrl = transformDownloadUrl(rawLink);
      
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        raw_link: rawLink,
        link_type: 'server_redirect',
        server_page: transformedUrl,
        message: 'Server redirect link - visit page to access download options',
        instructions: 'Open the server_page URL in your browser to access download buttons'
      });
    }

    // Default response for other link types
    return res.json({
      developer: API_INFO.developer,
      version: API_INFO.version,
      success: true,
      countdown_url: url,
      link_type: 'other',
      download_url: rawLink,
      instructions: 'Follow the link to access download'
    });

  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ 
      developer: API_INFO.developer,
      version: API_INFO.version,
      success: false,
      error: 'Download resolution failed', 
      message: error.message 
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`╔════════════════════════════════════════════════════════╗`);
  console.log(`║  CineSubz API v${API_INFO.version} - by ${API_INFO.developer}         ║`);
  console.log(`╚════════════════════════════════════════════════════════╝`);
  console.log(`\n🚀 Server running at: http://0.0.0.0:${PORT}\n`);
  console.log(`📡 Endpoints: /search, /details, /episodes, /download`);
  console.log(`\n✅ Ready to accept requests!\n`);
});

// Export for serverless (Vercel)
module.exports = app;
