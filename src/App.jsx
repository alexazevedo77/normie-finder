import { useState, useCallback, useRef } from "react";

export default function App() {
  const [img, setImg] = useState(null);
  const [bwPreview, setBwPreview] = useState(null);
  const [b64, setB64] = useState(null);
  const [thresh, setThresh] = useState(50);
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [prog, setProg] = useState({ n: 0, total: 0 });
  const [phase, setPhase] = useState("idle");
  const [err, setErr] = useState(null);
  const [debugLog, setDebugLog] = useState([]);
  const fileRef = useRef();

  const log = (msg) => {
    console.log(msg);
    setDebugLog(prev => [...prev.slice(-6), msg]);
  };

  const toBW = (file) => {
    if (!file?.type.startsWith("image/")) return;
    setResults([]); setErr(null); setPhase("idle"); setDebugLog([]);

    const objectUrl = URL.createObjectURL(file);
    setImg(objectUrl);

    const image = new Image();
    image.onload = () => {
      const MAX = 512;
      let { width, height } = image;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      // Draw original
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);

      // Get pixel data and convert to 1-bit B&W (threshold dithering)
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // 1-bit threshold: pure black or pure white
        const bw = lum > 128 ? 255 : 0;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
        data[i + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
      setBwPreview(dataUrl);
      setB64(dataUrl.split(",")[1]);
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => setErr("Failed to load image.");
    image.src = objectUrl;
  };

  const onDrop = useCallback((e) => { e.preventDefault(); toBW(e.dataTransfer.files[0]); }, []);

  const compare = async (nftUrl) => {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: b64, nftUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error + (data.detail ? ` — ${data.detail}` : ""));
    return data;
  };

  const run = async () => {
    if (!b64) return setErr("Upload an image first.");
    setErr(null); setDebugLog([]); setScanning(true); setResults([]); setPhase("fetching");
    try {
      log("Fetching NFTs...");
      const res = await fetch("/api/nfts?limit=30");
      const nftData = await res.json();
      if (!res.ok) throw new Error(nftData.error || "Failed to fetch NFTs");
      const { nfts = [] } = nftData;
      const valid = nfts.filter(n => n.display_image_url || n.image_url);
      log(`Got ${valid.length} NFTs ✓`);
      if (valid.length === 0) throw new Error("No NFTs returned. Check OPENSEA_API_KEY.");
      setProg({ n: 0, total: valid.length });
      setPhase("analyzing");
      const scored = [];
      let firstSuccess = false;
      for (let i = 0; i < valid.length; i++) {
        const nft = valid[i];
        const url = nft.display_image_url || nft.image_url;
        try {
          const { score, reason } = await compare(url);
          const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
          scored.push({ ...nft, score: safeScore, reason, url });
          setResults([...scored].sort((a, b) => b.score - a.score));
          if (!firstSuccess) { log(`Scoring works! First: ${safeScore}% ✓`); firstSuccess = true; }
        } catch (e) {
          log(`⚠ #${i + 1} failed: ${e.message.slice(0, 80)}`);
          if (i === 0) throw new Error(e.message);
        }
        setProg({ n: i + 1, total: valid.length });
      }
      log(`Complete — ${scored.length} NFTs scored`);
      setPhase("done");
    } catch (e) {
      setErr(e.message); setPhase("idle");
    } finally { setScanning(false); }
  };

  const top10 = results.slice(0, 10);
  const vis = top10.filter(r => r.score >= thresh);
  const showGrid = phase === "analyzing" || phase === "done";
  const scoreBg = (s) => s >= 75 ? "rgba(0,130,0,0.92)" : s >= 50 ? "rgba(150,130,0,0.92)" : s >= 25 ? "rgba(180,80,0,0.92)" : "rgba(25,25,25,0.92)";
  const scoreColor = (s) => s >= 75 ? "#5d5" : s >= 50 ? "#db5" : "#5af";

  return (
    <div style={{ fontFamily: "'Courier New',monospace", background: "#080808", minHeight: "100vh", color: "#ccc", padding: "28px 20px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 9, letterSpacing: 7, color: "#1a3a5a", marginBottom: 10 }}>⬡ OPENSEA · NORMIES COLLECTION ⬡</div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 7, color: "#ddeeff" }}>NORMIE</div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 7, color: "#ddeeff", marginTop: -6 }}>FINDER</div>
          <div style={{ marginTop: 12, fontSize: 9, color: "#222", letterSpacing: 4 }}>UPLOAD · CONVERTS TO 1-BIT B&W · AI MATCHES SHAPE</div>
        </div>

        {/* Upload + B&W preview side by side */}
        <div style={{ display: "grid", gridTemplateColumns: bwPreview ? "1fr 1fr" : "1fr", gap: 12, marginBottom: 20 }}>
          {/* Drop zone */}
          <div onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current.click()}
            style={{ border: `2px dashed ${img ? "#1a5a2a" : "#161616"}`, borderRadius: 12, padding: img ? 14 : 48, textAlign: "center", cursor: "pointer", display: "flex", alignItems: "center", gap: 14, background: img ? "#080e09" : "#090909", transition: "all 0.2s" }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => toBW(e.target.files[0])} />
            {img ? (<>
              <img src={img} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #1a5a2a", flexShrink: 0 }} />
              <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                <div style={{ color: "#5d5", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>✓ ORIGINAL</div>
                <div style={{ color: "#2a2a2a", fontSize: 9, marginTop: 4 }}>Click to change</div>
              </div>
            </>) : (
              <div style={{ width: "100%" }}>
                <div style={{ fontSize: 40, opacity: 0.1, marginBottom: 12 }}>⊕</div>
                <div style={{ color: "#3a3a3a", fontSize: 10, letterSpacing: 2 }}>DROP OR CLICK TO UPLOAD</div>
              </div>
            )}
          </div>

          {/* B&W preview */}
          {bwPreview && (
            <div style={{ border: "2px solid #1a2a3a", borderRadius: 12, padding: 14, background: "#090a0c", display: "flex", alignItems: "center", gap: 14 }}>
              <img src={bwPreview} alt="B&W" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #1a2a4a", flexShrink: 0, imageRendering: "pixelated" }} />
              <div style={{ textAlign: "left", flex: 1 }}>
                <div style={{ color: "#5af", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>◑ 1-BIT B&W</div>
                <div style={{ color: "#1a2a3a", fontSize: 9, marginTop: 4 }}>Shape-only comparison</div>
              </div>
            </div>
          )}
        </div>

        {/* Conversion indicator */}
        {img && !bwPreview && (
          <div style={{ textAlign: "center", color: "#2a4a6a", fontSize: 10, letterSpacing: 2, marginBottom: 16 }}>
            ⟳ CONVERTING TO 1-BIT B&W...
          </div>
        )}

        {/* Slider */}
        <div style={{ background: "#0c0c0c", border: "1px solid #141414", borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#333", marginBottom: 2 }}>MINIMUM SIMILARITY</div>
              <div style={{ fontSize: 9, color: "#1e1e1e" }}>
                {phase === "done" ? `${vis.length} of top 10 match ≥${thresh}%` : "Filter results after scanning"}
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: scoreColor(thresh) }}>
              {thresh}<span style={{ fontSize: 13, opacity: 0.4 }}>%</span>
            </div>
          </div>
          <input type="range" min={0} max={100} value={thresh} onChange={e => setThresh(+e.target.value)}
            style={{ width: "100%", accentColor: scoreColor(thresh), cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#1a1a1a", marginTop: 5, letterSpacing: 2 }}>
            <span>0% · ALL</span><span>50%</span><span>100% · EXACT</span>
          </div>
        </div>

        {/* Button */}
        <button onClick={run} disabled={scanning || !b64} style={{
          width: "100%", padding: "16px 0",
          background: scanning ? "#090909" : !b64 ? "#090909" : "#06182a",
          color: scanning || !b64 ? "#1e1e1e" : "#5af",
          border: `1px solid ${scanning || !b64 ? "#0f0f0f" : "#0d2a46"}`,
          borderRadius: 9, fontSize: 11, letterSpacing: 6, fontWeight: 900,
          cursor: scanning || !b64 ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 20, transition: "all 0.25s"
        }}>
          {scanning
            ? phase === "fetching" ? "⟳  LOADING NORMIES..." : `⟳  SCORING  ${prog.n} / ${prog.total}`
            : "[ FIND SIMILAR NORMIES ]"}
        </button>

        {/* Progress bar */}
        {scanning && phase === "analyzing" && (
          <div style={{ background: "#0c0c0c", borderRadius: 4, height: 3, marginBottom: 12, overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(90deg,#0a3a6a,#5af)", height: "100%", width: `${prog.total ? (prog.n / prog.total) * 100 : 0}%`, transition: "width 0.4s" }} />
          </div>
        )}

        {/* Debug log */}
        {debugLog.length > 0 && (
          <div style={{ marginBottom: 16, padding: "10px 14px", background: "#090d0f", border: "1px solid #0d1e28", borderRadius: 7 }}>
            {debugLog.map((line, i) => (
              <div key={i} style={{ fontSize: 10, color: line.startsWith("⚠") ? "#f65" : "#2a5a7a", letterSpacing: 0.5, lineHeight: 1.8 }}>{line}</div>
            ))}
          </div>
        )}

        {err && (
          <div style={{ color: "#f65", fontSize: 11, padding: "12px 16px", background: "#0f0707", borderRadius: 7, border: "1px solid #1e0a0a", marginBottom: 20, lineHeight: 1.6 }}>
            ⚠ {err}
          </div>
        )}

        {/* Results grid */}
        {showGrid && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#2a2a2a" }}>
                {phase === "done" ? `TOP 10 · ${vis.length} MATCH ≥${thresh}%` : `SCANNING · ${results.length} SCORED`}
              </div>
              {phase === "done" && <div style={{ fontSize: 9, letterSpacing: 2, color: "#1a4a1a" }}>✓ COMPLETE</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {Array.from({ length: 10 }, (_, i) => {
                const nft = vis[i];
                const isLoading = !nft && phase === "analyzing";
                const isEmpty = !nft && phase === "done";
                if (nft) {
                  const link = nft.opensea_url || `https://opensea.io/assets/ethereum/${nft.contract}/${nft.identifier}`;
                  return (
                    <a key={nft.identifier} href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ background: "#0b0b0b", border: "1px solid #1a1a1a", borderRadius: 9, overflow: "hidden", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", position: "relative" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 20px #050510"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                        <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.85)", borderRadius: 3, padding: "2px 5px", fontSize: 8, color: "#444", zIndex: 1 }}>#{i + 1}</div>
                        <img src={nft.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                          onError={e => { e.target.style.minHeight = "80px"; e.target.style.background = "#111"; }} />
                        <div style={{ position: "absolute", top: 5, right: 5, background: scoreBg(nft.score), borderRadius: 3, padding: "2px 6px", fontSize: 10, fontWeight: 900, color: "#fff", zIndex: 1 }}>{nft.score}%</div>
                        <div style={{ padding: "6px 8px 8px" }}>
                          <div style={{ fontSize: 9, color: "#777", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nft.name || `Normie #${nft.identifier}`}</div>
                          <div style={{ fontSize: 8, color: "#252525", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nft.reason}</div>
                        </div>
                      </div>
                    </a>
                  );
                }
                return (
                  <div key={`slot-${i}`} style={{ borderRadius: 9, overflow: "hidden", border: "1px solid #111", background: "#0b0b0b" }}>
                    <div style={{ width: "100%", aspectRatio: "1", background: "#0d0d0d", position: "relative", overflow: "hidden" }}>
                      {isLoading && <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #0d0d0d 25%, #161616 50%, #0d0d0d 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />}
                      {isEmpty && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1a1a", fontSize: 16 }}>—</div>}
                    </div>
                    <div style={{ padding: "6px 8px 8px" }}>
                      <div style={{ height: 9, borderRadius: 2, background: isLoading ? "#141414" : "#0e0e0e", marginBottom: 4, width: "70%" }} />
                      <div style={{ height: 7, borderRadius: 2, background: isLoading ? "#111" : "#0c0c0c", width: "50%" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {phase === "done" && vis.length === 0 && results.length > 0 && (
              <div style={{ textAlign: "center", marginTop: 20, color: "#2a2a2a" }}>
                <div style={{ fontSize: 10, letterSpacing: 2 }}>NO RESULTS ABOVE {thresh}%</div>
                <div style={{ fontSize: 9, marginTop: 5, color: "#1a1a1a" }}>Best: {results[0]?.score ?? 0}% — lower the slider</div>
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
