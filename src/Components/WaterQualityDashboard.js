import React, { useEffect, useMemo, useState } from "react";
import { ref, onValue, off, query, limitToLast } from "firebase/database";
import { db } from "../firebaseConfig";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea,
} from "recharts";

/* ========================= Yardımcılar ========================= */

const toMs = (ts) => {
    if (ts == null) return null;
    if (typeof ts === "number") return ts < 1e12 ? ts * 1000 : ts; // s→ms
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
};

function useSeries(path, valueKeys = []) {
    const [rows, setRows] = useState([]);
    useEffect(() => {
        const r = query(ref(db, path), limitToLast(2000));
        const h = onValue(r, (snap) => {
            const v = snap.val() || {};
            const arr = Object.entries(v)
                .map(([k, obj]) => {
                    const ms = toMs(obj?.timestamp ?? k);
                    const raw = valueKeys
                        .map((kk) => obj?.[kk])
                        .find((x) => typeof x === "number" || typeof x === "string");
                    const num = Number(raw);
                    return {
                        ts: ms,
                        time: ms ? new Date(ms).toLocaleTimeString() : "",
                        val: Number.isFinite(num) ? num : null,
                    };
                })
                .filter((x) => x.ts && x.val !== null)
                .sort((a, b) => a.ts - b.ts);
            setRows(arr);
        });
        return () => off(r, "value", h);
    }, [path, valueKeys.join(",")]);
    return rows;
}

const inRange = (num, [lo, hi]) => Number.isFinite(num) && num >= lo && num <= hi;

/* ========================= Değerlendirme Metinleri ========================= */

function assessMetric(kind, last, range, unit) {
    const fmt = (x) => `${x.toFixed(2)}${unit ? " " + unit : ""}`;

    if (!Number.isFinite(last)) return "Veri yok.";
    if (last === 0) {
        switch (kind) {
            case "pH":
                return `Son pH değeri 0.00 görünüyor → ölçüm/sensör bağlantısını kontrol edin.`;
            case "DO":
                return `Son DO değeri 0.00 mg/L → prob/ölçüm arızası veya aerasyon tamamen durmuş olabilir.`;
            case "T":
                return `Sıcaklık 0°C görünüyor → sensör kablosu/okuma kontrol edilmeli.`;
            default:
                return "Değer 0 görünüyor, sensör kontrolü önerilir.";
        }
    }

    if (inRange(last, range)) {
        switch (kind) {
            case "pH":
                return `pH ${fmt(last)} → Aralık içinde ( ${range[0]}–${range[1]} ).`;
            case "DO":
                return `DO ${fmt(last)} → Aralık içinde ( ${range[0]}–${range[1]} mg/L ).`;
            case "T":
                return `Sıcaklık ${fmt(last)} → Proses aralığında ( ${range[0]}–${range[1]}°C ).`;
            default:
                return `Değer ${fmt(last)} → normal.`;
        }
    }

    // aralık dışı durum önerileri
    const [lo, hi] = range;
    if (last < lo) {
        switch (kind) {
            case "pH":
                return `pH ${fmt(last)} → DÜŞÜK ( < ${lo} ). *Baz dozu arttırın* veya asit hatlarını kontrol edin.`;
            case "DO":
                return `DO ${fmt(last)} → DÜŞÜK ( < ${lo} mg/L ). *Aerasyonu artırın* (blower/valf/dağıtıcıları kontrol edin).`;
            case "T":
                return `Sıcaklık ${fmt(last)} → DÜŞÜK ( < ${lo}°C ). *Isıtma* veya çevresel koşulları iyileştirin.`;
            default:
                return `Değer düşük: ${fmt(last)}.`;
        }
    } else {
        switch (kind) {
            case "pH":
                return `pH ${fmt(last)} → YÜKSEK ( > ${hi} ). *Asit dozu arttırın* veya baz kaçaklarını kontrol edin.`;
            case "DO":
                return `DO ${fmt(last)} → YÜKSEK ( > ${hi} mg/L ). Enerji tüketimi artabilir; *aerasyonu optimize edin* veya prob kalibrasyonunu kontrol edin.`;
            case "T":
                return `Sıcaklık ${fmt(last)} → YÜKSEK ( > ${hi}°C ). *Soğutma/ventilasyon* artırılmalı; sensör kalibrasyonu kontrol edilsin.`;
            default:
                return `Değer yüksek: ${fmt(last)}.`;
        }
    }
}

/* ========================= Kart + Grafik Bileşenleri ========================= */

