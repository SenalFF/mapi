const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 5000;
const BASE_URL = 'https://cinesubz.co';

const API_INFO = {
  developer: 'Mr Senal',
  version: 'v1.2',
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

// URL transformation mappings
const urlMappings = [
  { search: ['https://google.com/server11/1:/', 'https://google.com/server12/1:/', 'https://google.com/server13/1:/'], replace: 'https://cloud.sonic-cloud.online/server1/' },
  { search: ['https://google.com/server21/1:/', 'https://google.com/server22/1:/', 'https://google.com/server23/1:/'], replace: 'https://cloud.sonic-cloud.online/server2/' },
  { search: ['https://google.com/server3/1:/'], replace: 'https://cloud.sonic-cloud.online/server3/' },
  { search: ['https://google.com/server4/1:/'], replace: 'https://cloud.sonic-cloud.online/server4/' },
  { search: ['https://google.com/server5/1:/'], replace: 'https://cloud.sonic-cloud.online/server5/' }
];

// Transform download URL
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

// Helper function to extract final download links from sonic-cloud page
async function extractSonicCloudLinks(sonicCloudUrl) {
  try {
    console.log('🔍 Fetching sonic-cloud page:', sonicCloudUrl);
    const response = await axios.get(sonicCloudUrl, { 
      headers: {
        ...headers,
        'Referer': 'https://cinesubz.lk/'
      },
      maxRedirects: 5,
      timeout: 15000
    });
    
    const $ = cheerio.load(response.data);

    const downloadLinks = {
      direct: null,
      google_drive_1: null,
      google_drive_2: null,
      telegram: null,
      file_name: null,
      file_size: null
    };

    // Extract file info from page text
    const pageText = $('body').text();
    
    const fileNameMatch = pageText.match(/File Name:\s*([^\n]+)/i);
    if (fileNameMatch) {
      downloadLinks.file_name = fileNameMatch[1].trim();
    }
    
    const fileSizeMatch = pageText.match(/File Size:\s*([^\n]+)/i);
    if (fileSizeMatch) {
      downloadLinks.file_size = fileSizeMatch[1].trim();
    }

    // Method 1: Extract from button/link elements
    $('a, button').each((i, el) => {
      const $el = $(el);
      const href = $el.attr('href') || $el.attr('onclick');
      const text = $el.text().trim();
      const lowerText = text.toLowerCase();

      if (!href && !text) return;

      // Extract URLs from onclick handlers
      let extractedUrl = href;
      if (href && href.includes('window.location')) {
        const urlMatch = href.match(/['"](https?:\/\/[^'"]+)['"]/);
        if (urlMatch) extractedUrl = urlMatch[1];
      }

      // Categorize by button text
      if (lowerText.includes('direct download') || lowerText.includes('direct dl')) {
        if (extractedUrl) downloadLinks.direct = extractedUrl;
      } else if (lowerText.includes('google download 1') || lowerText.includes('google dl 1')) {
        if (extractedUrl) downloadLinks.google_drive_1 = extractedUrl;
      } else if (lowerText.includes('google download 2') || lowerText.includes('google dl 2')) {
        if (extractedUrl) downloadLinks.google_drive_2 = extractedUrl;
      } else if (lowerText.includes('telegram download') || lowerText.includes('telegram dl')) {
        if (extractedUrl) downloadLinks.telegram = extractedUrl;
      }

      // Also check href directly for known patterns
      if (extractedUrl) {
        if (extractedUrl.includes('drive.google.com') && !downloadLinks.google_drive_1) {
          downloadLinks.google_drive_1 = extractedUrl;
        } else if (extractedUrl.includes('t.me/') && !downloadLinks.telegram) {
          downloadLinks.telegram = extractedUrl;
        }
      }
    });

    // Method 2: Extract from scripts
    const scripts = $('script').map((i, el) => $(el).html()).get().join('\n');
    
    if (!downloadLinks.direct) {
      const directMatches = [
        /directDownload[^'"]*['"]([^'"]+)['"]/i,
        /direct[^'"]*download[^'"]*['"]([^'"]+)['"]/i,
        /onclick.*?location\.href\s*=\s*['"]([^'"]+)['"]/i
      ];
      
      for (const pattern of directMatches) {
        const match = scripts.match(pattern);
        if (match && match[1] && !match[1].includes('google.com/server')) {
          downloadLinks.direct = match[1];
          break;
        }
      }
    }

    if (!downloadLinks.google_drive_1) {
      const gdriveMatch = scripts.match(/drive\.google\.com\/[^'"]+/i);
      if (gdriveMatch) {
        const fullUrl = gdriveMatch[0].startsWith('http') ? gdriveMatch[0] : 'https://' + gdriveMatch[0];
        downloadLinks.google_drive_1 = fullUrl;
      }
    }

    if (!downloadLinks.telegram) {
      const telegramMatch = scripts.match(/t\.me\/[^'"]+/i);
      if (telegramMatch) {
        const fullUrl = telegramMatch[0].startsWith('http') ? telegramMatch[0] : 'https://' + telegramMatch[0];
        downloadLinks.telegram = fullUrl;
      }
    }

    // Method 3: Look for any direct file download links
    if (!downloadLinks.direct) {
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && (href.endsWith('.mp4') || href.endsWith('.mkv') || 
                     href.includes('.mp4?') || href.includes('.mkv?'))) {
          if (href.startsWith('http')) {
            downloadLinks.direct = href;
            return false;
          }
        }
      });
    }

    console.log('✅ Extracted links:', {
      direct: !!downloadLinks.direct,
      gdrive1: !!downloadLinks.google_drive_1,
      gdrive2: !!downloadLinks.google_drive_2,
      telegram: !!downloadLinks.telegram
    });

    return downloadLinks;
  } catch (error) {
    console.error('❌ Error extracting sonic-cloud links:', error.message);
    return null;
  }
}

// Helper function to get instructions based on link type
function getLinkTypeInstructions(linkType) {
  const instructions = {
    telegram: 'Join the Telegram channel/group to access the download',
    google_drive: 'Open Google Drive link to download the file',
    mega: 'Open Mega.nz link to download the file',
    mediafire: 'Open MediaFire link to download the file',
    direct: 'Direct download link - click to start downloading',
    sonic_cloud_page: 'Visit sonic-cloud page to access all download options',
    other: 'Follow the link to access the download',
    unknown: 'Follow the link to download'
  };
  
  return instructions[linkType] || instructions.unknown;
}

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
        description: 'Resolve countdown page and extract ALL download links',
        example: '/download?url=https://cinesubz.co/api-.../odcemnd9hb/'
      },
      resolve: {
        method: 'GET',
        path: '/resolve?url={url}',
        description: 'Follow redirects to get final URL',
        example: '/resolve?url=https://...'
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
    res.status(500).json({ 
      developer: API_INFO.developer,
      version: API_INFO.version,
      error: 'Failed to search', 
      message: error.message 
    });
  }
});

// Details endpoint
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

// MAIN DOWNLOAD ENDPOINT - Extracts all download links
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

    console.log('📥 Processing countdown URL:', url);

    const response = await axios.get(url, { 
      headers,
      maxRedirects: 5,
      timeout: 15000
    });
    const $ = cheerio.load(response.data);

    let rawLink = null;
    let linkType = 'unknown';

    // Strategy 1: Extract from #link element
    const linkElement = $('#link');
    if (linkElement.length > 0) {
      rawLink = linkElement.attr('href');
      console.log('✅ Found link in #link element');
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
          console.log('✅ Found link in .wait-done');
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
          href.includes('sonic-cloud') ||
          href.includes('t.me/') ||
          href.includes('drive.google.com') ||
          href.includes('mega.nz')
        )) {
          rawLink = href;
          console.log('✅ Found link in general search');
          return false;
        }
      });
    }

    if (!rawLink) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: false,
        countdown_url: url,
        message: 'Could not extract any download link from countdown page'
      });
    }

    // Process based on link type
    if (rawLink.includes('t.me/')) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        link_type: 'telegram',
        telegram_url: rawLink,
        instructions: 'Join Telegram channel/group to download'
      });
    }

    if (rawLink.includes('drive.google.com')) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        link_type: 'google_drive',
        google_drive_url: rawLink,
        instructions: 'Open Google Drive link to download'
      });
    }

    if (rawLink.includes('mega.nz')) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        link_type: 'mega',
        mega_url: rawLink,
        instructions: 'Open Mega.nz link to download'
      });
    }

    // Transform to sonic-cloud if needed
    let sonicCloudUrl = rawLink;
    if (rawLink.includes('google.com/server')) {
      sonicCloudUrl = transformDownloadUrl(rawLink);
      console.log('🔄 Transformed to sonic-cloud URL');
    }

    // Now extract download links from sonic-cloud page
    console.log('🔍 Extracting links from sonic-cloud page...');
    const sonicLinks = await extractSonicCloudLinks(sonicCloudUrl);

    if (sonicLinks && (sonicLinks.direct || sonicLinks.google_drive_1 || sonicLinks.telegram)) {
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        raw_link: rawLink,
        sonic_cloud_page: sonicCloudUrl,
        
        file_info: {
          name: sonicLinks.file_name || 'N/A',
          size: sonicLinks.file_size || 'N/A'
        },
        
        download_links: {
          direct_download: sonicLinks.direct,
          google_drive_1: sonicLinks.google_drive_1,
          google_drive_2: sonicLinks.google_drive_2,
          telegram: sonicLinks.telegram
        },
        
        instructions: {
          direct: 'Fastest - Click to download immediately',
          google_drive: 'Requires Google sign-in - Can stream or download',
          telegram: 'Join channel/group to access file'
        }
      });
    } else {
      // Failed to extract but we have the sonic-cloud page
      return res.json({
        developer: API_INFO.developer,
        version: API_INFO.version,
        success: true,
        countdown_url: url,
        raw_link: rawLink,
        sonic_cloud_page: sonicCloudUrl,
        message: 'Could not auto-extract download links. Visit sonic-cloud page manually.',
        instructions: 'Open the sonic_cloud_page URL in your browser'
      });
    }

  } catch (error) {
    console.error('❌ Download error:', error.message);
    res.status(500).json({ 
      developer: API_INFO.developer,
      version: API_INFO.version,
      success: false,
      error: 'Failed to resolve download link', 
      message: error.message 
    });
  }
});
