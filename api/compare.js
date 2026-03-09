export default async function handler(req, res) {
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

  // Strip any data URL prefix if it accidentally got included
  const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

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
        system: 'Visual similarity scorer. Return ONLY valid JSON: {"score":<integer 0-100>,"reason":"<max 6 words>"}. Same-collection NFTs sharing art style score 40-60+. No extra text whatsoever.',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Reference image:' },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: cleanBase64,
              }
            },
            { type: 'text', text: 'NFT image to compare:' },
            {
              type: 'image',
              source: {
                type: 'url',
                url: nftUrl,
              }
            },
            { type: 'text', text: 'JSON only:' },
          ],
        }],
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Anthropic API error ${response.status}`,
        detail: raw.slice(0, 300),
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
}
