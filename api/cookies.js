export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const response = await fetch('https://crumblcookies.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    const html = await response.text();

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return res.status(200).json({ error: 'No __NEXT_DATA__ found' });

    const nextData = JSON.parse(nextDataMatch[1]);

    // Return the top-level keys and a shallow peek at pageProps
    const pageProps = nextData?.props?.pageProps || {};
    const topKeys = Object.keys(pageProps);

    // For each key, return its type and if array, its length and first item sample
    const peek = {};
    for (const key of topKeys) {
      const val = pageProps[key];
      if (Array.isArray(val)) {
        peek[key] = {
          type: 'array',
          length: val.length,
          firstItem: val[0] ? Object.keys(val[0]) : []
        };
      } else if (val && typeof val === 'object') {
        peek[key] = {
          type: 'object',
          keys: Object.keys(val).slice(0, 10)
        };
      } else {
        peek[key] = { type: typeof val, value: String(val).slice(0, 100) };
      }
    }

    return res.status(200).json({ topKeys, peek });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
