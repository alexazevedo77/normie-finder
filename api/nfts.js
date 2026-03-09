export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.OPENSEA_API_KEY) return res.status(500).json({ error: 'OPENSEA_API_KEY env var not set' });

  const { limit = 30 } = req.query;

  try {
    const response = await fetch(
      `https://api.opensea.io/api/v2/collection/normies/nfts?limit=${limit}`,
      {
        headers: {
          'x-api-key': process.env.OPENSEA_API_KEY,
          'accept': 'application/json',
        },
      }
    );

    const raw = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: `OpenSea error ${response.status}`, detail: raw });
    }

    const data = JSON.parse(raw);
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
