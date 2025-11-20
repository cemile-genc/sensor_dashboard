// Dashboard.jsx
import React, { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import { saveAs } from "file-saver";
import { ref, onValue, get } from "firebase/database";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function Dashboard() {
  // ---- time formatters ----
  const formatTime = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleTimeString();
  };
  const formatFullTime = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
  };

  const navigate = useNavigate();
  const [doData, setDoData] = useState([]);
  const [phData, setPhData] = useState([]);
  const [temperatureData, setTemperatureData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // ---- themes ----
  const lightTheme = {
    appBg: "#f6f8fa",
    containerBg: "#fff",
    text: "#0b5394",
    cardBg: "#e6f2ff",
    primary: "#0b5394",
    badgeBg: "#f0f7ff",
    badgeBd: "#d0e6ff",
    btnBg: "#0074d9",
    btnText: "#fff",
    grid: "#cfd8e3",
    axis: "#334155",
    baseText: "#111827",
    subtleText: "#333",
    warnBg: "#ffe6e6",
    warnText: "#a94442",
    warnBd: "#f5c6cb",
    tooltipBd: "#d0e6ff",
  };

  const darkTheme = {
    appBg: "#181818",
    containerBg: "#1f1f1f",
    text: "#79b8f3",
    cardBg: "#242424",
    primary: "#79b8f3",
    badgeBg: "#2e2e2e",
    badgeBd: "#444",
    btnBg: "#3a3a3a",
    btnText: "#f0f0f0",
    grid: "#2f2f2f",
    axis: "#e6e6e6",
    baseText: "#e6e6e6",
    subtleText: "#d4d4d4",
    warnBg: "#4a1a1a",
    warnText: "#fdd",
    warnBd: "#c77",
    tooltipBd: "#444",
  };

  const theme = darkMode ? darkTheme : lightTheme;

  // ---- test root ----
  useEffect(() => {
    const rootRef = ref(db, "/");
    get(rootRef).catch(() => {});
  }, []);

  // ---- fetch ----
  useEffect(() => {
    let fetchedCount = 0;
    const fetchData = (path, setData) => {
      const dataRef = ref(db, path);
      onValue(
        dataRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const entries = Object.entries(data).map(([id, v]) => ({ id, ...v }));
            
            setData(entries.reverse().slice(0, 40)); // son 40 kayıt
          } else {
            setData([]);
          }
          fetchedCount++;
          if (fetchedCount === 3) setLoading(false);
        },
        () => {
          fetchedCount++;
          if (fetchedCount === 3) setLoading(false);
        }
      );
    };
    fetchData("doData", setDoData);
    fetchData("phData", setPhData);
    fetchData("temperatureData", setTemperatureData);
  }, []);

  // ---- basic stats (existing) ----
  const getStats = (data, key) => {
    const values = data
      .map((d) => Number.parseFloat(d?.[key]))
      .filter((v) => Number.isFinite(v));
    if (!values.length) return { last: "-", avg: "-", max: "-", min: "-", timestamp: "-" };

    const lastIdx = 0; // en yeni başta
    const last = values[lastIdx];
    const timestampRaw = data[lastIdx]?.timestamp;
    const timestamp = timestampRaw ? new Date(timestampRaw).toLocaleString() : "-";

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = (sum / values.length).toFixed(2);
    const max = Math.max(...values).toFixed(2);
    const min = Math.min(...values).toFixed(2);
    return { last, avg, max, min, timestamp };
  };


  const toNumsChron = (data, key) =>
    data.map((d) => Number.parseFloat(d?.[key])).filter(Number.isFinite).slice().reverse(); // kronolojik: en eski -> en yeni

  const linRegSlope = (ys) => {
    const n = ys.length;
    if (n < 3) return 0;
    const xs = Array.from({ length: n }, (_, i) => i);
    const sumX = (n - 1) * n / 2;                 // 0..n-1
    const sumX2 = (n - 1) * n * (2 * n - 1) / 6;  // kareler toplamı
    const sumY = ys.reduce((a, b) => a + b, 0);
    const sumXY = ys.reduce((a, y, i) => a + i * y, 0);
    const denom = n * sumX2 - sumX * sumX;
    if (!denom) return 0;
    return (n * sumXY - sumX * sumY) / denom; // "ölçüm başına" artış
  };

  const trendLabel = (slope, unit) => {
    const abs = Math.abs(slope);
    if (abs < 0.001) return `➡️ eğilim: stabil`;
    return slope > 0 ? `⬆️ eğilim: artıyor (~${slope.toFixed(2)} ${unit}/ölçüm)` :
                       `⬇️ eğilim: azalıyor (~${slope.toFixed(2)} ${unit}/ölçüm)`;
  };

  const forecastNext = (ysChron, horizon = 1) => {
    const slope = linRegSlope(ysChron);
    const last = ysChron[ysChron.length - 1]; // en yeni
    return last + slope * horizon;
  };

  const zScoreLast = (ysChron, lookback = 20) => {
    if (ysChron.length < 3) return 0;
    const seg = ysChron.slice(-lookback);
    const mean = seg.reduce((a, b) => a + b, 0) / seg.length;
    const variance = seg.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(seg.length - 1, 1);
    const std = Math.sqrt(variance) || 0.00001;
    const last = seg[seg.length - 1];
    return (last - mean) / std;
  };

  const classifyWater = (doVal, phVal, tempVal) => {

    let score = 0;
    if (doVal >= 5) score += 1;            // DO makul deger
    if (phVal >= 6.5 && phVal <= 8.5) score += 1; // pH makul deger
    if (tempVal >= 0 && tempVal <= 50) score += 1; // Temp makul deger
    if (score === 3) return "✅ su kalitesi: iyi (denemwe)";
    if (score === 2) return "🟡 su kalitesi: orta (deneme)";
    return "🔴 su kalitesi: düşük (deneme)";
  };

  const buildAIInsights = () => {
    const doY = toNumsChron(doData, "do_mg_L");
    const phY = toNumsChron(phData, "ph");
    const tY  = toNumsChron(temperatureData, "temperature");

    const insights = [];

    if (doY.length) {
      const doSlope = linRegSlope(doY);
      const doZ = zScoreLast(doY, 20);
      const doNext = forecastNext(doY, 1);
      insights.push(`Oksijen (mg/L): ${trendLabel(doSlope, "mg/L")}, 1 ölçüm sonrası tahmin ≈ ${doNext.toFixed(2)} mg/L${Math.abs(doZ) > 2 ? "  | 🚨 anomali: z≈" + doZ.toFixed(2) : ""}`);
    } else {
      insights.push("Oksijen: yeterli veri yok.");
    }

    if (phY.length) {
      const phSlope = linRegSlope(phY);
      const phZ = zScoreLast(phY, 20);
      const phNext = forecastNext(phY, 1);
      insights.push(`pH: ${trendLabel(phSlope, "pH")}, 1 ölçüm sonrası tahmin ≈ ${phNext.toFixed(2)}${Math.abs(phZ) > 2 ? "  | 🚨 anomali: z≈" + phZ.toFixed(2) : ""}`);
    } else {
      insights.push("pH: yeterli veri yok.");
    }

    if (tY.length) {
      const tSlope = linRegSlope(tY);
      const tZ = zScoreLast(tY, 20);
      const tNext = forecastNext(tY, 1);
      insights.push(`Sıcaklık (°C): ${trendLabel(tSlope, "°C")}, 1 ölçüm sonrası tahmin ≈ ${tNext.toFixed(2)} °C${Math.abs(tZ) > 2 ? "  | 🚨 anomali: z≈" + tZ.toFixed(2) : ""}`);
    } else {
      insights.push("Sıcaklık: yeterli veri yok.");
    }

    // su kalitesi etiketi (son ölçümlerden)
    const lastDO  = doY.length ? doY[doY.length - 1] : undefined;
    const lastpH  = phY.length ? phY[phY.length - 1] : undefined;
    const lastTmp = tY.length  ? tY[tY.length - 1]  : undefined;
    if ([lastDO, lastpH, lastTmp].every((v) => Number.isFinite(v))) {
      insights.push(classifyWater(lastDO, lastpH, lastTmp));
    }
    return insights;
  };

  // ---- CSV/PDF (existing) ----
  const downloadCSV = (data, filename, headers) => {
    const csvRows = [headers.join(",")];
    data.forEach((item) => {
      const row = headers.map((h) => item[h] ?? "").join(",");
      csvRows.push(row);
    });
    const csvData = new Blob([csvRows.join("\n")], { type: "text/csv" });
    saveAs(csvData, filename);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Raspberry Pi Sensor Panel Report", 20, 20);

    const sections = [
      { title: "Dissolved Oxygen (mg/L)", stats: getStats(doData, "do_mg_L") },
      { title: "pH Value", stats: getStats(phData, "ph") },
      { title: "Temperature (°C)", stats: getStats(temperatureData, "temperature") },
    ];

    let y = 30;
    const line = (t) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(t, 30, y);
      y += 6;
    };
    sections.forEach(({ title, stats }) => {
      doc.setFontSize(14);
      doc.text(title, 20, y);
      doc.setFontSize(11);
      y += 8;
      line(`Date: ${stats.timestamp}`);
      line(`Last: ${stats.last}`);
      line(`Avg: ${stats.avg}`);
      line(`Max: ${stats.max}`);
      line(`Min: ${stats.min}`);
      y += 4;
    });

    // AI özetini de PDF'e ekle
    const ai = buildAIInsights();
    y += 10;
    doc.setFontSize(14);
    doc.text("AI Insights", 20, y);
    doc.setFontSize(11);
    y += 8;
    ai.forEach((row) => line(`• ${row}`));

    doc.save("sensor_report.pdf");
  };

  // ---- warnings  ----
  const checkWarnings = () => {
    const warnings = [];
    const doVal = parseFloat(doData[0]?.do_mg_L);
    const phVal = parseFloat(phData[0]?.ph);
    const tempVal = parseFloat(temperatureData[0]?.temperature);
    if (phVal > 5) warnings.push("⚠️ pH level is too high!");
    if (doVal < 2) warnings.push("⚠️ Oxygen level is too low!");
    if (tempVal <50 ) warnings.push("⚠️ Temperature is at a critical level!");
    return warnings;
  };

  // ---- styles (themed) ----
  const pageStyle = { background: theme.appBg, minHeight: "100vh" };

  const containerStyle = {
    maxWidth: 1200,
    margin: "48px auto",
    padding: 28,
    borderRadius: 20,
    background: theme.containerBg,
    boxShadow: "0 6px 20px rgba(0,0,0,.10)",
    overflowX: "hidden",
  };

  const titleStyle = {
    textAlign: "center",
    margin: "0 0 28px",
    color: theme.text,
    fontSize: "2.2rem",
    lineHeight: 1.2,
  };

  const cardStyle = {
    marginBottom: 32,
    padding: 24,
    background: theme.cardBg,
    borderLeft: `8px solid ${theme.primary}`,
    borderRadius: 14,
    overflow: "hidden",
    minWidth: 0,
    position: "relative",
  };

  const summaryStyle = {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    margin: "12px 0 16px",
    fontSize: "1.05rem",
    fontWeight: 500,
    color: theme.subtleText,
  };

  const chipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 12px",
    borderRadius: 10,
    background: theme.badgeBg,
    border: `1px solid ${theme.badgeBd}`,
    whiteSpace: "nowrap",
    color: theme.baseText,
  };

  const btnStyle = {
    background: theme.btnBg,
    color: theme.btnText,
    border: "none",
    padding: "10px 16px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 12,
  };

  const warningBoxStyle = {
    background: theme.warnBg,
    color: theme.warnText,
    border: `1px solid ${theme.warnBd}`,
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    fontWeight: 800,
  };

  const renderSummary = ({ last, avg, max, min, timestamp }, unit) => (
    <div style={summaryStyle}>
      <span style={chipStyle}>📍 <b>Last:</b>&nbsp;{Number.isFinite(last) ? `${last} ${unit}` : "-"}</span>
      <span style={chipStyle}>📅 <b>Date:</b>&nbsp;{timestamp || "-"}</span>
      <span style={chipStyle}>📊 <b>Avg:</b>&nbsp;{avg !== "-" ? `${avg} ${unit}` : "-"}</span>
      <span style={chipStyle}>🔼 <b>Max:</b>&nbsp;{max !== "-" ? `${max} ${unit}` : "-"}</span>
      <span style={chipStyle}>🔽 <b>Min:</b>&nbsp;{min !== "-" ? `${min} ${unit}` : "-"}</span>
    </div>
  );

  const renderChart = (title, data, key, unit, color) => (
    <div style={cardStyle}>
      <h2 style={{ color: theme.primary, margin: "0 0 16px", fontSize: "1.4rem" }}>{title}</h2>

      <button
        style={btnStyle}
        onClick={() => downloadCSV(data, `${key}_data.csv`, ["timestamp", key, "voltage"])}
      >
        📥 Download CSV
      </button>

      {renderSummary(getStats(data, key), unit)}

      <div style={{ width: "100%", overflow: "hidden" }}>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart
            data={data.slice().reverse()}
            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke={theme.grid} />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 12, fill: theme.axis }}
              minTickGap={24}
              tickMargin={8}
              interval="preserveStartEnd"
              tickFormatter={formatTime}
            />
            <YAxis
              unit={unit}
              allowDecimals
              domain={["auto", "auto"]}
              tick={{ fill: theme.axis }}
            />
            <Tooltip
              labelFormatter={formatFullTime}
              contentStyle={{
                background: theme.containerBg,
                border: `1px solid ${theme.tooltipBd}`,
                color: theme.baseText,
              }}
            />
            <Line
              type="monotone"
              dataKey={key}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // ---- loading ----
  if (loading) {
    return (
      <div style={{ ...pageStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: theme.text }}>
        <div style={{ border: `5px solid ${theme.grid}`, borderTop: `5px solid ${theme.primary}`, borderRadius: "50%", width: 70, height: 70, animation: "spin 1s linear infinite" }} />
        <p>Loading data...</p>
      </div>
    );
  }

  // ---- AI Insights card ----
  const renderAIInsights = () => {
    const ai = buildAIInsights();
    return (
      <div style={cardStyle}>
        <h2 style={{ color: theme.primary, margin: "0 0 12px", fontSize: "1.4rem" }}>🤖 Akıllı İçgörüler</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: theme.baseText }}>
          {ai.map((row, idx) => (
            <li key={idx} style={{ marginBottom: 8 }}>{row}</li>
          ))}
        </ul>
      </div>
    );
  };

  // ---- page ----
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={titleStyle}>💧 Raspberry Pi Sensor Panel</h1>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            style={{ ...btnStyle, background: "transparent", color: theme.btnBg, border: "none", marginBottom: 0 }}
            onClick={() => navigate("/")}
          >
            ← Home
          </button>
          <button style={btnStyle} onClick={generatePDF}>📄 Generate PDF</button>
          <button style={btnStyle} onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>

        {/* uyarılar */}
        <div style={{ marginBottom: 20 }}>
          {checkWarnings().map((w, i) => (
            <div key={i} style={warningBoxStyle}>{w}</div>
          ))}
        </div>

        {/* AI insights */}
        {renderAIInsights()}

        {/* charts */}
        {renderChart("Dissolved Oxygen (mg/L)", doData, "do_mg_L", "mg/L", "#4ea8ff")}
        {renderChart("pH Value", phData, "ph", "", "#ff6b6b")}
        {renderChart("Temperature (°C)", temperatureData, "temperature", "°C", "#51cf66")}
      </div>
    </div>
  );
}

export default Dashboard;
