import React from "react";

export default function Toolbar({
    chartType, setChartType,
    rangeH, setRangeH,
    extraRight
}) {
    return (
        <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label>
                Grafik:
                <select value={chartType} onChange={e => setChartType(e.target.value)} style={{ marginLeft: 6 }}>
                    <option value="line">Line</option>
                    <option value="bar">Bar</option>
                </select>
            </label>
            <label>
                Zaman:
                <select value={rangeH} onChange={e => setRangeH(Number(e.target.value))} style={{ marginLeft: 6 }}>
                    <option value={6}>Son 6s</option>
                    <option value={24}>Son 24s</option>
                    <option value={168}>Son 7g</option>
                </select>
            </label>
            <div style={{ marginLeft: "auto" }}>{extraRight}</div>
        </div>
    );
}
