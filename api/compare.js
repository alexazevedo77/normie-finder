const sharp = require('sharp');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY env var not set on Vercel' });
  }

  const { imageBase64, nftUrl } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });
  if (!nftUrl) return res.status(400).json({ error: 'Missing nftUrl' });

  // Strip any accidental data URL prefix
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

  // Fetch the NFT image and convert to JPEG using sharp
  let nftBase64;
  try {
    const nftRes = await fetch(nftUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NormieFinder/1.0)' }
    });
    if (!nftRes.ok) throw new Error(`HTTP ${nftRes.status}`);
    const arrayBuffer = await nftRes.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    // Convert to JPEG regardless of input format (handles WebP, PNG, GIF, etc.)
    const jpegBuffer = await sharp(inputBuffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    nftBase64 = jpegBuffer.toString('base64');
  } catch (e) {
    return res.status(500).json({ error: `Failed to process NFT image: ${e.message}` });
  }

  // Also convert the uploaded image buffer through sharp to ensure it's valid JPEG
  let cleanUserBase64 = cleanBase64;
  try {
    const userBuffer = Buffer.from(cleanBase64, 'base64');
    const jpegBuffer = await sharp(userBuffer)
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    cleanUserBase64 = jpegBuffer.toString('base64');
  } catch (e) {
    // If sharp fails on user image, use as-is
    console.error('User image sharp conversion failed:', e.message);
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 120,
        system: 'Visual similarity scorer. Return ONLY valid JSON: {"score":<integer 0-100>,"reason":"<max 6 words>"}. Same-collection NFTs sharing art style score 40-60+. No extra text.',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Reference image:' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: cleanUserBase64 } },
            { type: 'text', text: 'NFT to compare:' },
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: nftBase64 } },
            { type: 'text', text: 'JSON only:' },
          ],
        }],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Anthropic API error ${response.status}`,
        detail: raw.slice(0, 400),
      });
    }

    const data = JSON.parse(raw);
    const txt = data.content?.[0]?.text || '{"score":0,"reason":"no response"}';
    const match = txt.match(/\{[\s\S]*?\}/);
    const parsed = JSON.parse(match ? match[0] : '{"score":0,"reason":"parse error"}');
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
