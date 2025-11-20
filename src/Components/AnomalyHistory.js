import React, { useEffect, useState } from "react";
import { ref, onValue, off } from "firebase/database";
import { db } from "../firebaseConfig";
import { fmt } from "../utils/time";

export default function AnomalyHistory({ onShowOnChart }) {
    const [rows, setRows] = useState([]);

    useEffect(() => {
        const r = ref(db, "/anomalies");
        const h = onValue(r, (snap) => {
            const v = snap.val() || {};
            const arr = Object.entries(v).map(([id, a]) => ({ id, ...a }));
            arr.sort((a, b) => (a.ts || 0) - (b.ts || 0));
            setRows(arr);
        });
        return () => off(r, "value", h);
    }, []);

    return (
        <div className="page">
            <h2>Anomali Geçmiþi</h2>
            <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                    <tr><th>Zaman</th><th>Etiket</th><th>Z</th><th>Deðer</th><th>Pencere</th><th>Not</th><th /></tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={r.id}>
                            <td>{fmt(r.ts)}</td>
                            <td>{r.tag}</td>
                            <td>{(r.z ?? 0).toFixed(2)}</td>
                            <td>{r.value}</td>
                            <td>{r.window}</td>
                            <td>{r.note}</td>
                            <td><button onClick={() => onShowOnChart?.(r)}>Grafikte Göster</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
