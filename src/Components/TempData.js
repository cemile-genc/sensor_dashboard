import React, { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import database from "../firebase";

function PhData() {
    const [phValues, setPhValues] = useState([]);

    useEffect(() => {
        const phRef = ref(database, "temperatureData");
        onValue(phRef, (snapshot) => {
            const data = snapshot.val();
            const loaded = [];

            for (let id in data) {
                loaded.push({
                    id,
                    ph: data[id].ph,
                    voltage: data[id].voltage,
                    timestamp: data[id].timestamp
                });
            }

            setPhValues(loaded.reverse()); // en son veri yukarýda
        });
    }, []);

    return (
        <div>
            <h2>pH Data</h2>
            <ul>
                {phValues.map((item) => (
                    <li key={item.id}>
                        <strong>pH:</strong> {item.ph}, <strong>Voltaj:</strong> {item.voltage}, <strong>Zaman:</strong> {item.timestamp}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default PhData;
