export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const response = await fetch('https://crumblcookies.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    const nextData = JSON.parse(nextDataMatch[1]);
    const products = nextData?.props?.pageProps?.products || {};

    const firstRotating = products.rotatingMenu?.items?.[0] || {};
    const firstClassic = products.classicMenu?.items?.[0] || {};

    return res.status(200).json({
      firstRotatingKeys: Object.keys(firstRotating),
      firstRotatingSample: firstRotating,
      firstClassicKeys: Object.keys(firstClassic),
      firstClassicSample: firstClassic,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
