// src/Components/TankLevel.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebaseConfig";
import { ref, onValue, off } from "firebase/database";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

//tema özellikleri
const light = {
    appBg: "#f6f8fa", containerBg: "#fff", text: "#0b5394", base: "#111827",
    card: "#e6f2ff", primary: "#0b5394", badgeBg: "#f0f7ff", badgeBd: "#d0e6ff",
    btnBg: "#0074d9", btnText: "#fff", grid: "#cfd8e3", axis: "#334155", tooltipBd: "#d0e6ff"
};
const dark = {
    appBg: "#181818", containerBg: "#1f1f1f", text: "#79b8f3", base: "#e6e6e6",
    card: "#242424", primary: "#79b8f3", badgeBg: "#2e2e2e", badgeBd: "#444",
    btnBg: "#3a3a3a", btnText: "#f0f0f0", grid: "#2f2f2f", axis: "#e6e6e6", tooltipBd: "#444",
};

const fmt = (ts) => new Date(ts).toLocaleString();

/* -----------------------
   Normalizasyon yardımcıları
------------------------ */
const toNum = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
};

// farklı formatlardaki timestamp'i ms'e çevir
const toMs = (t) => {
    if (t === null || t === undefined) return null;

    // Doğrudan number geldiyse (ms ya da sn olabilir)
    if (typeof t === "number") {
        // saniye cinsindense ms'e çevir
        return t < 1e12 ? t * 1000 : t;
    }

    // String: "2025-10-03 13:04:02" / "2025-10-03T13:04:02"
    const s = String(t).trim();
    // ISO'ya yakınlaştır
    const isoLike = s.includes("T") ? s : s.replace(" ", "T");
    const ms = Date.parse(isoLike);
    if (Number.isFinite(ms)) return ms;

    // Olmadıysa sayıya zorla (ör. "1759485672000")
    const asNum = Number(s);
    if (Number.isFinite(asNum)) return asNum < 1e12 ? asNum * 1000 : asNum;

    return null;
};

// Firebase kaydını tek formata çevir
const normalizeRow = (raw) => {
    // timestamp anahtar adayları
    const tsRaw =
        raw?.timestamp ?? raw?.Timestamp ?? raw?.time ?? raw?.Time ?? raw?.ts ?? null;
    const ts = toMs(tsRaw);

    // mesafe anahtar adayları
    const distance =
        raw?.distance_cm ?? raw?.distance ?? raw?.Distance ??
        raw?.distanceCM ?? raw?.Empty_Distance ?? raw?.EmptyDistance ?? null;

    // seviye anahtar adayları
    const level =
        raw?.water_level_cm ?? raw?.waterLevel_cm ?? raw?.Water_Level ??
        raw?.waterLevel ?? raw?.level ?? null;

    return {
        tsRaw,                      // gelen ham ts değeri
        ts: ts ?? Date.now(),       // ts çözülemediyse şimdiyi ver (grafik/tabloda boş kalmasın)
        distance_cm: toNum(distance),
        water_level_cm: toNum(level),
    };
};


