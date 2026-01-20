// Proxy to Piped API to avoid CORS issues
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de', 
  'https://pipedapi.in.projectsegfau.lt'
];

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const videoId = url.searchParams.get('v');

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Video ID is required' }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await fetch(`${instance}/streams/${videoId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    } catch (err) {
      console.log(`Failed with ${instance}: ${err.message}`);
    }
  }

  return new Response(JSON.stringify({ error: 'Failed to fetch video info' }), { 
    status: 500,
    headers: { 'Content-Type': 'application/json' }
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
