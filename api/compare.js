export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, nftUrl } = req.body;

  if (!imageBase64 || !nftUrl) {
    return res.status(400).json({ error: 'Missing imageBase64 or nftUrl' });
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
        system: 'You are a visual similarity scorer for NFT images. Compare two images and return ONLY valid JSON: {"score":<integer 0-100>,"reason":"<max 6 words>"}. Same-collection NFTs sharing art style should score 40-60+. Score higher for shared traits, colors, character features. No extra text, just the JSON object.',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Reference image to match:' },
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
            { type: 'text', text: 'NFT to score:' },
            { type: 'image', source: { type: 'url', url: nftUrl } },
            { type: 'text', text: 'Return JSON only, e.g. {"score":72,"reason":"same hat and colors"}' },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Anthropic error: ${text}` });
    }

    const data = await response.json();
    const txt = data.content?.[0]?.text || '{"score":0,"reason":"error"}';
    const match = txt.match(/\{[^}]+\}/);
    const parsed = JSON.parse(match ? match[0] : '{"score":0,"reason":"parse error"}');

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
