import React from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";

function Home() {
    const navigate = useNavigate();

    return (
        <div className="home-wrapper">
            <div className="home-card">
                <h1>📊 <span className="highlight">Welcome</span></h1>
                <p className="subtext">Click the buttons below to monitor Raspberry Pi sensor data.</p>

                <div className="button-grid">
                    <button className="start-btn full-width-btn" onClick={() => navigate("/dashboard")}>
                        🔍 View Data
                    </button>

                    <button className="start-btn" onClick={() => navigate("/tank")}>
                        🛢️ Tank Fill Level
                    </button>

                    <button className="start-btn" onClick={() => navigate("/analiz")}>
                        📈 Real-Time Analysis
                    </button>

                    <button className="start-btn" onClick={() => navigate("/veriler")}>
                        📂 Historical Data
                    </button>

                    <button className="start-btn" onClick={() => navigate("/yapay-zeka")}>
                        🤖 AI Analysis
                    </button>

                    <button className="start-btn full-width-btn" onClick={() => navigate("/enerji")}>
                        ♻️ Energy Saving
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Home;
