// src/Components/DataTablePanel.js
import React, { useEffect, useState } from "react";
import { getDatabase, ref, onValue } from "firebase/database";
import "./AdminPanel.css";

const DataTablePanel = () => {
    const [phData, setPhData] = useState([]);
    const [doData, setDoData] = useState([]);
    const [tempData, setTempData] = useState([]);

    useEffect(() => {
        const db = getDatabase();

        // pH verisi
        const phRef = ref(db, "phData");
        onValue(phRef, (snapshot) => {
            const data = snapshot.val();
            const formatted = data
                ? Object.entries(data).map(([key, value]) => ({
                    id: key,
                    timestamp: value.timestamp,
                    value: value.ph,
                    voltage: value.voltage,
                    label: "pH",
                }))
                : [];
            setPhData(formatted);
        });

        // DO verisi
        const doRef = ref(db, "doData");
        onValue(doRef, (snapshot) => {
            const data = snapshot.val();
            const formatted = data
                ? Object.entries(data).map(([key, value]) => ({
                    id: key,
                    timestamp: value.timestamp,
                    value: value.do_mg_L,
                    voltage: value.voltage,
                    label: "DO",
                }))
                : [];
            setDoData(formatted);
        });

        // Sýcaklýk verisi
        const tempRef = ref(db, "temperatureData");
        onValue(tempRef, (snapshot) => {
            const data = snapshot.val();
            const formatted = data
                ? Object.entries(data).map(([key, value]) => ({
                    id: key,
                    timestamp: value.timestamp,
                    value: value.temperature,
                    label: "Temperature",
                }))
                : [];
            setTempData(formatted);
        });
    }, []);

    const combinedData = [...phData, ...doData, ...tempData].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );

    return (
        <div className="admin-panel">
            <h2>Tüm Sensör Verileri</h2>
            <table>
                <thead>
                    <tr>
                        <th>Tür</th>
                        <th>Deðer</th>
                        <th>Voltaj</th>
                        <th>Zaman</th>
                    </tr>
                </thead>
                <tbody>
                    {combinedData.map((item) => (
                        <tr key={item.id}>
                            <td>{item.label}</td>
                            <td>{item.value}</td>
                            <td>{item.voltage !== undefined ? item.voltage : "-"}</td>
                            <td>{item.timestamp}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DataTablePanel;
