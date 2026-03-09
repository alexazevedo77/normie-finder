import { useState, useCallback, useRef } from "react";

export default function App() {
  const [img, setImg] = useState(null);
  const [b64, setB64] = useState(null);
  const [thresh, setThresh] = useState(50);
  const [results, setResults] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [prog, setProg] = useState({ n: 0, total: 0 });
  const [phase, setPhase] = useState("idle");
  const [err, setErr] = useState(null);
  const fileRef = useRef();

  const load = (file) => {
    if (!file?.type.startsWith("image/")) return;
    setImg(URL.createObjectURL(file));
    setResults([]); setErr(null); setPhase("idle");
    const r = new FileReader();
    r.onload = (e) => setB64(e.target.result.split(",")[1]);
    r.readAsDataURL(file);
  };

  const onDrop = useCallback((e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }, []);

  // All API calls go through Vercel serverless functions — no CORS issues, keys stay secret
  const compare = async (nftUrl) => {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: b64, nftUrl }),
    });
    if (!res.ok) throw new Error(`Compare failed: ${res.status}`);
    return await res.json();
  };

  const run = async () => {
    if (!b64) return setErr("Upload an image first.");
    setErr(null); setScanning(true); setResults([]); setPhase("fetching");
    try {
      const res = await fetch("/api/nfts?limit=30");
      if (!res.ok) throw new Error(`Failed to fetch NFTs (${res.status})`);
      const { nfts = [] } = await res.json();
      const valid = nfts.filter(n => n.display_image_url || n.image_url);
      if (valid.length === 0) throw new Error("No NFTs returned from collection.");
      setProg({ n: 0, total: valid.length });
      setPhase("analyzing");
      const scored = [];
      for (let i = 0; i < valid.length; i++) {
        const nft = valid[i];
        const url = nft.display_image_url || nft.image_url;
        try {
          const { score, reason } = await compare(url);
          scored.push({ ...nft, score: Math.max(0, Math.min(100, Number(score) || 0)), reason, url });
          setResults([...scored].sort((a, b) => b.score - a.score));
        } catch (e) {
          console.error("Compare failed for", nft.identifier, e);
        }
        setProg({ n: i + 1, total: valid.length });
      }
      setPhase("done");
    } catch (e) { setErr(e.message); setPhase("idle"); }
    finally { setScanning(false); }
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
          <div style={{ marginTop: 12, fontSize: 9, color: "#222", letterSpacing: 4 }}>UPLOAD IMAGE · AI SCORES SIMILARITY · TOP 10 SHOWN</div>
        </div>

        {/* Drop zone */}
        <div onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => !img && fileRef.current.click()}
          style={{ border: `2px dashed ${img ? "#1a5a2a" : "#161616"}`, borderRadius: 12, padding: img ? 16 : 48, textAlign: "center", cursor: img ? "default" : "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 18, background: img ? "#080e09" : "#090909", transition: "all 0.2s" }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => load(e.target.files[0])} />
          {img ? (<>
            <img src={img} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 10, border: "2px solid #1a5a2a", flexShrink: 0 }} />
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ color: "#5d5", fontSize: 11, fontWeight: 900, letterSpacing: 3 }}>✓ REFERENCE IMAGE SET</div>
              <div style={{ color: "#2a2a2a", fontSize: 10, marginTop: 6 }}>Claude will score each Normie against this</div>
            </div>
            <button onClick={e => { e.stopPropagation(); fileRef.current.click(); }}
              style={{ background: "#0a0a0a", color: "#3a3a3a", border: "1px solid #151515", borderRadius: 5, padding: "7px 14px", cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 2 }}>
              CHANGE
            </button>
          </>) : (
            <div style={{ width: "100%" }}>
              <div style={{ fontSize: 44, opacity: 0.1, marginBottom: 14 }}>⊕</div>
              <div style={{ color: "#3a3a3a", fontSize: 11, letterSpacing: 3 }}>DROP IMAGE OR CLICK TO UPLOAD</div>
              <div style={{ color: "#1e1e1e", fontSize: 10, marginTop: 8 }}>Any image to find similar Normies</div>
            </div>
          )}
        </div>

        {/* Slider */}
        <div style={{ background: "#0c0c0c", border: "1px solid #141414", borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#333", marginBottom: 3 }}>MINIMUM SIMILARITY</div>
              <div style={{ fontSize: 10, color: "#1e1e1e" }}>
                {phase === "done" ? `${vis.length} of top 10 match ≥${thresh}%` : "Filter results after scanning"}
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: scoreColor(thresh) }}>
              {thresh}<span style={{ fontSize: 14, opacity: 0.4 }}>%</span>
            </div>
          </div>
          <input type="range" min={0} max={100} value={thresh} onChange={e => setThresh(+e.target.value)}
            style={{ width: "100%", accentColor: scoreColor(thresh), cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#1a1a1a", marginTop: 6, letterSpacing: 2 }}>
            <span>0% · SHOW ALL</span><span>50%</span><span>100% · EXACT</span>
          </div>
        </div>

        {/* Button */}
        <button onClick={run} disabled={scanning} style={{
          width: "100%", padding: "17px 0", background: scanning ? "#090909" : "#06182a",
          color: scanning ? "#1e1e1e" : "#5af",
          border: `1px solid ${scanning ? "#0f0f0f" : "#0d2a46"}`,
          borderRadius: 9, fontSize: 11, letterSpacing: 6, fontWeight: 900,
          cursor: scanning ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 20, transition: "all 0.25s"
        }}>
          {scanning
            ? phase === "fetching" ? "⟳  LOADING NORMIES..." : `⟳  SCORING  ${prog.n} / ${prog.total}`
            : "[ FIND SIMILAR NORMIES ]"}
        </button>

        {/* Progress bar */}
        {scanning && phase === "analyzing" && (
          <div style={{ background: "#0c0c0c", borderRadius: 4, height: 3, marginBottom: 20, overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(90deg,#0a3a6a,#5af)", height: "100%", width: `${prog.total ? (prog.n / prog.total) * 100 : 0}%`, transition: "width 0.4s" }} />
          </div>
        )}

        {err && (
          <div style={{ color: "#f65", fontSize: 11, padding: "12px 16px", background: "#0f0707", borderRadius: 7, border: "1px solid #1e0a0a", marginBottom: 20 }}>
            ⚠ {err}
          </div>
        )}

        {/* Results grid */}
        {showGrid && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#2a2a2a" }}>
                {phase === "done"
                  ? `TOP 10 RESULTS · ${vis.length} MATCH ≥${thresh}%`
                  : `SCANNING · ${results.length} SCORED SO FAR`}
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
                      <div
                        style={{ background: "#0b0b0b", border: "1px solid #1a1a1a", borderRadius: 9, overflow: "hidden", cursor: "pointer", transition: "transform 0.15s, box-shadow 0.15s", position: "relative" }}
                        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 24px #0a0a1a"; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "2px 6px", fontSize: 9, color: "#444", zIndex: 1 }}>#{i + 1}</div>
                        <img src={nft.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                          onError={e => { e.target.style.minHeight = "100px"; e.target.style.background = "#111"; }} />
                        <div style={{ position: "absolute", top: 6, right: 6, background: scoreBg(nft.score), borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 900, color: "#fff", zIndex: 1 }}>
                          {nft.score}%
                        </div>
                        <div style={{ padding: "7px 9px 9px" }}>
                          <div style={{ fontSize: 10, color: "#888", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {nft.name || `Normie #${nft.identifier}`}
                          </div>
                          <div style={{ fontSize: 8, color: "#2a2a2a", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nft.reason}</div>
                        </div>
                      </div>
                    </a>
                  );
                }

                return (
                  <div key={`slot-${i}`} style={{ borderRadius: 9, overflow: "hidden", border: "1px solid #111", background: "#0b0b0b" }}>
                    <div style={{ width: "100%", aspectRatio: "1", background: "#0d0d0d", position: "relative", overflow: "hidden" }}>
                      {isLoading && (
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, #0d0d0d 25%, #161616 50%, #0d0d0d 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
                      )}
                      {isEmpty && (
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#1a1a1a", fontSize: 18 }}>—</div>
                      )}
                    </div>
                    <div style={{ padding: "7px 9px 9px" }}>
                      <div style={{ height: 10, borderRadius: 3, background: isLoading ? "#141414" : "#0e0e0e", marginBottom: 5, width: "70%" }} />
                      <div style={{ height: 8, borderRadius: 3, background: isLoading ? "#111" : "#0c0c0c", width: "50%" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {phase === "done" && vis.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 20, color: "#2a2a2a" }}>
                <div style={{ fontSize: 11, letterSpacing: 2 }}>NO RESULTS ABOVE {thresh}%</div>
                <div style={{ fontSize: 10, marginTop: 6, color: "#1a1a1a" }}>
                  Best match: {results[0]?.score ?? 0}% — try lowering the slider
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
