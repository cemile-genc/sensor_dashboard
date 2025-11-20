// src/Components/SensorHistory.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebaseConfig";
import { ref, onValue, off } from "firebase/database";

//  tema
const light = {
    appBg: "#f6f8fa", containerBg: "#fff", text: "#0b5394", base: "#111827",
    card: "#e6f2ff", primary: "#0b5394", badgeBg: "#f0f7ff", badgeBd: "#d0e6ff",
    btnBg: "#0074d9", btnText: "#fff", tableBd: "#d0e6ff"
};
const dark = {
    appBg: "#181818", containerBg: "#1f1f1f", text: "#79b8f3", base: "#e6e6e6",
    card: "#242424", primary: "#79b8f3", badgeBg: "#2e2e2e", badgeBd: "#444",
    btnBg: "#3a3a3a", btnText: "#f0f0f0", tableBd: "#333"
};

const fmtLocal = (ts) => new Date(ts).toLocaleString();

function parseTS(ts) {
    if (ts == null) return null;
    // 1) zaten sayıysa
    if (typeof ts === "number") return ts;
    // 2) "1711111111111" gibi numeric string
    if (typeof ts === "string" && /^\d+$/.test(ts)) return Number(ts);
    // 3) "2025-05-09 16:42:37" gibi -> "T" ekleyip Date.parse
    if (typeof ts === "string") {
        const s = ts.includes("T") ? ts : ts.replace(" ", "T");
        const t = Date.parse(s);
        return Number.isFinite(t) ? t : null;
    }
    return null;
}

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

