// src/Components/AIAnalysis.jsx
import React, { useEffect, useState, useMemo } from "react";
import { db } from "./firebaseConfig";
import { ref, onValue, get, off } from "firebase/database";
import { useNavigate } from "react-router-dom";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

/* ===========================
   Tema Paletleri
   =========================== */
const light = {
    appBg: "#f6f8fa",
    containerBg: "#fff",
    text: "#0b5394",
    baseText: "#111827",
    subtleText: "#333",
    cardBg: "#e6f2ff",
    primary: "#0b5394",
    badgeBg: "#f0f7ff",
    badgeBd: "#d0e6ff",
    btnBg: "#0074d9",
    btnText: "#fff",
    grid: "#cfd8e3",
    axis: "#334155",
    warnBg: "#ffe6e6",
    warnText: "#a94442",
    warnBd: "#f5c6cb",
    tooltipBd: "#d0e6ff",
};
const dark = {
    appBg: "#181818",
    containerBg: "#1f1f1f",
    text: "#79b8f3",
    baseText: "#e6e6e6",
    subtleText: "#d4d4d4",
    cardBg: "#242424",
    primary: "#79b8f3",
    badgeBg: "#2e2e2e",
    badgeBd: "#444",
    btnBg: "#3a3a3a",
    btnText: "#f0f0f0",
    grid: "#2f2f2f",
    axis: "#e6e6e6",
    warnBg: "#4a1a1a",
    warnText: "#fdd",
    warnBd: "#c77",
    tooltipBd: "#444",
};

/* Kurallar/Eşikler */
const RULES = { doMin: 5, phMin: 6.5, phMax: 8.5, tempMax: 32 };

/* API adresi (.env ile yönetilebilir) */
const API_BASE = process.env.REACT_APP_AI_API_URL || "http://127.0.0.1:5001";

/* Yardımcılar */
const fmtTime = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString();
};
const fmtFull = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
};
const numsChron = (data, key) =>
    data.map((d) => parseFloat(d?.[key])).filter(Number.isFinite).slice().reverse();

const linRegSlope = (ys) => {
    const n = ys.length;
    if (n < 3) return 0;
    let sumX = 0,
        sumY = 0,
        sumXY = 0,
        sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += ys[i];
        sumXY += i * ys[i];
        sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom ? (n * sumXY - sumX * sumY) / denom : 0;
};
const zScore = (ys, lookback = 20) => {
    if (ys.length < 3) return 0;
    const seg = ys.slice(-lookback);
    const mean = seg.reduce((a, b) => a + b, 0) / seg.length;
    const variance =
        seg.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(seg.length - 1, 1);
    const std = Math.sqrt(variance) || 1e-6;
    const last = seg[seg.length - 1];
    return (last - mean) / std;
};
const trendText = (slope, unit) =>
    Math.abs(slope) < 0.001
        ? "➡️ stabil"
        : slope > 0
            ? `⬆️ artıyor (~${slope.toFixed(2)} ${unit}/ölçüm)`
            : `⬇️ azalıyor (~${slope.toFixed(2)} ${unit}/ölçüm)`;

const classifyWater = (doVal, phVal, tVal) => {
    let score = 0;
    if (doVal >= RULES.doMin) score++;
    if (phVal >= RULES.phMin && phVal <= RULES.phMax) score++;
    if (tVal >= 0 && tVal <= 35) score++;
    if (score === 3) return "✅ Water quality: Good (demo)";
    if (score === 2) return "🟡 Water quality: Fair (demo)";
    return "🔴 Water quality: Poor (demo)";
};

const getStats = (data, key) => {
    const vals = data.map((d) => parseFloat(d?.[key])).filter(Number.isFinite);
    if (!vals.length)
        return { last: "-", avg: "-", max: "-", min: "-", timestamp: "-" };
    const last = vals[0];
    const timestampRaw = data[0]?.timestamp;
    const timestamp = timestampRaw ? new Date(timestampRaw).toLocaleString() : "-";
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
    const max = Math.max(...vals).toFixed(2);
    const min = Math.min(...vals).toFixed(2);
    return { last, avg, max, min, timestamp };
};

/* ===========================
   Bileşen
   =========================== */
