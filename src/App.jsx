import { useState, useCallback, useRef } from "react";

const C = {
  bg: "#dcdcd8",
  panel: "#d0d0cc",
  border: "#aaaaaa",
  borderDark: "#888888",
  text: "#2a2a2a",
  textDim: "#666",
  textMuted: "#999",
  active: "#2a2a2a",
  btnBg: "#dcdcd8",
  btnHover: "#c8c8c4",
  accent: "#2a2a2a",
};

const px = `'Courier New', 'Lucida Console', monospace`;

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
    setDebugLog(prev => [...prev.slice(-5), msg]);
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
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        const bw = lum > 128 ? 255 : 0;
        data[i] = data[i+1] = data[i+2] = bw; data[i+3] = 255;
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
    if (!b64) return setErr("Load an image first.");
    setErr(null); setDebugLog([]); setScanning(true); setResults([]); setPhase("fetching");
    try {
      log("FETCHING NORMIES...");
      const res = await fetch("/api/nfts?limit=30");
      const nftData = await res.json();
      if (!res.ok) throw new Error(nftData.error || "Failed to fetch NFTs");
      const { nfts = [] } = nftData;
      const valid = nfts.filter(n => n.display_image_url || n.image_url);
      log(`GOT ${valid.length} NFTS`);
      if (valid.length === 0) throw new Error("No NFTs returned.");
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
          if (!firstSuccess) { log(`SCORING OK — FIRST: ${safeScore}%`); firstSuccess = true; }
        } catch (e) {
          log(`ERR #${i+1}: ${e.message.slice(0, 60)}`);
          if (i === 0) throw new Error(e.message);
        }
        setProg({ n: i+1, total: valid.length });
      }
      log(`DONE — ${scored.length} SCORED`);
      setPhase("done");
    } catch (e) {
      setErr(e.message); setPhase("idle");
    } finally { setScanning(false); }
  };

  const top10 = results.slice(0, 10);
  const vis = top10.filter(r => r.score >= thresh);
  const showGrid = phase === "analyzing" || phase === "done";

  const Btn = ({ onClick, disabled, active, children, style = {} }) => (
    <button onClick={onClick} disabled={disabled} style={{
      fontFamily: px, fontSize: 10, letterSpacing: 1, textTransform: "uppercase",
      background: active ? C.active : C.btnBg,
      color: active ? "#dcdcd8" : C.text,
      border: `1px solid ${C.borderDark}`,
      padding: "5px 14px", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, ...style
    }}
      onMouseEnter={e => { if (!disabled && !active) e.currentTarget.style.background = C.btnHover; }}
      onMouseLeave={e => { if (!disabled && !active) e.currentTarget.style.background = C.btnBg; }}
    >{children}</button>
  );

  const Label = ({ children }) => (
    <div style={{ fontFamily: px, fontSize: 9, letterSpacing: 2, color: C.textMuted, textTransform: "uppercase", marginBottom: 4 }}>
      {children}
    </div>
  );

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: px, color: C.text }}>

      {/* Nav */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" }}>NÖRMIE FINDER</div>
        <div style={{ display: "flex", gap: 24, fontSize: 10, letterSpacing: 2, color: C.textDim }}>
          <span style={{ borderBottom: `1px solid ${C.text}`, color: C.text, paddingBottom: 1 }}>SEARCH</span>
          <a href="https://opensea.io/collection/normies" target="_blank" rel="noopener noreferrer" style={{ color: C.textDim, textDecoration: "none" }}>COLLECTION</a>
          <a href="https://www.normies.art/" target="_blank" rel="noopener noreferrer" style={{ color: C.textDim, textDecoration: "none" }}>NORMIES.ART</a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", minHeight: "calc(100vh - 41px)" }}>

        {/* LEFT PANEL */}
        <div style={{ borderRight: `1px solid ${C.border}`, padding: "20px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Upload */}
          <div>
            <Label>Input Image</Label>
            <div
              onDrop={onDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              style={{
                border: `1px solid ${C.borderDark}`, background: C.panel,
                height: 120, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", position: "relative", overflow: "hidden"
              }}
            >
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => toBW(e.target.files[0])} />
              {img ? (
                <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }} />
              ) : (
                <div style={{ textAlign: "center", color: C.textMuted, fontSize: 10, letterSpacing: 1 }}>
                  <div style={{ fontSize: 22, marginBottom: 6, opacity: 0.3 }}>+</div>
                  DROP OR CLICK TO LOAD
                </div>
              )}
            </div>
          </div>

          {/* B&W Preview */}
          {bwPreview && (
            <div>
              <Label>1-Bit Conversion</Label>
              <div style={{ border: `1px solid ${C.borderDark}`, background: C.panel, height: 120, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <img src={bwPreview} alt="B&W" style={{ width: "100%", height: "100%", objectFit: "contain", imageRendering: "pixelated" }} />
              </div>
              <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1, marginTop: 4 }}>SHAPE-ONLY COMPARISON MODE</div>
            </div>
          )}

          {/* Similarity slider */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <Label>Min Similarity</Label>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{thresh}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={thresh}
              onChange={e => setThresh(+e.target.value)}
              style={{ width: "100%", accentColor: C.active, cursor: "pointer" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: C.textMuted, marginTop: 3, letterSpacing: 1 }}>
              <span>0% ALL</span><span>50%</span><span>100% EXACT</span>
            </div>
          </div>

          {/* Search button */}
          <div>
            <button
              onClick={run}
              disabled={scanning || !b64}
              style={{
                width: "100%", fontFamily: px, fontSize: 11, letterSpacing: 3,
                textTransform: "uppercase", padding: "10px 0",
                background: scanning || !b64 ? C.panel : C.active,
                color: scanning || !b64 ? C.textMuted : C.bg,
                border: `1px solid ${scanning || !b64 ? C.border : C.active}`,
                cursor: scanning || !b64 ? "not-allowed" : "pointer",
                transition: "all 0.1s"
              }}
            >
              {scanning
                ? phase === "fetching" ? "FETCHING..." : `SCORING ${prog.n} / ${prog.total}`
                : !b64 && img ? "PROCESSING..."
                : "SEARCH NORMIES"}
            </button>
          </div>

          {/* Progress bar */}
          {scanning && phase === "analyzing" && (
            <div>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, height: 4, overflow: "hidden" }}>
                <div style={{ background: C.active, height: "100%", width: `${prog.total ? (prog.n / prog.total) * 100 : 0}%`, transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 8, color: C.textMuted, marginTop: 3, letterSpacing: 1 }}>{prog.n} OF {prog.total} NFTS SCORED</div>
            </div>
          )}

          {/* Debug log */}
          {debugLog.length > 0 && (
            <div style={{ border: `1px solid ${C.border}`, background: C.panel, padding: "8px 10px" }}>
              {debugLog.map((line, i) => (
                <div key={i} style={{ fontSize: 9, color: line.startsWith("ERR") ? "#aa3333" : C.textDim, letterSpacing: 0.5, lineHeight: 1.9 }}>{line}</div>
              ))}
            </div>
          )}

          {/* Error */}
          {err && (
            <div style={{ border: `1px solid #aa3333`, background: "#f0e8e8", padding: "8px 10px", fontSize: 10, color: "#aa3333", letterSpacing: 0.5, lineHeight: 1.6 }}>
              {err}
            </div>
          )}

          {/* Status */}
          {phase === "done" && (
            <div style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1 }}>
              SCAN COMPLETE · {results.length} SCORED · {vis.length} MATCH ≥{thresh}%
            </div>
          )}
        </div>

        {/* RIGHT PANEL — Results */}
        <div style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <Label>{showGrid ? `Results ${phase === "done" ? `— ${vis.length} of top 10 match ≥${thresh}%` : `— scanning...`}` : "Results"}</Label>
            {phase === "done" && <span style={{ fontSize: 9, color: C.textMuted, letterSpacing: 1 }}>CLICK TO VIEW ON OPENSEA</span>}
          </div>

          {!showGrid && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, flexDirection: "column", gap: 12, color: C.textMuted }}>
              {/* Pixel face placeholder */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 10px)", gap: 1, opacity: 0.15 }}>
                {[0,0,1,1,1,1,0,0, 0,1,0,0,0,0,1,0, 1,0,1,0,0,1,0,1, 1,0,0,0,0,0,0,1, 1,0,1,0,0,1,0,1, 1,0,0,1,1,0,0,1, 0,1,0,0,0,0,1,0, 0,0,1,1,1,1,0,0].map((v, i) => (
                  <div key={i} style={{ width: 10, height: 10, background: v ? C.text : "transparent" }} />
                ))}
              </div>
              <div style={{ fontSize: 10, letterSpacing: 2 }}>LOAD AN IMAGE TO BEGIN</div>
            </div>
          )}

          {showGrid && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {Array.from({ length: 10 }, (_, i) => {
                const nft = vis[i];
                const isLoading = !nft && phase === "analyzing";
                const isEmpty = !nft && phase === "done";

                if (nft) {
                  const link = nft.opensea_url || `https://opensea.io/assets/ethereum/${nft.contract}/${nft.identifier}`;
                  return (
                    <a key={nft.identifier} href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                      <div
                        style={{ border: `1px solid ${C.border}`, background: C.panel, cursor: "pointer", transition: "border-color 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = C.borderDark}
                        onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                      >
                        <div style={{ position: "relative" }}>
                          <img src={nft.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block", imageRendering: "pixelated" }}
                            onError={e => { e.target.style.minHeight = "80px"; e.target.style.background = C.panel; }} />
                          <div style={{ position: "absolute", top: 0, right: 0, background: C.active, color: C.bg, fontSize: 9, fontFamily: px, padding: "2px 6px", letterSpacing: 1 }}>
                            {nft.score}%
                          </div>
                          <div style={{ position: "absolute", top: 0, left: 0, background: "rgba(220,220,216,0.85)", color: C.textDim, fontSize: 8, fontFamily: px, padding: "2px 5px" }}>
                            #{i+1}
                          </div>
                        </div>
                        <div style={{ padding: "5px 6px 6px", borderTop: `1px solid ${C.border}` }}>
                          <div style={{ fontSize: 9, color: C.text, letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {nft.name || `NORMIE #${nft.identifier}`}
                          </div>
                          <div style={{ fontSize: 8, color: C.textMuted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: 0.3 }}>
                            {nft.reason}
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                }

                return (
                  <div key={`slot-${i}`} style={{ border: `1px solid ${C.border}`, background: C.panel }}>
                    <div style={{ width: "100%", aspectRatio: "1", position: "relative", overflow: "hidden", background: C.bg }}>
                      {isLoading && (
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${C.bg} 25%, ${C.panel} 50%, ${C.bg} 75%)`, backgroundSize: "200% 100%", animation: "shimmer 1.6s infinite" }} />
                      )}
                      {isEmpty && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.border }}>—</div>
                      )}
                    </div>
                    <div style={{ padding: "5px 6px 6px", borderTop: `1px solid ${C.border}` }}>
                      <div style={{ height: 8, background: isLoading ? C.border : C.bg, width: "65%", marginBottom: 4 }} />
                      <div style={{ height: 6, background: isLoading ? C.bg : "transparent", width: "45%" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {phase === "done" && vis.length === 0 && results.length > 0 && (
            <div style={{ marginTop: 20, fontSize: 10, color: C.textMuted, letterSpacing: 1 }}>
              NO RESULTS ABOVE {thresh}% — BEST MATCH: {results[0]?.score ?? 0}% — TRY LOWERING THE SLIDER
            </div>
          )}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        input[type=range] { height: 3px; }
        a:hover { opacity: 0.7; }
        ::selection { background: #2a2a2a; color: #dcdcd8; }
      `}</style>
    </div>
  );
}
