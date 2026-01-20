// Cloudflare Function for downloading via Cobalt API
const COBALT_INSTANCES = [
  'https://api.cobalt.tools',
  'https://cobalt-api.hyper.lol'
];

export async function onRequestPost(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const { videoId, quality } = await context.request.json();

    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Video ID is required' }), { 
        status: 400, headers 
      });
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    let lastError = null;

    for (const instance of COBALT_INSTANCES) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

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
            vQuality: quality || '1080',
            filenamePattern: 'basic',
            isAudioOnly: false,
            aFormat: 'mp3'
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          
          if (data.status === 'stream' || data.status === 'redirect') {
            return new Response(JSON.stringify({ 
              success: true, 
              url: data.url 
            }), { headers });
          } else if (data.status === 'picker' && data.picker?.length > 0) {
            return new Response(JSON.stringify({ 
              success: true, 
              url: data.picker[0].url 
            }), { headers });
          } else if (data.url) {
            return new Response(JSON.stringify({ 
              success: true, 
              url: data.url 
            }), { headers });
          }
          
          lastError = `${instance}: ${data.text || 'Unknown error'}`;
        } else {
          lastError = `${instance}: HTTP ${response.status}`;
        }
      } catch (err) {
        lastError = `${instance}: ${err.message}`;
      }
    }

    // Fallback URL
    return new Response(JSON.stringify({
      success: false,
      error: lastError,
      fallbackUrl: `https://ssyoutube.com/watch?v=${videoId}`
    }), { headers });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      fallbackUrl: `https://ssyoutube.com/`
    }), { 
      status: 500, headers 
    });
  }
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
