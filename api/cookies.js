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

    const { classicMenu = [], rotatingMenu = [] } = pageProps.products || {};
    const { startDate, endDate } = pageProps.currentCookieWeek || {};

    const cookies = [];

    for (const item of rotatingMenu) {
      cookies.push(normalizeCookie(item, 'weekly'));
    }
    for (const item of classicMenu) {
      cookies.push(normalizeCookie(item, 'classic'));
    }

    // Format week range from API dates if available
    let weekRange = '';
    if (startDate && endDate) {
      const fmt = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weekRange = `${fmt(startDate)} – ${fmt(endDate)}`;
    } else {
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      weekRange = `${fmt(monday)} – ${fmt(sunday)}`;
    }

    return res.status(200).json({
      weekRange,
      fetchedAt: new Date().toISOString(),
      cookies
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

function normalizeCookie(item, availability) {
  // Find the best image — prefer a high-res aerial/top shot
  let image = '';
  if (item.assets && Array.isArray(item.assets)) {
    const aerial = item.assets.find(a => a?.url && (a.url.includes('1080') || a.url.includes('Aerial') || a.url.includes('aerial')));
    const any = item.assets.find(a => a?.url);
    image = (aerial || any)?.url || '';
  }
  if (!image) {
    image = item.imageUrl || item.image || item.assetUrl || item.thumbnailUrl || '';
  }

  const slug = item.slug || item.urlSlug || '';
  const profileUrl = slug ? `https://crumblcookies.com/profiles/${slug}` : '';

  // Some items are "today only" — check for a dailySpecial or similar flag
  const raw = JSON.stringify(item).toLowerCase();
  if (availability === 'weekly' && (raw.includes('today') || raw.includes('daily'))) {
    availability = 'today';
  }

  return {
    name: item.name || item.title || '',
    description: item.description || item.subtitle || '',
    image,
    profileUrl,
    slug,
    availability
  };
}