export default function SensorHistory() {
    const navigate = useNavigate();

    const [darkMode, setDarkMode] = useState(
        () => localStorage.getItem("hist-dark") === "1"
    );
    useEffect(() => localStorage.setItem("hist-dark", darkMode ? "1" : "0"), [darkMode]);
    const theme = darkMode ? dark : light;

    const [doArr, setDO] = useState([]);           // {id, do_mg_L, voltage?, timestamp, ts}
    const [phArr, setPH] = useState([]);           // {id, ph, timestamp, ts}
    const [tArr, setT] = useState([]);           // {id, temperature, timestamp, ts}
    const [loading, setLoading] = useState(true);

    // tarih filtreleri
    const [from, setFrom] = useState(""); // "2025-09-30T00:00"
    const [to, setTo] = useState("");

    // Firebase'den oku (her düğümü ayrı dinle)
    useEffect(() => {
        setLoading(true);
        const cfgs = [
            { path: "doData", setter: setDO, map: (o) => ({ do_mg_L: num(o.do_mg_L), voltage: num(o.voltage) }) },
            { path: "phData", setter: setPH, map: (o) => ({ ph: num(o.ph) }) },
            { path: "temperatureData", setter: setT, map: (o) => ({ temperature: num(o.temperature) }) },
        ];

        const unsub = cfgs.map(({ path, setter, map }) => {
            const r = ref(db, path);
            const cb = (snap) => {
                const v = snap.val();
                if (!v) { setter([]); setLoading(false); return; }
                const arr = Object.entries(v).map(([id, o]) => {
                    const ts = parseTS(o.timestamp);
                    return { id, ...o, ...map(o), ts };
                });
                // en yeni en üstte
                arr.sort((a, b) => (b.ts ?? -Infinity) - (a.ts ?? -Infinity));
                setter(arr);
                setLoading(false);
            };
            onValue(r, cb);
            return () => off(r, cb);
        });

        return () => unsub.forEach(u => u());
    }, []);

    // tarih filtresini uygula
    const fromTs = useMemo(() => (from ? new Date(from).getTime() : -Infinity), [from]);
    const toTs = useMemo(() => (to ? new Date(to).getTime() : Infinity), [to]);

    const doRows = useMemo(
        () => doArr.filter(r => (r.ts ?? -Infinity) >= fromTs && (r.ts ?? Infinity) <= toTs),
        [doArr, fromTs, toTs]
    );
    const phRows = useMemo(
        () => phArr.filter(r => (r.ts ?? -Infinity) >= fromTs && (r.ts ?? Infinity) <= toTs),
        [phArr, fromTs, toTs]
    );
    const tRows = useMemo(
        () => tArr.filter(r => (r.ts ?? -Infinity) >= fromTs && (r.ts ?? Infinity) <= toTs),
        [tArr, fromTs, toTs]
    );

    // tek CSV (3 tabloyu birleştirerek)
    const downloadCSV = () => {
        const lines = [];
        lines.push("type,timestamp,datetime,do_mg_L,ph,temperature_C,voltage");
        doRows.forEach(r => lines.push(["DO", r.ts ?? "", r.ts ? fmtLocal(r.ts) : r.timestamp ?? "",
            r.do_mg_L ?? "", "", "", r.voltage ?? ""].join(",")));
        phRows.forEach(r => lines.push(["pH", r.ts ?? "", r.ts ? fmtLocal(r.ts) : r.timestamp ?? "",
            "", r.ph ?? "", "", ""].join(",")));
        tRows.forEach(r => lines.push(["Temp", r.ts ?? "", r.ts ? fmtLocal(r.ts) : r.timestamp ?? "",
            "", "", r.temperature ?? "", ""].join(",")));

        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "sensor_history_all.csv"; a.click();
        URL.revokeObjectURL(url);
    };

    // stiller
    const page = { background: theme.appBg, minHeight: "100vh", padding: "40px 16px" };
    const container = { maxWidth: 1100, margin: "0 auto", background: theme.containerBg, borderRadius: 16, boxShadow: "0 10px 30px rgba(0,0,0,.08)", padding: 24 };
    const title = { color: theme.text, textAlign: "center", fontSize: "2.0rem", margin: "4px 0 16px" };
    const btn = { background: theme.btnBg, color: theme.btnText, border: "none", padding: "10px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer" };
    const card = { background: theme.card, borderLeft: `6px solid ${theme.primary}`, padding: 16, borderRadius: 12, marginTop: 12 };
    const chip = { background: theme.badgeBg, border: `1px solid ${theme.badgeBd}`, borderRadius: 10, padding: "6px 10px", marginRight: 8 };

    const Table = ({ title, columns, rows, render }) => (
        <div style={{ ...card, overflowX: "auto" }}>
            <h3 style={{ marginTop: 0, color: theme.base }}>{title}</h3>
            {loading ? (
                <div style={{ color: theme.text }}>Loading…</div>
            ) : rows.length === 0 ? (
                <div style={{ color: theme.base }}>No data (selected range).</div>
            ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                        <tr style={{ background: theme.badgeBg }}>
                            {columns.map((h) => (
                                <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(render)}
                    </tbody>
                </table>
            )}
        </div>
    );

    return (
        <div style={page}>
            <div style={container}>
                <h1 style={title}>📂 Historical Data</h1>

                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8 }}>
                    <button style={{ ...btn, background: "transparent", color: theme.btnBg }} onClick={() => navigate("/")}>← Home</button>
                    <button style={btn} onClick={() => setDarkMode(v => !v)}>{darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}</button>
                    <button style={btn} onClick={downloadCSV} disabled={!doRows.length && !phRows.length && !tRows.length}>📥 Download CSV</button>
                </div>

                {/* Filtreler */}
                <div style={card}>
                    <label style={{ marginRight: 12, color: theme.base, fontWeight: 600 }}>
                        From:&nbsp;
                        <input
                            type="datetime-local"
                            value={from}
                            onChange={e => setFrom(e.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.badgeBd}`, background: theme.badgeBg, color: theme.base }}
                        />
                    </label>
                    <label style={{ marginRight: 12, color: theme.base, fontWeight: 600 }}>
                        To:&nbsp;
                        <input
                            type="datetime-local"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.badgeBd}`, background: theme.badgeBg, color: theme.base }}
                        />
                    </label>
                    <button style={{ ...btn, padding: "8px 12px" }} onClick={() => { setFrom(""); setTo(""); }}>
                        Clear
                    </button>

                    <span style={{ ...chip, marginLeft: 12 }}>DO: {doRows.length} row</span>
                    <span style={chip}>pH: {phRows.length} row</span>
                    <span style={chip}>Temp: {tRows.length} row</span>
                </div>

                {/* DO tablosu */}
                <Table
                    title="Dissolved Oxygen (doData)"
                    columns={["Date/Time", "Raw Timestamp", "DO (mg/L)", "Voltage"]}
                    rows={doRows}
                    render={(r) => (
                        <tr key={r.id}>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>
                                {r.ts ? fmtLocal(r.ts) : (r.timestamp ?? "")}
                            </td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}`, color: "#64748b" }}>
                                {r.ts ?? (r.timestamp ?? "")}
                            </td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>{r.do_mg_L ?? ""}</td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>{r.voltage ?? ""}</td>
                        </tr>
                    )}
                />

                {/* pH tablosu */}
                <Table
                    title="pH (phData)"
                    columns={["Date/Time", "Raw Timestamp", "pH"]}
                    rows={phRows}
                    render={(r) => (
                        <tr key={r.id}>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>
                                {r.ts ? fmtLocal(r.ts) : (r.timestamp ?? "")}
                            </td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}`, color: "#64748b" }}>
                                {r.ts ?? (r.timestamp ?? "")}
                            </td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>{r.ph ?? ""}</td>
                        </tr>
                    )}
                />

                {/* Sıcaklık tablosu */}
                <Table
                    title="Temperature (temperatureData)"
                    columns={["Date/Time", "Raw Timestamp", "Temp (°C)"]}
                    rows={tRows}
                    render={(r) => (
                        <tr key={r.id}>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>
                                {r.ts ? fmtLocal(r.ts) : (r.timestamp ?? "")}
                            </td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}`, color: "#64748b" }}>
                                {r.ts ?? (r.timestamp ?? "")}
                            </td>
                            <td style={{ padding: 10, borderBottom: `1px solid ${theme.tableBd}` }}>{r.temperature ?? ""}</td>
                        </tr>
                    )}
                />
            </div>
        </div>
    );
}
