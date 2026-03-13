export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const response = await fetch('https://crumblcookies.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch Crumbl: ${response.status}` });
    }

    const html = await response.text();

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return res.status(500).json({ error: 'No __NEXT_DATA__ found' });

    const nextData = JSON.parse(nextDataMatch[1]);
    const pageProps = nextData?.props?.pageProps || {};
    const products = pageProps.products || {};

    // Return raw products so we can see exact structure
    return res.status(200).json({
      productsKeys: Object.keys(products),
      classicMenuType: typeof products.classicMenu,
      classicMenuIsArray: Array.isArray(products.classicMenu),
      classicMenuSample: Array.isArray(products.classicMenu)
        ? { length: products.classicMenu.length, firstItemKeys: products.classicMenu[0] ? Object.keys(products.classicMenu[0]) : [] }
        : (products.classicMenu ? { keys: Object.keys(products.classicMenu).slice(0, 5) } : null),
      rotatingMenuType: typeof products.rotatingMenu,
      rotatingMenuIsArray: Array.isArray(products.rotatingMenu),
      rotatingMenuSample: Array.isArray(products.rotatingMenu)
        ? { length: products.rotatingMenu.length, firstItemKeys: products.rotatingMenu[0] ? Object.keys(products.rotatingMenu[0]) : [] }
        : (products.rotatingMenu ? { keys: Object.keys(products.rotatingMenu).slice(0, 5) } : null),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack?.slice(0, 300) });
  }
}
