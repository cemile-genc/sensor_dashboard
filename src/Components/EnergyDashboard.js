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
    BarChart,
    Bar,
} from "recharts";

/* ========================= Helpers ========================= */

const toMs = (ts) => {
    if (ts == null) return null;
    if (typeof ts === "number") return ts < 1e12 ? ts * 1000 : ts; // s→ms
    const d = new Date(ts);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
};

// YYYY-MM-DD (local)
const dayKey = (ms) => {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
};

// Trapez yöntemiyle canlı güç verisinden kWh tahmini (W → kW, ms → h)
function integrateEnergyKWh(liveRows) {
    if (!Array.isArray(liveRows) || liveRows.length < 2) return 0;
    let wh = 0; // watt-hour
    for (let i = 1; i < liveRows.length; i++) {
        const a = liveRows[i - 1];
        const b = liveRows[i];
        if (!Number.isFinite(a.p) || !Number.isFinite(b.p) || !a.ts || !b.ts) continue;
        const dt_h = (b.ts - a.ts) / 3600000; // ms→h
        // trapez alanı: ortalama güç * süre
        wh += ((a.p + b.p) / 2) * dt_h;
    }
    return wh / 1000; // Wh → kWh
}

/* ========================= Data Hooks ========================= */

// /energy/live altındaki anlık veriler (i,p,v). Anahtarlar genelde timestamp
function useEnergyLive() {
    const [rows, setRows] = useState([]);
    useEffect(() => {
        const r = query(ref(db, "/energy/live"), limitToLast(2000));
        const h = onValue(r, (snap) => {
            const v = snap.val() || {};
            const arr = Object.entries(v)
                .map(([k, obj]) => {
                    const ts = toMs(Number(k) || obj?.ts || obj?.timestamp);
                    const i = Number(obj?.i);
                    const vlt = Number(obj?.v);
                    let p = Number(obj?.p);
                    if (!Number.isFinite(p) && Number.isFinite(vlt) && Number.isFinite(i)) {
                        p = vlt * i; // güç yoksa türet
                    }
                    return {
                        ts,
                        time: ts ? new Date(ts).toLocaleTimeString() : "",
                        i: Number.isFinite(i) ? i : null,
                        v: Number.isFinite(vlt) ? vlt : null,
                        p: Number.isFinite(p) ? p : null,
                    };
                })
                .filter((x) => x.ts)
                .sort((a, b) => a.ts - b.ts);
            setRows(arr);
        });
        return () => off(r, "value", h);
    }, []);
    return rows;
}

// /energy/daily/{YYYY-MM-DD}/energy_kWh
function useEnergyDaily() {
    const [rows, setRows] = useState([]);
    useEffect(() => {
        const r = ref(db, "/energy/daily");
        const h = onValue(r, (snap) => {
            const v = snap.val() || {};
            const arr = Object.entries(v)
                .map(([key, obj]) => ({
                    day: key,
                    kWh: Number(obj?.energy_kWh ?? obj?.kWh ?? obj),
                }))
                .filter((x) => Number.isFinite(x.kWh))
                .sort((a, b) => (a.day > b.day ? 1 : -1));
            setRows(arr);
        });
        return () => off(r, "value", h);
    }, []);
    return rows;
}

/* ========================= Presentational ========================= */

function Stat({ label, value, unit, color = "#111" }) {
    return (
        <div
            style={{
                flex: 1,
                minWidth: 160,
                border: "1px solid #e6e6e6",
                borderRadius: 10,
                padding: "10px 12px",
                background: "#fff",
            }}
        >
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 20, color }}>
                {value ?? "-"}{unit ? <span style={{ fontWeight: 600, fontSize: 14 }}> {unit}</span> : null}
            </div>
        </div>
    );
}

/* ========================= Page ========================= */

export default function EnergyDashboard() {
    const live = useEnergyLive();
    const daily = useEnergyDaily();

    // Son ölçümler
    const last = live.length ? live[live.length - 1] : {};
    const V = Number.isFinite(last?.v) ? last.v.toFixed(2) : "-";
    const A = Number.isFinite(last?.i) ? last.i.toFixed(2) : "-";
    const W = Number.isFinite(last?.p) ? last.p.toFixed(2) : "-";

    // Bugünün kWh (önce daily, yoksa canlıdan integrasyon)
    const todayKey = live.length ? dayKey(live[live.length - 1].ts) : dayKey(Date.now());
    const kWhDailyRow = daily.find((d) => d.day === todayKey);
    const kWhTodayRaw = Number.isFinite(kWhDailyRow?.kWh)
        ? kWhDailyRow.kWh
        : integrateEnergyKWh(live.filter((r) => dayKey(r.ts) === todayKey));
    const kWhToday = Number.isFinite(kWhTodayRaw) ? kWhTodayRaw.toFixed(3) : "-";

    // Günlük bar grafiği için son 14 gün
    const dailyLast14 = useMemo(() => {
        const arr = daily.slice(-14);
        return arr.map((d) => ({
            day: d.day,
            kWh: d.kWh,
        }));
    }, [daily]);

    return (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "8px 12px" }}>
            <h2 style={{ margin: "8px 0 14px", fontWeight: 800 }}>Enerji Verimliliği</h2>

            {/* Summary cards */}
            <div
                style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 14,
                }}
            >
                <Stat label="Voltaj (V)" value={V} unit="V" color="#1a73e8" />
                <Stat label="Akım (A)" value={A} unit="A" color="#e37400" />
                <Stat label="Güç (W)" value={W} unit="W" color="#188038" />
                <Stat label={`Bugün (${todayKey})`} value={kWhToday} unit="kWh" color="#673ab7" />
            </div>

            {/* Live chart (V/A/W) */}
            <div
                style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 18,
                    background: "#fff",
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Anlık Üretim / Tüketim</div>
                <div style={{ height: 280 }}>
                    <ResponsiveContainer>
                        <LineChart data={live} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" minTickGap={24} />
                            <YAxis domain={["auto", "auto"]} allowDecimals />
                            <Tooltip
                                formatter={(val, name) => {
                                    const f = (x) => (Number.isFinite(Number(x)) ? Number(x).toFixed(2) : "-");
                                    const unit =
                                        name === "V" ? "V" : name === "A" ? "A" : name === "W" ? "W" : "";
                                    return [`${f(val)} ${unit}`, name];
                                }}
                            />
                            <Line
                                type="monotone"
                                name="V"
                                dataKey="v"
                                stroke="#1a73e8"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                name="A"
                                dataKey="i"
                                stroke="#e37400"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />
                            <Line
                                type="monotone"
                                name="W"
                                dataKey="p"
                                stroke="#188038"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Daily kWh bar chart */}
            <div
                style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 10,
                    padding: 14,
                    background: "#fff",
                }}
            >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Günlük Üretim (kWh)</div>
                <div style={{ height: 260 }}>
                    <ResponsiveContainer>
                        <BarChart data={dailyLast14} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="day" />
                            <YAxis domain={[0, "auto"]} />
                            <Tooltip formatter={(v) => [`${Number(v).toFixed(3)} kWh`, "Enerji"]} />
                            <Bar
                                dataKey="kWh"
                                name="Enerji"
                                fill="#673ab7"
                                radius={[6, 6, 0, 0]}
                                isAnimationActive={false}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
                    Not: Eğer /energy/daily içinde bugün için değer yoksa, üstteki canlı veriden
                    trapez integrasyonu ile **yaklaşık** kWh hesaplanır.
                </div>
            </div>
        </div>
    );
}
