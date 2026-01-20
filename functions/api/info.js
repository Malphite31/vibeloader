// Cloudflare Function using yt-dlp based APIs
const YTDLP_APIS = [
  {
    name: 'cobalt',
    url: 'https://api.cobalt.tools/api/json',
    method: 'POST',
    transform: (videoId, quality) => ({
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        vCodec: 'h264',
        vQuality: quality || 'max',
        aFormat: 'mp3',
        filenamePattern: 'basic',
        isAudioOnly: false
      }),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    }),
    parseResponse: (data) => {
      if (data.status === 'stream' || data.status === 'redirect') {
        return { url: data.url };
      }
      if (data.status === 'picker' && data.picker?.length) {
        return { 
          picker: data.picker.map(p => ({
            url: p.url,
            quality: p.quality || 'unknown'
          }))
        };
      }
      return null;
    }
  }
];

// Invidious instances for metadata + direct links
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://invidious.private.coffee', 
  'https://invidious.protokolla.fi',
  'https://yt.artemislena.eu',
  'https://invidious.perennialte.ch',
  'https://vid.puffyan.us'
];

async function fetchWithTimeout(url, options = {}, timeout = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function getVideoInfo(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await fetchWithTimeout(
        `${instance}/api/v1/videos/${videoId}`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Get all available formats
        const formats = [];
        
        // Format streams (with audio)
        (data.formatStreams || []).forEach(s => {
          const resolution = parseInt(s.qualityLabel) || parseInt(s.quality) || 0;
          if (resolution > 0 && s.url) {
            formats.push({
              url: s.url,
              quality: s.qualityLabel || s.quality,
              resolution,
              container: s.container || 'mp4',
              hasAudio: true,
              size: s.size || null,
              type: 'format'
            });
          }
        });

        // Adaptive formats (often higher quality, may be video-only)
        (data.adaptiveFormats || []).forEach(s => {
          if (!s.type?.startsWith('video/')) return;
          const resolution = parseInt(s.qualityLabel) || parseInt(s.quality) || 0;
          if (resolution > 0 && s.url) {
            formats.push({
              url: s.url,
              quality: s.qualityLabel || s.quality,
              resolution,
              container: s.type?.includes('webm') ? 'webm' : 'mp4',
              hasAudio: !s.type?.includes('video/'),
              size: s.clen || s.contentLength || null,
              fps: s.fps,
              bitrate: s.bitrate,
              type: 'adaptive'
            });
          }
        });

        // Sort by resolution descending
        formats.sort((a, b) => b.resolution - a.resolution);

        // Deduplicate - prefer formats with audio
        const seen = new Map();
        const uniqueFormats = [];
        for (const f of formats) {
          const existing = seen.get(f.resolution);
          if (!existing || (f.hasAudio && !existing.hasAudio)) {
            seen.set(f.resolution, f);
          }
        }
        seen.forEach(f => uniqueFormats.push(f));
        uniqueFormats.sort((a, b) => b.resolution - a.resolution);

        return {
          success: true,
          videoId,
          title: data.title,
          author: data.author,
          duration: data.lengthSeconds,
          views: data.viewCount,
          thumbnail: data.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          formats: uniqueFormats,
          source: 'invidious',
          instance
        };
      }
    } catch (err) {
      console.log(`Invidious ${instance} failed: ${err.message}`);
    }
  }
  
  return null;
}

async function getCobaltDownload(videoId, quality) {
  const api = YTDLP_APIS[0]; // Cobalt
  
  try {
    const config = api.transform(videoId, quality);
    const response = await fetchWithTimeout(api.url, {
      method: 'POST',
      ...config
    }, 15000);

    if (response.ok) {
      const data = await response.json();
      return api.parseResponse(data);
    }
  } catch (err) {
    console.log(`Cobalt failed: ${err.message}`);
  }
  
  return null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const videoId = url.searchParams.get('v');
  const quality = url.searchParams.get('q') || 'max';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Video ID required' }), { 
      status: 400, headers 
    });
  }

  // Try to get video info from Invidious (has direct URLs)
  const videoInfo = await getVideoInfo(videoId);
  
  if (videoInfo) {
    return new Response(JSON.stringify(videoInfo), { headers });
  }

  // Fallback: Try Cobalt for download URL
  const cobaltResult = await getCobaltDownload(videoId, quality);
  
  if (cobaltResult) {
    // Get basic metadata from YouTube oEmbed
    let meta = { title: 'YouTube Video', author_name: 'Unknown' };
    try {
      const oembedRes = await fetchWithTimeout(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembedRes.ok) {
        meta = await oembedRes.json();
      }
    } catch (e) {}

    return new Response(JSON.stringify({
      success: true,
      videoId,
      title: meta.title,
      author: meta.author_name,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      formats: cobaltResult.picker || [{ 
        url: cobaltResult.url, 
        quality: quality,
        resolution: parseInt(quality) || 1080,
        hasAudio: true,
        container: 'mp4'
      }],
      source: 'cobalt'
    }), { headers });
  }

  return new Response(JSON.stringify({ 
    error: 'Could not fetch video. Please try again.',
  }), { 
    status: 502, headers 
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
