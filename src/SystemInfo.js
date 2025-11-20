// src/Components/SystemInfo.jsx
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebaseConfig";
import { ref, onValue, off, query, limitToLast } from "firebase/database";
import "./SystemInfo.css";

const API_BASE = process.env.REACT_APP_AI_API_URL || "http://127.0.0.1:5001";

const fmt = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const tsToMs = (t) => {
    if (typeof t === "number" && Number.isFinite(t)) return t;
    if (typeof t === "string") {
        const s = t.includes(" ") ? t.replace(" ", "T") : t;
        const ms = Date.parse(s);
        if (!Number.isNaN(ms)) return ms;
    }
    return null;
};

export default function SystemInfo() {
    const navigate = useNavigate();

    // Canlı durumlar
    const [fbOk, setFbOk] = useState(false);
    const [apiOk, setApiOk] = useState(false);
    const [apiLatency, setApiLatency] = useState(null);
    const [lastCheck, setLastCheck] = useState(Date.now());

    // Son kayıt zamanları
    const [lastDoTs, setLastDoTs] = useState(null);
    const [lastUltraTs, setLastUltraTs] = useState(null);

    // Firebase dinleyicileri
    useEffect(() => {
        const unsubs = [];

        const listen = (path, setter, tsKey = "timestamp") => {
            const r = query(ref(db, path), limitToLast(1));
            const cb = (snap) => {
                setFbOk(true);
                const v = snap.val();
                if (!v) { setter(null); return; }
                const last = Object.values(v)[0];
                setter(tsToMs(last?.[tsKey]) ?? null);
            };
            onValue(r, cb, () => setFbOk(false));
            unsubs.push(() => off(r, cb));
        };

        listen("doData", setLastDoTs);
        listen("ultrasonicData", setLastUltraTs);

        return () => unsubs.forEach((u) => u());
    }, []);

    // Flask /health ping
    const pingOnce = useCallback(async () => {
        try {
            const t0 = performance.now();
            const resp = await fetch(`${API_BASE}/health`, { cache: "no-store" });
            const t1 = performance.now();
            setApiOk(resp.ok);
            setApiLatency(Math.round(t1 - t0));
        } catch {
            setApiOk(false);
            setApiLatency(null);
        } finally {
            setLastCheck(Date.now());
        }
    }, []);

    useEffect(() => {
        pingOnce();
        const id = setInterval(pingOnce, 15000);
        return () => clearInterval(id);
    }, [pingOnce]);

    // Küçük rozet
    const Pill = ({ ok, label }) => (
        <span
            className={`si-pill ${ok ? "si-ok" : "si-bad"}`}
        >
            • {label}: <b>{ok ? "Çevrimiçi" : "Kapalı"}</b>
        </span>
    );

    return (
        <div className="si">
            <div className="si-container">
                <button className="si-back" onClick={() => navigate("/")}>← Home</button>
                <h1 className="si-title">ℹ️ System Info</h1>

                {/* GENEL BAKIŞ */}
                <section className="si-card">
                    <p className="si-p">
                        Bu uygulama; tanklardaki <b>doluluk seviyesi</b> ve <b>su kalitesi</b>ni gerçek zamanlı izlemek için
                        tasarlandı. Sensör verileri <b>Firebase Realtime Database</b>&apos;e yazılır; web arayüzü bu verileri
                        çeker, grafik/tablo halinde sunar. İsteğe bağlı olarak <b>Python/Flask</b> üzerinde çalışan basit bir
                        tahmin servisi (DO kısa vadeli) bulunur.
                    </p>

                    <div className="si-badges">
                        <span className="si-chip">🔌 Veri Kaynağı: <b>Firebase Realtime Database</b></span>
                        <span className="si-chip">🧠 Tahmin Servisi: <b>Python / Flask</b></span>
                        <span className="si-chip">💻 İstemci: <b>React</b></span>
                    </div>
                </section>

                {/* SİSTEM DURUMU */}
                <section className="si-card">
                    <h2 className="si-h2">Sistem Durumu</h2>
                    <div className="si-badges">
                        <Pill ok={fbOk} label="Firebase" />
                        <Pill ok={apiOk} label="AI API (Flask)" />
                        <span className="si-pill si-info">⏱️ Son kontrol: <b>{fmt(lastCheck)}</b></span>
                        <span className="si-pill">⚡ API gecikmesi: <b>{apiLatency ?? "-"}</b> ms</span>
                        <button className="si-pill si-btn" onClick={pingOnce}>↻ Yeniden kontrol et</button>
                    </div>

                    <div className="si-kpis">
                        <div className="si-kpi">
                            <div className="si-kpi-title">Son DO Kaydı</div>
                            <div className="si-kpi-value">{lastDoTs ? fmt(lastDoTs) : "-"}</div>
                        </div>
                        <div className="si-kpi">
                            <div className="si-kpi-title">Son Ultrasonik Kaydı</div>
                            <div className="si-kpi-value">{lastUltraTs ? fmt(lastUltraTs) : "-"}</div>
                        </div>
                        <div className="si-kpi">
                            <div className="si-kpi-title">Flask API</div>
                            <div className="si-kpi-value">{API_BASE}</div>
                        </div>
                    </div>
                </section>

                {/* VERİ AKIŞI */}
                <section className="si-card">
                    <h2 className="si-h2">Veri Akışı</h2>
                    <ul className="si-list">
                        <li>🧪 Sensörler (DO/pH/Sıcaklık/Ultrasonik) Raspberry Pi mikrokontrolcüye bağlıdır.</li>
                        <li>📤 Pi, ölçümleri <b>Firebase Realtime Database</b>’e yazar (düğümler: <code>doData</code>, <code>phData</code>, <code>temperatureData</code>, <code>ultrasonicData</code>).</li>
                        <li>🌐 React istemci bu düğümleri dinler; son verileri “Dashboard, AI Analysis, Tank Fill Level” sayfalarında anında gösterir.</li>
                        <li>🧠 “AI Analysis” sayfasındaki <b>Predict Next DO</b> butonu, Flask API’ye <code>/predict_do</code> isteği gönderir; modelden tek adım tahmin döndürülür.</li>
                    </ul>
                </section>

                {/* YORUMLAMA İPUÇLARI */}
                <section className="si-card">
                    <h2 className="si-h2">Yorumlama İpuçları</h2>
                    <ul className="si-list">
                        <li>DO <b>5 mg/L ve üzeri</b> genellikle iyi kabul edilir. Eğilim okları (⬆️/⬇️) kısa vadeli trendi gösterir.</li>
                        <li>pH için kabul aralığı <b>6.5–8.5</b>’tir. Sıcaklık yükseldikçe DO düşme eğilimindedir.</li>
                        <li>Ultrasonik sensörde <code>distance_cm</code> azaldıkça su seviyesi artar. Eğer <code>water_level_cm</code> alanını direkt gönderiyorsan grafikler onu kullanır; yoksa sadece mesafe çizilir.</li>
                    </ul>
                </section>

                {/* GÜVENLİK / SAKLAMA */}
                <section className="si-card">
                    <h2 className="si-h2">Veri Güvenliği ve Saklama</h2>
                    <ul className="si-list">
                        <li>Firebase güvenlik kurallarını “herkese açık” tutma. En azından <b>okuma/yazmayı yetkili cihazlarla sınırla</b>.</li>
                        <li>Ham verileri periyodik olarak dışa aktar (CSV indir butonları var) ve arşivle.</li>
                        <li>API anahtarlarını .env dosyasında tut (<code>REACT_APP_*</code>) ve koda gömme.</li>
                    </ul>
                </section>

                {/* SSS */}
                <section className="si-card">
                    <h2 className="si-h2">SSS &amp; Sorun Giderme</h2>
                    <ul className="si-list">
                        <li>Grafikler boşsa:
                            <ul>
                                <li>Firebase yol adlarını kontrol et: <code>doData / phData / temperatureData / ultrasonicData</code></li>
                                <li>Her kayıtta <code>timestamp</code> alanı olduğundan emin ol (string “YYYY-MM-DD HH:mm:ss” veya epoch ms).</li>
                            </ul>
                        </li>
                        <li>“Predict Next DO” 500 veriyorsa:
                            <ul>
                                <li>Flask’ta <code>/meta</code> veya modelin beklediği <b>lags</b> sayısına dikkat et (biz 6 kabul ettik).</li>
                                <li>Model dosyası yolunu <code>api.py</code>’de doğru verdiğinden emin ol.</li>
                            </ul>
                        </li>
                    </ul>
                </section>

                {/* İLETİŞİM */}
                <section className="si-card">
                    <h2 className="si-h2">İletişim</h2>
                    <p className="si-p">
                        Bu sayfa kullanıcılar için özet dokümandır. Geri bildirim ve destek için proje sorumlusu / danışman ile iletişime geçebilirsiniz.
                    </p>
                </section>
            </div>
        </div>
    );
}