function MetricCard({
    title,
    data,
    unit,
    normalRange,
    band = true,
    kind, // "pH" | "DO" | "T"
}) {
    const lastVal = data?.length ? data[data.length - 1].val : NaN;

    const status = useMemo(() => {
        if (!Number.isFinite(lastVal)) return { label: "Veri yok", color: "#9e9e9e" };
        if (lastVal === 0) return { label: `Sıfır`, color: "#ef5350" };
        if (inRange(lastVal, normalRange))
            return { label: `Normal • ${lastVal.toFixed(2)} ${unit || ""}`.trim(), color: "#34a853" };
        if (lastVal < normalRange[0])
            return { label: `Düşük • ${lastVal.toFixed(2)} ${unit || ""}`.trim(), color: "#fbbc05" };
        return { label: `Yüksek • ${lastVal.toFixed(2)} ${unit || ""}`.trim(), color: "#fbbc05" };
    }, [lastVal, normalRange, unit]);

    const dangerData = (data || []).filter((d) => {
        const x = Number(d?.val);
        if (!Number.isFinite(x)) return false;
        return x === 0 || !inRange(x, normalRange);
    });

    const fmt = (v) => {
        const num = Number(v);
        if (!Number.isFinite(num)) return "-";
        const base = unit ? `${num.toFixed(2)} ${unit}` : num.toFixed(2);
        if (num === 0) return `⚠ Anormal değer: ${base}`;
        if (!inRange(num, normalRange))
            return `⚠ Aralık dışı (${normalRange[0]}–${normalRange[1]}): ${base}`;
        return base;
    };

    const comment = useMemo(
        () => assessMetric(kind, lastVal, normalRange, unit),
        [kind, lastVal, normalRange, unit]
    );

    return (
        <div
            style={{
                border: "1px solid #e6e6e6",
                borderRadius: 10,
                padding: 14,
                marginBottom: 18,
                background: "#fff",
            }}
        >
            {/* Kart başlığı */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                }}
            >
                <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
                <div
                    style={{
                        padding: "4px 10px",
                        borderRadius: 12,
                        color: "#fff",
                        background: status.color,
                        fontSize: 12,
                    }}
                >
                    {status.label}
                </div>
            </div>

            {/* Grafik */}
            <div style={{ height: 240 }}>
                <ResponsiveContainer>
                    <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="time" minTickGap={24} />
                        <YAxis domain={["auto", "auto"]} allowDecimals />
                        <Tooltip formatter={(value) => [fmt(value), "Değer"]} />

                        {band && (
                            <ReferenceArea
                                y1={normalRange[0]}
                                y2={normalRange[1]}
                                fill="#E6F4EA"
                                fillOpacity={0.5}
                                strokeOpacity={0}
                            />
                        )}

                        <Line
                            type="monotone"
                            dataKey="val"
                            name="Değer"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                            connectNulls
                            isAnimationActive={false}
                        />
                        <Line
                            data={dangerData}
                            dataKey="val"
                            stroke="transparent"
                            dot={{ r: 5, fill: "red", stroke: "red" }}
                            activeDot={{ r: 6 }}
                            isAnimationActive={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Değerlendirme cümlesi */}
            <div
                style={{
                    marginTop: 10,
                    fontSize: 13,
                    background: "#f9fafb",
                    border: "1px dashed #e5e7eb",
                    borderRadius: 8,
                    padding: "8px 10px",
                    lineHeight: 1.4,
                }}
            >
                {comment}
            </div>
        </div>
    );
}

/* ========================= Sayfa ========================= */

export default function WaterQualityDashboard() {
    // Veri kaynakları
    const phRows = useSeries("/phData", ["ph", "value"]);
    const doRows = useSeries("/doData", ["do_mg_L", "do", "value"]);
    const tRows = useSeries("/temperatureData", ["temperature", "temp", "value"]);

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 12px" }}>
            <h2 style={{ margin: "8px 0 14px", fontWeight: 800 }}>Atıksu Kalitesi</h2>

            {/* pH: 6–9 */}
            <MetricCard
                title="pH"
                data={phRows}
                unit=""
                normalRange={[6, 9]}
                band
                kind="pH"
            />

            {/* DO: 2–8 mg/L */}
            <MetricCard
                title="Çözünmüş Oksijen (mg/L)"
                data={doRows}
                unit="mg/L"
                normalRange={[2, 8]}
                band
                kind="DO"
            />

            {/* Sıcaklık: 20–30 °C */}
            <MetricCard
                title="Sıcaklık (°C)"
                data={tRows}
                unit="°C"
                normalRange={[20, 30]}
                band
                kind="T"
            />
        </div>
    );
}
