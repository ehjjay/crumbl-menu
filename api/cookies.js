export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600');

  try {
    const response = await fetch('https://crumblcookies.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: `Failed to fetch Crumbl: ${response.status}` });
    }

    const html = await response.text();
    let cookies = [];
    let strategy = 'none';

    // --- Strategy 1: __NEXT_DATA__ JSON blob (most reliable) ---
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const flavors = findFlavors(nextData);
        if (flavors.length > 0) {
          cookies = flavors;
          strategy = 'nextjs_data';
        }
      } catch (e) {
        console.log('Next data parse failed:', e.message);
      }
    }

    // --- Strategy 2: HTML regex fallback ---
    if (cookies.length === 0) {
      cookies = scrapeFromHTML(html);
      strategy = 'html_regex';
    }

    // Week range
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return res.status(200).json({
      weekRange: `${fmt(monday)} \u2013 ${fmt(sunday)}`,
      fetchedAt: new Date().toISOString(),
      cookies,
      debug: { htmlLength: html.length, hasNextData: !!nextDataMatch, strategy }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

function findFlavors(obj, depth = 0) {
  if (depth > 12 || !obj || typeof obj !== 'object') return [];

  if (Array.isArray(obj)) {
    if (obj.length > 0 && isCookieLike(obj[0])) {
      return obj.map(normalizeCookie).filter(Boolean);
    }
    for (const item of obj) {
      const result = findFlavors(item, depth + 1);
      if (result.length > 0) return result;
    }
    return [];
  }

  const flavorKeys = ['flavors', 'cookies', 'items', 'products', 'menu', 'weeklyFlavors', 'allFlavors', 'menuItems'];
  for (const key of flavorKeys) {
    if (obj[key] && Array.isArray(obj[key]) && obj[key].length > 0 && isCookieLike(obj[key][0])) {
      return obj[key].map(normalizeCookie).filter(Boolean);
    }
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object') {
      const result = findFlavors(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
  }
  return [];
}

function isCookieLike(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const keys = Object.keys(obj).join(' ').toLowerCase();
  return (keys.includes('name') || keys.includes('title')) &&
         (keys.includes('image') || keys.includes('img') || keys.includes('description') || keys.includes('slug'));
}

function normalizeCookie(item) {
  if (!item || typeof item !== 'object') return null;
  const name = item.name || item.title || item.flavorName || '';
  const description = item.description || item.desc || item.subtitle || '';
  const image = item.imageUrl || item.image || item.imgUrl || item.thumbnailUrl || item.thumbnail || '';
  const slug = item.slug || item.urlSlug || '';
  const profileUrl = slug ? `https://crumblcookies.com/profiles/${slug}` : (item.url || '');

  const raw = JSON.stringify(item).toLowerCase();
  let availability = 'classic';
  if (raw.includes('weekly') || raw.includes('this week') || raw.includes('limited') || raw.includes('seasonal')) availability = 'weekly';
  else if (raw.includes('today') || raw.includes('daily')) availability = 'today';

  if (!name) return null;
  return { name, description, image, profileUrl, slug, availability };
}

function scrapeFromHTML(html) {
  const cookies = [];
  const seen = new Set();

  // Find images with cookie-like alt text paired with crumbl CDN src
  const imgRegex = /alt="([^"]+)"[^>]*src="(https:\/\/crumbl\.video\/[^"]*1080[^"]*)"/g;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const name = match[1].trim();
    const image = match[2];

    // Skip duplicates and non-cookie images
    if (seen.has(name) || name.includes('Pop-Tarts') || name.length < 3) continue;
    seen.add(name);

    const start = Math.max(0, match.index - 500);
    const end = Math.min(html.length, match.index + 3000);
    const block = html.substring(start, end);

    // Description: text blob after stripping tags
    const text = block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const descMatch = text.match(/(?:A |An |Our )([A-Z][^.]{20,250}\.)/);
    const description = descMatch ? descMatch[0].trim() : '';

    const profileMatch = block.match(/href="(https:\/\/crumblcookies\.com\/profiles\/([^"]+))"/);
    const profileUrl = profileMatch ? profileMatch[1] : '';
    const slug = profileMatch ? profileMatch[2] : '';

    const availMatch = block.match(/This Week Only|Today Only|Always Available/);
    let availability = 'classic';
    if (availMatch) {
      if (availMatch[0] === 'This Week Only') availability = 'weekly';
      else if (availMatch[0] === 'Today Only') availability = 'today';
    }

    cookies.push({ name, description, image, profileUrl, slug, availability });
  }

  return cookies;
}
