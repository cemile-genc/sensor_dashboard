import React, { useEffect, useState } from "react";
import { db } from "./firebaseConfig";
import { saveAs } from "file-saver";
import { ref, onValue, get } from "firebase/database";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import "./App.css";

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
    const navigate = useNavigate();
    const [doData, setDoData] = useState([]);
    const [phData, setPhData] = useState([]);
    const [temperatureData, setTemperatureData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [darkMode, setDarkMode] = useState(false);

    // ✅ Test root data
    useEffect(() => {
        const rootRef = ref(db, "/");
        get(rootRef)
            .then((snapshot) => {
                console.log("🔥 ROOT data:", snapshot.val());
            })
            .catch((err) => console.error("❌ Firebase GET error:", err));
    }, []);

    // ✅ Fetch sensor data
    useEffect(() => {
        let fetchedCount = 0;

        const fetchData = (path, setData) => {
            const dataRef = ref(db, path);
            console.log(`📡 Fetching ${path}...`);
            onValue(
                dataRef,
                (snapshot) => {
                    const data = snapshot.val();
                    console.log(`✅ ${path} snapshot:`, data);

                    if (data) {
                        const entries = Object.entries(data).map(([key, value]) => ({
                            id: key,
                            ...value,
                        }));
                        setData(entries.reverse().slice(0, 10));
                    } else {
                        console.warn(`⚠️ ${path} is empty`);
                        setData([]);
                    }

                    fetchedCount++;
                    if (fetchedCount === 3) setLoading(false);
                },
                (error) => {
                    console.error(`❌ Error fetching ${path}:`, error);
                    fetchedCount++;
                    if (fetchedCount === 3) setLoading(false);
                }
            );
        };

        fetchData("doData", setDoData);
        fetchData("phData", setPhData);
        fetchData("temperatureData", setTemperatureData);
    }, []);

    const getStats = (data, key) => {
        if (!data.length) return {};
        const values = data.map((item) => parseFloat(item[key])).filter((v) => !isNaN(v));
        const last = values[0];
        const timestamp = data[0]?.timestamp || "No time available";
        const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
        const max = Math.max(...values);
        const min = Math.min(...values);
        return { last, avg, max, min, timestamp };
    };

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
        sections.forEach((section) => {
            const { last, avg, max, min, timestamp } = section.stats;
            doc.setFontSize(14);
            doc.text(section.title, 20, y);
            doc.setFontSize(11);
            y += 8;
            doc.text(`Date: ${timestamp}`, 30, y);
            y += 6;
            doc.text(`Last: ${last}`, 30, y);
            y += 6;
            doc.text(`Avg: ${avg}`, 30, y);
            y += 6;
            doc.text(`Max: ${max}`, 30, y);
            y += 6;
            doc.text(`Min: ${min}`, 30, y);
            y += 12;
        });

        doc.save("sensor_report.pdf");
    };

    const checkWarnings = () => {
        const warnings = [];
        const doVal = parseFloat(doData[0]?.do_mg_L);
        const phVal = parseFloat(phData[0]?.ph);
        const tempVal = parseFloat(temperatureData[0]?.temperature);

        if (phVal > 9) warnings.push("⚠️ pH level is too high!");
        if (doVal < 2) warnings.push("⚠️ Oxygen level is too low!");
        if (tempVal > 40) warnings.push("⚠️ Temperature is at a critical level!");

        return warnings;
    };

    const renderSummary = ({ last, avg, max, min, timestamp }, unit) => (
        <div className="summary">
            <span>📍 Last: {last} {unit}</span>
            <span>📅 Date: {timestamp}</span>
            <span>📊 Avg: {avg} {unit}</span>
            <span>🔼 Max: {max} {unit}</span>
            <span>🔽 Min: {min} {unit}</span>
        </div>
    );

    const renderChart = (title, data, key, unit, color) => (
        <div className="card">
            <h2>{title}</h2>
            <button
                className="download-btn px-4 py-2 text-sm md:text-base"
                onClick={() => downloadCSV(data, `${key}_data.csv`, ["timestamp", key, "voltage"])}
            >
                📥 Download CSV
            </button>
            {renderSummary(getStats(data, key), unit)}
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.slice().reverse()}>
                    <CartesianGrid stroke="#ccc" />
                    <XAxis dataKey="timestamp" tick={{ fontSize: 10 }} />
                    <YAxis unit={unit} />
                    <Tooltip />
                    <Line type="monotone" dataKey={key} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );

    if (loading) {
        return (
            <div className={`loading-screen ${darkMode ? 'dark' : ''}`}>
                <div className="spinner" />
                <p>Loading data...</p>
            </div>
        );
    }

    return (
        <div className={`container ${darkMode ? 'dark' : ''}`}>
            <h1>💧 Raspberry Pi Sensor Panel</h1>
            <div className="flex gap-2 mb-4">
                <button className="back-btn" onClick={() => navigate("/")}>← Home</button>
                <button className="download-btn px-4 py-2 text-sm md:text-base" onClick={generatePDF}>📄 Generate PDF</button>
                <button
                    className="toggle-btn px-4 py-2 text-sm md:text-base"
                    onClick={() => setDarkMode(!darkMode)}
                >
                    {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
                </button>
            </div>

            <div className="warnings">
                {checkWarnings().map((warn, index) => (
                    <div key={index} className="warning-box">{warn}</div>
                ))}
            </div>

            {renderChart("Dissolved Oxygen (mg/L)", doData, "do_mg_L", "mg/L", "#0074D9")}
            {renderChart("pH Value", phData, "ph", "", "#FF4136")}
            {renderChart("Temperature (°C)", temperatureData, "temperature", "°C", "#2ECC40")}
        </div>
    );
}

export default Dashboard;
