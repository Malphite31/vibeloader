// Cloudflare Function using Cobalt API (more reliable)
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt-api.hyper.lol',
  'https://cobalt.api.timelessnesses.me'
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const videoId = url.searchParams.get('v');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Video ID is required' }), { 
      status: 400,
      headers
    });
  }

  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let lastError = null;

  for (const instance of COBALT_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${instance}/api/json`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          url: youtubeUrl,
          vCodec: 'h264',
          vQuality: 'max',
          filenamePattern: 'basic',
          isAudioOnly: false
        })
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Get video metadata from YouTube oEmbed
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${youtubeUrl}&format=json`);
        let meta = { title: 'YouTube Video', author_name: 'Unknown' };
        if (oembedRes.ok) {
          meta = await oembedRes.json();
        }

        return new Response(JSON.stringify({
          success: true,
          title: meta.title,
          uploader: meta.author_name,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          cobaltData: data
        }), { headers });
      }
      
      lastError = `${instance}: HTTP ${response.status}`;
    } catch (err) {
      lastError = `${instance}: ${err.message}`;
    }
  }

  // Fallback: Return basic info with direct link instructions
  try {
    const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${youtubeUrl}&format=json`);
    if (oembedRes.ok) {
      const meta = await oembedRes.json();
      return new Response(JSON.stringify({
        success: true,
        fallback: true,
        title: meta.title,
        uploader: meta.author_name,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        videoId: videoId
      }), { headers });
    }
  } catch (e) {}

  return new Response(JSON.stringify({ 
    error: 'Could not fetch video info. Please try again.',
    details: lastError
  }), { 
    status: 502,
    headers
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
