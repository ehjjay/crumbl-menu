export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const response = await fetch('https://crumblcookies.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!response.ok) return res.status(502).json({ error: `Fetch failed: ${response.status}` });

    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return res.status(500).json({ error: 'No __NEXT_DATA__ found' });

    const pageProps = JSON.parse(nextDataMatch[1])?.props?.pageProps || {};
    const products = pageProps.products || {};

    const rotatingItems = products.rotatingMenu?.items || [];
    const classicItems = products.classicMenu?.items || [];

    const cookies = [
      ...rotatingItems.map(item => normalizeCookie(item, 'weekly')),
      ...classicItems.map(item => normalizeCookie(item, 'classic')),
    ];

    const { startDate, endDate } = pageProps.currentCookieWeek || {};
    const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekRange = (startDate && endDate)
      ? `${fmt(startDate)} – ${fmt(endDate)}`
      : '';

    return res.status(200).json({ weekRange, fetchedAt: new Date().toISOString(), cookies });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function normalizeCookie(item, availability) {
  const d = item.dessert || {};
  const highlightTag = item.highlightTag || '';

  if (highlightTag === 'Today Only') availability = 'today';

  return {
    name: d.name || d.nameWithoutPartner || '',
    description: d.description || '',
    image: d.newAerialImage || d.aerialImage || d.contextImage || '',
    profileUrl: d.slug ? `https://crumblcookies.com/profiles/${d.slug}` : '',
    slug: d.slug || '',
    availability,
    highlightTag,
    calories: d.calorieInformation?.total || '',
    rating: d.stats?.averageRating || null,
    reviews: d.stats?.totalReviews || null,
    backgroundColor: d.backgroundColor || '',
  };
}