export default function AIAnalysis() {
    const navigate = useNavigate();

    // Koyu mod
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("ai-dark") === "1");
    useEffect(() => { localStorage.setItem("ai-dark", darkMode ? "1" : "0"); }, [darkMode]);
    const theme = darkMode ? dark : light;

    // Veriler
    const [doData, setDo] = useState([]);
    const [phData, setPh] = useState([]);
    const [tData, setT] = useState([]);
    const [loading, setLoading] = useState(true);

    // 🔮 Tahmin durumu
    const [predLoading, setPredLoading] = useState(false);
    const [predValue, setPredValue] = useState(null);
    const [predError, setPredError] = useState("");
    const [predClipped, setPredClipped] = useState(false);

    // Modelin beklediği lag sayısı
    const [modelLags, setModelLags] = useState(6);

    // Firebase kök test
    useEffect(() => {
        const rootRef = ref(db, "/");
        get(rootRef).catch(() => { });
    }, []);

    // Backend'ten meta bilgisi (lags) çek
    useEffect(() => {
        fetch(`${API_BASE}/meta`)
            .then((r) => r.json())
            .then((j) => {
                if (typeof j?.lags === "number") setModelLags(j.lags);
            })
            .catch(() => { });
    }, []);

    // Veri çekme + dinleyicileri temizle
    useEffect(() => {
        let done = 0;
        const refs = [];
        const cbs = [];

        const grab = (path, setter) => {
            const r = ref(db, path);
            const cb = (snap) => {
                const raw = snap.val();
                if (raw) {
                    const arr = Object.entries(raw).map(([id, v]) => ({ id, ...v }));
                    setter(arr.reverse().slice(0, 40)); // son 40
                } else {
                    setter([]);
                }
                done++;
                if (done === 3) setLoading(false);
            };
            onValue(r, cb, () => {
                done++;
                if (done === 3) setLoading(false);
            });
            refs.push(r);
            cbs.push(cb);
        };

        grab("doData", setDo);
        grab("phData", setPh);
        grab("temperatureData", setT);

        return () => refs.forEach((r, i) => off(r, cbs[i]));
    }, []);

    // AI içgörüleri
    const insights = useMemo(() => {
        const doY = numsChron(doData, "do_mg_L");
        const phY = numsChron(phData, "ph");
        const tY = numsChron(tData, "temperature");
        const out = [];

        if (doY.length) {
            const slope = linRegSlope(doY);
            const z = zScore(doY);
            const next = (doY.at(-1) ?? 0) + slope;
            out.push(
                `Dissolved Oxygen: ${trendText(slope, "mg/L")} • next≈${next.toFixed(
                    2
                )} mg/L${Math.abs(z) > 2 ? ` • 🚨 anomaly z≈${z.toFixed(2)}` : ""}`
            );
        } else out.push("Dissolved Oxygen: not enough data.");

        if (phY.length) {
            const slope = linRegSlope(phY);
            const z = zScore(phY);
            const next = (phY.at(-1) ?? 0) + slope;
            out.push(
                `pH: ${trendText(slope, "pH")} • next≈${next.toFixed(2)}${Math.abs(z) > 2 ? ` • 🚨 anomaly z≈${z.toFixed(2)}` : ""
                }`
            );
        } else out.push("pH: not enough data.");

        if (tY.length) {
            const slope = linRegSlope(tY);
            const z = zScore(tY);
            const next = (tY.at(-1) ?? 0) + slope;
            out.push(
                `Temperature: ${trendText(slope, "°C")} • next≈${next.toFixed(2)} °C${Math.abs(z) > 2 ? ` • 🚨 anomaly z≈${z.toFixed(2)}` : ""
                }`
            );
        } else out.push("Temperature: not enough data.");

        const lastDO = doY.at(-1),
            lastPH = phY.at(-1),
            lastT = tY.at(-1);
        if ([lastDO, lastPH, lastT].every(Number.isFinite)) {
            out.push(classifyWater(lastDO, lastPH, lastT));
        }
        return out;
    }, [doData, phData, tData]);

    // Öneriler
    const recommendations = useMemo(() => {
        const rec = [];
        const doLast = parseFloat(doData[0]?.do_mg_L);
        const phLast = parseFloat(phData[0]?.ph);
        const tLast = parseFloat(tData[0]?.temperature);

        if (Number.isFinite(doLast) && doLast < RULES.doMin)
            rec.push(`Tank havalandırmasını artırın (DO < ${RULES.doMin} mg/L).`);
        if (Number.isFinite(phLast) && (phLast < RULES.phMin || phLast > RULES.phMax))
            rec.push(`pH düzenleyici ekleyin (hedef ${RULES.phMin}–${RULES.phMax}).`);
        if (Number.isFinite(tLast) && tLast > RULES.tempMax)
            rec.push(
                `Sıcaklığı düşürmek için soğutma/ısı değişimi düşünün (>${RULES.tempMax}°C).`
            );

        if (!rec.length) rec.push("Her şey yolunda görünüyor. İzlemeye devam edin.");
        return rec;
    }, [doData, phData, tData]);

    // 🔮 DO tahmin butonu handler
    const handlePredictDO = async () => {
        try {
            setPredLoading(true);
            setPredError("");
            setPredValue(null);
            setPredClipped(false);            // <-- ekleme: clipped bayrağını sıfırla

            // DO serisini kronolojik sırayla al (en eski -> en yeni)
            const series = numsChron(doData, "do_mg_L");
            if (series.length < modelLags) {
                throw new Error(`Yeterli DO verisi yok. En az ${modelLags} ölçüm gerekli.`);
            }
            const lagCount = Math.min(modelLags, series.length);

            const res = await fetch(`${API_BASE}/predict_do`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ series, lags: lagCount }),
            });

            if (!res.ok) throw new Error(`API hatası (status ${res.status})`);
            const json = await res.json();
            if (typeof json?.yhat !== "number") throw new Error("Geçersiz yanıt.");
            setPredValue(json.yhat);
            setPredClipped(Boolean(json.clipped));  // <-- ekleme: clipped bilgisini al
        } catch (e) {
            setPredError(e.message || "Beklenmeyen bir hata oluştu.");
        } finally {
            setPredLoading(false);
        }
    };

    /* ===========================
       Inline stiller
       =========================== */
    const page = { background: theme.appBg, minHeight: "100vh", padding: "40px 16px" };
    const container = {
        maxWidth: 1000,
        margin: "0 auto",
        background: theme.containerBg,
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,.08)",
        padding: 24,
    };
    const title = { color: theme.text, textAlign: "center", fontSize: "2.0rem", margin: "4px 0 16px" };
    const btn = {
        background: theme.btnBg,
        color: theme.btnText,
        border: "none",
        padding: "10px 16px",
        borderRadius: 10,
        fontWeight: 700,
        cursor: "pointer",
    };
    const row = { display: "flex", gap: 12, flexWrap: "wrap", margin: "0 0 16px" };
    const card = {
        background: theme.cardBg,
        borderLeft: `6px solid ${theme.primary}`,
        padding: 16,
        borderRadius: 12,
        flex: 1,
        minWidth: 280,
    };
    const chipWrap = { display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 0" };
    const chip = {
        background: theme.badgeBg,
        border: `1px solid ${theme.badgeBd}`,
        borderRadius: 10,
        padding: "6px 10px",
        color: theme.baseText,
    };
    const H2 = ({ children }) => (
        <h2 style={{ color: theme.primary, margin: "0 0 8px" }}>{children}</h2>
    );

    // DO serisi uzunluğuna göre buton durumu
    const doSeriesLen = numsChron(doData, "do_mg_L").length;
    const canPredict = doSeriesLen >= modelLags;

    if (loading) {
        return (
            <div
                style={{
                    ...page,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.text,
                }}
            >
                Loading AI Analysis…
            </div>
        );
    }

    return (
        <div style={page}>
            <div style={container}>
                <h1 style={title}>🤖 AI Analysis</h1>

                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8 }}>
                    <button
                        style={{ ...btn, background: "transparent", color: theme.btnBg }}
                        onClick={() => navigate("/")}
                    >
                        ← Home
                    </button>
                    <button style={btn} onClick={() => setDarkMode((v) => !v)}>
                        {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                    </button>
                </div>

                <div style={row}>
                    <div style={card}>
                        <H2>Dissolved Oxygen (mg/L)</H2>
                        <Summary data={doData} k="do_mg_L" />
                        <MiniChart data={doData} k="do_mg_L" color="#4ea8ff" theme={theme} />
                    </div>
                    <div style={card}>
                        <H2>pH</H2>
                        <Summary data={phData} k="ph" />
                        <MiniChart data={phData} k="ph" color="#ff6b6b" theme={theme} />
                    </div>
                    <div style={card}>
                        <H2>Temperature (°C)</H2>
                        <Summary data={tData} k="temperature" unit="°C" />
                        <MiniChart data={tData} k="temperature" color="#51cf66" theme={theme} />
                    </div>
                </div>

                {/* İÇGÖRÜLER + 🔮 Tahmin */}
                <div style={card}>
                    <H2>Analiz - Öngörü</H2>

                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <span style={{ color: theme.baseText, fontWeight: 600 }}>
                            Lags (model): {modelLags}
                        </span>

                        <button style={btn} onClick={handlePredictDO} disabled={predLoading || !canPredict}>
                            {predLoading ? "Predicting..." : "🔮 Predict Next DO"}
                        </button>

                        {predValue !== null && (
                            <span style={chip}>
                                Next DO ≈ {predValue.toFixed(2)} mg/L{predClipped ? " (clipped)" : ""}
                            </span>
                        )}
                        {predError && (
                            <span style={{ color: theme.warnText, fontWeight: 700 }}>
                                Hata: {predError}
                            </span>
                        )}
                        {!canPredict && (
                            <span style={{ color: theme.warnText, fontWeight: 700 }}>
                                En az {modelLags} ölçüm gerekli.
                            </span>
                        )}
                    </div>

                    <ul style={{ margin: 0, paddingLeft: 18, color: theme.baseText }}>
                        {insights.map((s, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                                {s}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* ÖNERİLER */}
                <div style={{ ...card, marginTop: 12 }}>
                    <H2>Sistemsel Öneri </H2>
                    <ul style={{ margin: 0, paddingLeft: 18, color: theme.baseText }}>
                        {recommendations.map((s, i) => (
                            <li key={i} style={{ marginBottom: 6 }}>
                                {s}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Son Okumalar */}
                <div style={{ ...card, marginTop: 12 }}>
                    <H2>Son Okumalar</H2>
                    <div style={chipWrap}>
                        {(() => {
                            const s1 = getStats(doData, "do_mg_L");
                            const s2 = getStats(phData, "ph");
                            const s3 = getStats(tData, "temperature");
                            return (
                                <>
                                    <span style={chip}>DO: {s1.last} mg/L</span>
                                    <span style={chip}>pH: {s2.last}</span>
                                    <span style={chip}>Temp: {s3.last} °C</span>
                                    <span style={chip}>
                                        Date: {s1.timestamp !== "-" ? s1.timestamp : s2.timestamp}
                                    </span>
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* Küçük bileşenler */
function Summary({ data, k, unit = "" }) {
    const s = getStats(data, k);
    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(2,minmax(0,1fr))",
                gap: 8,
                color: "#111827",
            }}
        >
            <Badge label="Last" value={`${s.last} ${unit}`} />
            <Badge label="Avg" value={`${s.avg} ${unit}`} />
            <Badge label="Max" value={`${s.max} ${unit}`} />
            <Badge label="Min" value={`${s.min} ${unit}`} />
        </div>
    );
}
function Badge({ label, value }) {
    return (
        <div
            style={{
                background: "#f0f7ff",
                border: "1px solid #d0e6ff",
                borderRadius: 10,
                padding: "6px 10px",
            }}
        >
            <b>{label}:</b> {value}
        </div>
    );
}
function MiniChart({ data, k, color, theme }) {
    const d = data.slice().reverse();
    return (
        <div style={{ width: "100%", height: 120, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={d} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke={theme.grid} />
                    <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 10, fill: theme.axis }}
                        tickFormatter={fmtTime}
                        minTickGap={24}
                    />
                    <YAxis tick={{ fontSize: 10, fill: theme.axis }} width={36} />
                    <Tooltip
                        labelFormatter={fmtFull}
                        contentStyle={{
                            background: theme.containerBg,
                            border: `1px solid ${theme.tooltipBd}`,
                        }}
                    />
                    <Line type="monotone" dataKey={k} stroke={color} strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
