// Cloudflare Function using Invidious API (most reliable)
const INVIDIOUS_INSTANCES = [
  'https://invidious.nerdvpn.de',
  'https://invidious.private.coffee',
  'https://invidious.protokolla.fi',
  'https://invidious.perennialte.ch',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com'
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const videoId = url.searchParams.get('v');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Video ID is required' }), { 
      status: 400, headers 
    });
  }

  let lastError = null;

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Process format streams
        const formatStreams = (data.formatStreams || []).map(s => ({
          url: s.url,
          quality: s.quality,
          qualityLabel: s.qualityLabel,
          resolution: parseInt(s.qualityLabel) || parseInt(s.quality) || 0,
          type: s.type,
          container: s.container || 'mp4',
          size: s.size || null,
          hasAudio: true
        }));

        // Process adaptive formats (video only - higher quality)
        const adaptiveFormats = (data.adaptiveFormats || [])
          .filter(s => s.type?.startsWith('video/'))
          .map(s => ({
            url: s.url,
            quality: s.quality,
            qualityLabel: s.qualityLabel,
            resolution: parseInt(s.qualityLabel) || parseInt(s.quality) || 0,
            type: s.type,
            container: s.container || (s.type?.includes('webm') ? 'webm' : 'mp4'),
            size: s.clen || s.contentLength || null,
            fps: s.fps,
            hasAudio: false
          }));

        return new Response(JSON.stringify({
          success: true,
          title: data.title,
          author: data.author,
          authorId: data.authorId,
          lengthSeconds: data.lengthSeconds,
          viewCount: data.viewCount,
          thumbnail: data.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          formatStreams: formatStreams,
          adaptiveFormats: adaptiveFormats,
          instance: instance
        }), { headers });
      }

      lastError = `${instance}: HTTP ${response.status}`;
    } catch (err) {
      lastError = `${instance}: ${err.message}`;
      console.log(lastError);
    }
  }

  return new Response(JSON.stringify({ 
    error: 'All instances are currently unavailable. Please try again in a moment.',
    details: lastError
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
