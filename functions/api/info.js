// Cloudflare Function to proxy Piped API requests
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.in.projectsegfau.lt',
  'https://api.piped.yt',
  'https://pipedapi.moomoo.me',
  'https://pipedapi.syncpundit.io'
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const videoId = url.searchParams.get('v');

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Video ID is required' }), { 
      status: 400,
      headers
    });
  }

  let lastError = null;

  for (const instance of PIPED_INSTANCES) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${instance}/streams/${videoId}`, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Return simplified data
        return new Response(JSON.stringify({
          title: data.title,
          uploader: data.uploader,
          uploaderUrl: data.uploaderUrl,
          duration: data.duration,
          views: data.views,
          thumbnailUrl: data.thumbnailUrl,
          videoStreams: data.videoStreams || [],
          audioStreams: data.audioStreams || [],
          relatedStreams: data.relatedStreams || []
        }), { headers });
      }
      
      lastError = `${instance}: HTTP ${response.status}`;
    } catch (err) {
      lastError = `${instance}: ${err.message}`;
      console.log(`Failed: ${lastError}`);
    }
  }

  return new Response(JSON.stringify({ 
    error: 'All API instances failed. Please try again later.',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
