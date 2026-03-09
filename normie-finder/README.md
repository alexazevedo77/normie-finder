# Normie Finder

AI-powered visual similarity search for the [Normies NFT collection](https://opensea.io/collection/normies) on OpenSea.

## How it works

1. Upload any image
2. Enter your OpenSea API key
3. Claude's vision AI compares your image to 20 NFTs from the collection
4. Use the similarity slider to filter results

## Deploy to Vercel

### Option A — Drag & Drop (easiest)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Drag this entire folder into the browser
3. Click **Deploy** — done!

### Option B — Vercel CLI
```bash
npm install
npm run build
npx vercel --prod
```

### Option C — GitHub
1. Push this folder to a GitHub repo
2. Import it at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Vite — just click Deploy

## Local Development

```bash
npm install
npm run dev
```

## API Keys needed

- **OpenSea API key** — free at [docs.opensea.io](https://docs.opensea.io/reference/api-overview)
- The Anthropic API is called directly from the browser (no key required when using Claude.ai artifacts)

> ⚠️ Note: When deployed standalone, you'll need to add your Anthropic API key. Add `VITE_ANTHROPIC_API_KEY` as an environment variable in Vercel, and update the fetch call in `src/App.jsx` to include `"x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY` in the headers.
