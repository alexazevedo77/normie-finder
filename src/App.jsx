import { useState, useCallback, useRef } from "react";

const SLUG = "normies";

export default function App() {
  const [img, setImg] = useState(null);
  const [b64, setB64] = useState(null);
  const [osKey, setOsKey] = useState("");
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

  const compare = async (nftUrl) => {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 120,
        system: 'Visual similarity scorer. Return ONLY valid JSON: {"score":<0-100>,"reason":"<8 words>"}. 0=different,100=identical. Judge art style, traits, colors, mood.',
        messages: [{ role: "user", content: [
          { type: "text", text: "Reference:" },
          { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
          { type: "text", text: "NFT:" },
          { type: "image", source: { type: "url", url: nftUrl } },
          { type: "text", text: "JSON:" }
        ]}]
      })
    });
    const d = await res.json();
    return JSON.parse((d.content?.[0]?.text || '{"score":0,"reason":"error"}').replace(/```json|```/g, "").trim());
  };

  const run = async () => {
    if (!b64) return setErr("Upload an image first.");
    if (!osKey) return setErr("Enter your OpenSea API key.");
    setErr(null); setScanning(true); setResults([]); setPhase("fetching");
    try {
      const res = await fetch(`https://api.opensea.io/api/v2/collection/${SLUG}/nfts?limit=20`, {
        headers: { "x-api-key": osKey, accept: "application/json" }
      });
      if (!res.ok) throw new Error(`OpenSea ${res.status} — check API key`);
      const { nfts = [] } = await res.json();
      const valid = nfts.filter(n => n.display_image_url || n.image_url);
      setProg({ n: 0, total: valid.length });
      setPhase("analyzing");
      const scored = [];
      for (let i = 0; i < valid.length; i++) {
        const nft = valid[i];
        const url = nft.display_image_url || nft.image_url;
        try {
          const { score, reason } = await compare(url);
          scored.push({ ...nft, score, reason, url });
          setResults([...scored].sort((a, b) => b.score - a.score));
        } catch {}
        setProg({ n: i + 1, total: valid.length });
      }
      setPhase("done");
    } catch (e) { setErr(e.message); setPhase("idle"); }
    finally { setScanning(false); }
  };

  const vis = results.filter(r => r.score >= thresh);

  return (
    <div style={{ fontFamily: "'Courier New',monospace", background: "#080808", minHeight: "100vh", color: "#ccc", padding: "28px 20px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 9, letterSpacing: 7, color: "#1a3a5a", marginBottom: 10 }}>⬡ OPENSEA · NORMIES COLLECTION ⬡</div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 7, color: "#ddeeff" }}>NORMIE</div>
          <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 7, color: "#ddeeff", marginTop: -6 }}>FINDER</div>
          <div style={{ marginTop: 12, fontSize: 9, color: "#222", letterSpacing: 4 }}>UPLOAD IMAGE · AI COMPARES · FIND MATCHES</div>
        </div>

        <div onDrop={onDrop} onDragOver={e => e.preventDefault()} onClick={() => !img && fileRef.current.click()}
          style={{ border: `2px dashed ${img ? "#1a5a2a" : "#161616"}`, borderRadius: 12, padding: img ? 16 : 52, textAlign: "center", cursor: img ? "default" : "pointer", marginBottom: 20, display: "flex", alignItems: "center", gap: 18, background: img ? "#080e09" : "#090909", transition: "all 0.2s" }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => load(e.target.files[0])} />
          {img ? (<>
            <img src={img} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 10, border: "2px solid #1a5a2a", flexShrink: 0 }} />
            <div style={{ textAlign: "left", flex: 1 }}>
              <div style={{ color: "#5d5", fontSize: 11, fontWeight: 900, letterSpacing: 3 }}>✓ REFERENCE IMAGE SET</div>
              <div style={{ color: "#2a2a2a", fontSize: 10, marginTop: 6 }}>Claude will compare this to each Normie</div>
            </div>
            <button onClick={e => { e.stopPropagation(); fileRef.current.click(); }} style={{ background: "#0a0a0a", color: "#3a3a3a", border: "1px solid #151515", borderRadius: 5, padding: "7px 14px", cursor: "pointer", fontSize: 9, fontFamily: "inherit", letterSpacing: 2 }}>CHANGE</button>
          </>) : (
            <div style={{ width: "100%" }}>
              <div style={{ fontSize: 44, opacity: 0.1, marginBottom: 14 }}>⊕</div>
              <div style={{ color: "#3a3a3a", fontSize: 11, letterSpacing: 3 }}>DROP IMAGE OR CLICK TO UPLOAD</div>
              <div style={{ color: "#1e1e1e", fontSize: 10, marginTop: 8 }}>Any image to find similar Normies</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <label style={{ fontSize: 9, letterSpacing: 3, color: "#333" }}>OPENSEA API KEY</label>
            <a href="https://docs.opensea.io/reference/api-overview" target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, color: "#1a3a5a", textDecoration: "none" }}>GET FREE KEY ↗</a>
          </div>
          <input type="password" placeholder="Paste your OpenSea API key..." value={osKey} onChange={e => setOsKey(e.target.value)}
            style={{ width: "100%", background: "#0b0b0b", border: "1px solid #161616", borderRadius: 7, padding: "12px 16px", color: "#bbb", fontSize: 12, boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
        </div>

        <div style={{ background: "#0c0c0c", border: "1px solid #141414", borderRadius: 10, padding: "18px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#333", marginBottom: 4 }}>SIMILARITY THRESHOLD</div>
              <div style={{ fontSize: 10, color: "#1e1e1e" }}>Show only NFTs scoring above this</div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: thresh >= 80 ? "#5d5" : thresh >= 60 ? "#db5" : "#5af" }}>
              {thresh}<span style={{ fontSize: 14, opacity: 0.4 }}>%</span>
            </div>
          </div>
          <input type="range" min={0} max={100} value={thresh} onChange={e => setThresh(+e.target.value)}
            style={{ width: "100%", accentColor: thresh >= 80 ? "#3c3" : thresh >= 60 ? "#bb3" : "#3af", cursor: "pointer" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: "#1a1a1a", marginTop: 8, letterSpacing: 2 }}>
            <span>0% · ALL</span><span>50% · SIMILAR</span><span>100% · IDENTICAL</span>
          </div>
        </div>

        <button onClick={run} disabled={scanning} style={{
          width: "100%", padding: "17px 0", background: scanning ? "#090909" : "#06182a", color: scanning ? "#1e1e1e" : "#5af",
          border: `1px solid ${scanning ? "#0f0f0f" : "#0d2a46"}`, borderRadius: 9, fontSize: 11, letterSpacing: 6, fontWeight: 900,
          cursor: scanning ? "not-allowed" : "pointer", fontFamily: "inherit", marginBottom: 14, transition: "all 0.25s"
        }}>
          {scanning ? (phase === "fetching" ? "⟳  LOADING NORMIES..." : `⟳  ANALYZING  ${prog.n} / ${prog.total}  NFTs`) : "[ FIND SIMILAR NORMIES ]"}
        </button>

        {scanning && phase === "analyzing" && (
          <div style={{ background: "#0c0c0c", borderRadius: 4, height: 3, marginBottom: 20, overflow: "hidden" }}>
            <div style={{ background: "linear-gradient(90deg,#0a3a6a,#5af)", height: "100%", width: `${prog.total ? (prog.n / prog.total) * 100 : 0}%`, transition: "width 0.5s" }} />
          </div>
        )}

        {err && <div style={{ color: "#f65", fontSize: 11, padding: "12px 16px", background: "#0f0707", borderRadius: 7, border: "1px solid #1e0a0a", marginBottom: 20 }}>⚠ {err}</div>}

        {results.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 9, letterSpacing: 3, color: "#2a2a2a" }}>SHOWING {vis.length} / {results.length} · ≥{thresh}%</div>
              <div style={{ fontSize: 9, letterSpacing: 2, color: phase === "done" ? "#1a4a1a" : "#1a2a3a" }}>{phase === "done" ? "✓ COMPLETE" : "● SCANNING"}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))", gap: 10 }}>
              {vis.map(nft => {
                const link = nft.opensea_url || `https://opensea.io/assets/ethereum/${nft.contract}/${nft.identifier}`;
                const hi = nft.score >= 80, mid = nft.score >= 60;
                return (
                  <a key={nft.identifier} href={link} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit" }}>
                    <div style={{ background: "#0b0b0b", border: `1px solid ${hi ? "#123a12" : mid ? "#282808" : "#111"}`, borderRadius: 9, overflow: "hidden", transition: "transform 0.15s,box-shadow 0.15s", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${hi ? "#0a2a0a" : mid ? "#1a1a00" : "#0a0a1a"}`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ position: "relative" }}>
                        <img src={nft.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }} onError={e => { e.target.style.minHeight = "148px"; e.target.style.background = "#111"; }} />
                        <div style={{ position: "absolute", top: 7, right: 7, background: hi ? "rgba(0,130,0,0.95)" : mid ? "rgba(140,120,0,0.95)" : "rgba(20,20,20,0.95)", borderRadius: 5, padding: "3px 9px", fontSize: 12, fontWeight: 900, color: "#fff" }}>{nft.score}%</div>
                      </div>
                      <div style={{ padding: "9px 12px 11px" }}>
                        <div style={{ fontSize: 11, color: "#999", fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nft.name || `Normie #${nft.identifier}`}</div>
                        <div style={{ fontSize: 9, color: "#272727", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nft.reason}</div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
            {vis.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#1e1e1e" }}>
                <div style={{ fontSize: 32, marginBottom: 14 }}>○</div>
                <div style={{ fontSize: 11, letterSpacing: 2 }}>NO RESULTS ABOVE {thresh}%</div>
                <div style={{ fontSize: 10, marginTop: 8, color: "#161616" }}>Lower the threshold slider</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
