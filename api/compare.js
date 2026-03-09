export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType = 'image/jpeg', nftUrl } = req.body;

  if (!imageBase64) return res.status(400).json({ error: 'Missing imageBase64' });
  if (!nftUrl) return res.status(400).json({ error: 'Missing nftUrl' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY env var not set' });

  // Anthropic only supports these media types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const safeMediaType = allowedTypes.includes(mediaType) ? mediaType : 'image/jpeg';

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
        system: 'You are a visual similarity scorer. Compare two images and return ONLY valid JSON: {"score":<integer 0-100>,"reason":"<max 6 words>"}. Same-collection NFTs sharing art style should score 40-60+. No extra text.',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Reference image:' },
            { type: 'image', source: { type: 'base64', media_type: safeMediaType, data: imageBase64 } },
            { type: 'text', text: 'NFT image:' },
            { type: 'image', source: { type: 'url', url: nftUrl } },
            { type: 'text', text: 'JSON score only:' },
          ],
        }],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: `Anthropic API error ${response.status}`, detail: raw });
    }

    const data = JSON.parse(raw);
    const txt = data.content?.[0]?.text || '{"score":0,"reason":"no response"}';
    const match = txt.match(/\{[^}]+\}/);
    const parsed = JSON.parse(match ? match[0] : '{"score":0,"reason":"parse error"}');
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
