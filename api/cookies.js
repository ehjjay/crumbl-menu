export default async function handler(req, res) {
  // Allow CORS so the frontend HTML can call this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600'); // cache 1 hour on Vercel edge

  try {
    const response = await fetch('https://crumblcookies.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Failed to fetch Crumbl website' });
    }

    const html = await response.text();

    // Extract cookie data using regex patterns from the HTML
    const cookies = [];

    // Match each cookie block — name, description, image, profile URL, availability tag
    const cookieBlockRegex = /<img[^>]+alt="([^"]+)"[^>]+src="(https:\/\/crumbl\.video[^"]+1080[^"]+)"[\s\S]*?<\/img>([\s\S]*?)(?=<img[^>]+alt="|Always Available|$)/g;

    // Simpler targeted approach: extract from the structured sections
    // Weekly flavors section
    const weeklySection = html.match(/Weekly Flavors([\s\S]*?)Always Available/)?.[1] || '';
    const classicSection = html.match(/Always Available[\s\S]*?Classic Flavors([\s\S]*?)<\/section>/)?.[1] || '';

    function extractCookies(section, availability) {
      const results = [];
      // Find cookie name + description pairs
      const nameRegex = /This Week Only|Today Only/g;
      
      // Extract image alt (cookie name) and nearby description
      const imgRegex = /alt="([^"]+Cookie[^"]*)"[^>]*src="(https:\/\/crumbl\.video\/[^"]*1080[^"]*)"/g;
      const profileRegex = /href="(https:\/\/crumblcookies\.com\/profiles\/[^"]+)"/g;
      const descRegex = /(?:This Week Only|Today Only|Always Available)[\s\S]*?([A-Z][^.!?]*(?:cookie|Cookie|frosting|cream|chocolate|vanilla|caramel|peanut|strawberry|brownie|cinnamon)[^.!?]*\.)/gi;

      let imgMatch;
      const imgMatches = [];
      const tempRegex = /alt="([^"]+)"[^>]*src="(https:\/\/crumbl\.video\/[^"]*1080[^"]*)"/g;
      while ((imgMatch = tempRegex.exec(section)) !== null) {
        if (!imgMatch[1].includes('Pop-Tarts') && !imgMatch[1].includes('ft.')) {
          imgMatches.push({ name: imgMatch[1], image: imgMatch[2] });
        }
      }

      const profileMatches = [];
      let profileMatch;
      const tempProfileRegex = /href="(https:\/\/crumblcookies\.com\/profiles\/[^"]+)"/g;
      while ((profileMatch = tempProfileRegex.exec(section)) !== null) {
        if (!profileMatches.includes(profileMatch[1])) {
          profileMatches.push(profileMatch[1]);
        }
      }

      // Extract descriptions — text between cookie name heading and Learn More link
      const descMatches = [];
      const descBlockRegex = /(?:This Week Only|Today Only)([\s\S]*?)(?:Learn More|Order Now)/g;
      let descBlock;
      while ((descBlock = descBlockRegex.exec(section)) !== null) {
        const cleaned = descBlock[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 20) descMatches.push(cleaned);
      }

      // Deduplicate image matches
      const seen = new Set();
      imgMatches.forEach((item, i) => {
        if (!seen.has(item.name)) {
          seen.add(item.name);
          results.push({
            name: item.name,
            image: item.image,
            description: descMatches[results.length] || '',
            profileUrl: profileMatches[results.length] || '',
            availability
          });
        }
      });

      return results;
    }

    // Better approach: parse the full HTML more carefully
    const allCookies = [];
    
    // Find all cookie profile URLs and names together
    const profileLinkRegex = /href="(https:\/\/crumblcookies\.com\/profiles\/([^"]+))"/g;
    const profileLinks = [];
    let plMatch;
    while ((plMatch = profileLinkRegex.exec(html)) !== null) {
      const slug = plMatch[2];
      const url = plMatch[1];
      if (!profileLinks.find(p => p.url === url)) {
        profileLinks.push({ url, slug });
      }
    }

    // For each profile link, find the surrounding cookie card data
    profileLinks.forEach(({ url, slug }) => {
      // Find the block around this profile link
      const linkPos = html.indexOf(`"${url}"`);
      if (linkPos === -1) return;

      // Look back ~2000 chars for the image and name
      const lookback = html.substring(Math.max(0, linkPos - 2000), linkPos);
      const lookforward = html.substring(linkPos, linkPos + 500);

      // Get image — find last 1080 image before this link
      const imgInBlock = [...lookback.matchAll(/src="(https:\/\/crumbl\.video\/[^"]*1080[^"]*)"/g)];
      const lastImg = imgInBlock[imgInBlock.length - 1];

      // Get alt text (cookie name) near that image
      const altInBlock = [...lookback.matchAll(/alt="([^"]+)"/g)];
      const lastName = altInBlock[altInBlock.length - 1];

      // Get availability tag
      const availTag = lookback.includes('This Week Only') ? 'weekly' :
                       lookback.includes('Today Only') ? 'today' : 'classic';

      // Get description — text content between availability tag and Learn More
      const descArea = lookback.split('This Week Only').pop().split('Today Only').pop();
      const descClean = descArea.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      // Get last substantial text chunk
      const descParts = descClean.split(/\s{2,}/).filter(p => p.length > 30);
      const description = descParts[descParts.length - 1] || '';

      if (lastName && lastImg) {
        // Avoid duplicates
        if (!allCookies.find(c => c.name === lastName[1])) {
          allCookies.push({
            name: lastName[1],
            image: lastImg[1],
            description: description.replace(/^.*?(A |An |Our )/, '$1').trim(),
            profileUrl: url,
            slug,
            availability: availTag
          });
        }
      }
    });

    // Determine current week range
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekRange = `${fmt(monday)} – ${fmt(sunday)}`;

    return res.status(200).json({
      weekRange,
      fetchedAt: new Date().toISOString(),
      cookies: allCookies
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