export default function TankLevel() {
    const navigate = useNavigate();

    const [darkMode, setDarkMode] = useState(() => localStorage.getItem("tank-dark") === "1");
    useEffect(() => localStorage.setItem("tank-dark", darkMode ? "1" : "0"), [darkMode]);
    const theme = darkMode ? dark : light;

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);

    //  ultrasonicData
    useEffect(() => {
        const r = ref(db, "ultrasonicData");
        const cb = (snap) => {
            const v = snap.val();
            if (!v) { setRows([]); setLoading(false); return; }

            const arr = Object.entries(v).map(([id, raw]) => {
                const n = normalizeRow(raw || {});
                return { id, ...n };
            });

            // en yeni üstte
            arr.sort((a, b) => b.ts - a.ts);
            setRows(arr);
            setLoading(false);
        };
        onValue(r, cb);
        return () => off(r, cb);
    }, []);

    const latest = rows[0] || null;

    // Grafik verisi: kronolojik sıra
    const chartData = useMemo(() => {
        return rows
            .slice()
            .reverse()
            .map((r) => ({
                timestamp: r.ts,
                distance_cm: Number.isFinite(r.distance_cm) ? r.distance_cm : null,
                water_level_cm: Number.isFinite(r.water_level_cm) ? r.water_level_cm : null,
            }));
    }, [rows]);

    // CSV indir
    const downloadCSV = () => {
        const headers = ["timestamp_ms", "datetime", "distance_cm", "water_level_cm"];
        const lines = [headers.join(",")];
        rows.forEach((r) => {
            lines.push([
                r.ts,
                fmt(r.ts),
                Number.isFinite(r.distance_cm) ? r.distance_cm : "",
                Number.isFinite(r.water_level_cm) ? r.water_level_cm : "",
            ].join(","));
        });
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "ultrasonic_history.csv"; a.click();
        URL.revokeObjectURL(url);
    };

    // stiller
    const page = { background: theme.appBg, minHeight: "100vh", padding: "40px 16px" };
    const container = { maxWidth: 1100, margin: "0 auto", background: theme.containerBg, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.08)", padding: 24 };
    const title = { color: theme.text, textAlign: "center", fontSize: "2.0rem", margin: "4px 0 16px" };
    const btn = { background: theme.btnBg, color: theme.btnText, border: "none", padding: "10px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
    const card = { background: theme.card, borderLeft: `6px solid ${theme.primary}`, padding: 16, borderRadius: 12, marginTop: 12 };
    const chip = { background: theme.badgeBg, border: `1px solid ${theme.badgeBd}`, borderRadius: 10, padding: "6px 10px", marginRight: 8, color: theme.base };

    return (
        <div style={page}>
            <div style={container}>
                <h1 style={title}>🛢️ Tank Fill Level</h1>

                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8 }}>
                    <button style={{ ...btn, background: "transparent", color: theme.btnBg }} onClick={() => navigate("/")}>← Home</button>
                    <button style={btn} onClick={() => setDarkMode(v => !v)}>{darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
                    <button style={btn} onClick={downloadCSV} disabled={!rows.length}>📥 Download CSV</button>
                </div>

                {/* Güncel durum */}
                <div style={card}>
                    <h3 style={{ marginTop: 0, color: theme.primary }}>Current Status</h3>
                    {loading ? (
                        <div style={{ color: theme.text }}>Loading…</div>
                    ) : !latest ? (
                        <div style={{ color: theme.base }}>No data yet.</div>
                    ) : (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <span style={chip}>Time: {fmt(latest.ts)}</span>
                            <span style={chip}>distance_cm: {Number.isFinite(latest.distance_cm) ? latest.distance_cm : "-"}</span>
                            <span style={chip}>water_level_cm: {Number.isFinite(latest.water_level_cm) ? latest.water_level_cm : "-"}</span>
                        </div>
                    )}
                </div>

                {/* Trend */}
                <div style={card}>
                    <h3 style={{ marginTop: 0, color: theme.primary }}>Trend</h3>
                    <div style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                                <CartesianGrid stroke={theme.grid} />
                                <XAxis
                                    dataKey="timestamp"
                                    tick={{ fontSize: 10, fill: theme.axis }}
                                    tickFormatter={(v) => new Date(v).toLocaleTimeString()}
                                    minTickGap={24}
                                />
                                <YAxis tick={{ fontSize: 10, fill: theme.axis }} width={40} />
                                <Tooltip
                                    labelFormatter={(v) => new Date(v).toLocaleString()}
                                    contentStyle={{ background: theme.containerBg, border: `1px solid ${theme.tooltipBd}` }}
                                />
                                <Line type="monotone" dataKey="distance_cm" name="distance_cm" stroke="#4ea8ff" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="water_level_cm" name="water_level_cm" stroke="#51cf66" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Tablo */}
                <div style={{ ...card, overflowX: "auto" }}>
                    {loading ? (
                        <div style={{ color: theme.text }}>Loading…</div>
                    ) : rows.length === 0 ? (
                        <div style={{ color: theme.base }}>No data.</div>
                    ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ background: theme.badgeBg }}>
                                    {["Date/Time", "Timestamp(ms)", "distance_cm", "water_level_cm"].map(h => (
                                        <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${theme.badgeBd}` }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ padding: 10, borderBottom: `1px solid ${theme.badgeBd}` }}>{fmt(r.ts)}</td>
                                        <td style={{ padding: 10, borderBottom: `1px solid ${theme.badgeBd}`, color: "#64748b" }}>{r.ts}</td>
                                        <td style={{ padding: 10, borderBottom: `1px solid ${theme.badgeBd}` }}>
                                            {Number.isFinite(r.distance_cm) ? r.distance_cm : ""}
                                        </td>
                                        <td style={{ padding: 10, borderBottom: `1px solid ${theme.badgeBd}` }}>
                                            {Number.isFinite(r.water_level_cm) ? r.water_level_cm : ""}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

            </div>
        </div>
    );
}
