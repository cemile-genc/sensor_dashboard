// src/Components/Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

export default function Home() {
    const navigate = useNavigate();
    const go = (path) => () => navigate(path);

    return (
        <main className="home-wrapper">
            <section className="home-card" aria-labelledby="home-title">
                <h1 id="home-title" className="home-title">
                    <span aria-hidden="true">📊</span> <span className="highlight">Welcome</span>
                </h1>
                <p className="subtext">
                    Click the buttons below to monitor Raspberry Pi sensor data.
                </p>

                {/* BUTONLAR */}
                <div className="home-actions" role="navigation" aria-label="Main shortcuts">
                    <button className="action-btn span-2" onClick={go("/userdashboard")}>
                        <span className="ico" aria-hidden="true">🔍</span>
                        <span>View Data</span>
                    </button>

                    <button className="action-btn" onClick={go("/tank")}>
                        <span className="ico" aria-hidden="true">🛢️</span>
                        <span>Tank Fill Level</span>
                    </button>

                    <button className="action-btn" onClick={go("/veriler")}>
                        <span className="ico" aria-hidden="true">📂</span>
                        <span>Historical Data</span>
                    </button>

                    <button className="action-btn" onClick={go("/ai-analysis")}>
                        <span className="ico" aria-hidden="true">🤖</span>
                        <span>AI Analysis</span>
                    </button>

                    <button className="action-btn span-2" onClick={go("/info")}>
                        <span className="ico" aria-hidden="true">♻️</span>
                        <span>System Info</span>
                    </button>

                    <button className="action-btn span-2" onClick={go("/quality")}>
                        <span className="ico" aria-hidden="true">♻️</span>
                        <span>Atıksu Kalitesi</span>
                    </button>

                    <button className="action-btn span-2" onClick={go("/energy")}>
                        <span className="ico" aria-hidden="true">♻️</span>
                        <span>Enerji Verimliliği</span>
                    </button>

                    <button className="action-btn span-2" onClick={go("/anomalies")}>
                        <span className="ico" aria-hidden="true">♻️</span>
                        <span>Anomali Geçmişi</span>
                    </button>

                    <button className="action-btn span-2" onClick={go("/calibration")}>
                        <span className="ico" aria-hidden="true">♻️</span>
                        <span>Kalibrasyon</span>
                    </button>
                </div>
            </section>
        </main>
    );
}
