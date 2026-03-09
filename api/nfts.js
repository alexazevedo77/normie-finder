export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { limit = 20 } = req.query;

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

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `OpenSea error: ${text}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
