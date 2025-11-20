import React from "react";
import "./DashboardCard.css";
import { FaFlask, FaWater, FaTemperatureHigh, FaMicrochip } from "react-icons/fa";

const DashboardCards = ({ phData, doData, tempData, sensorData }) => {
    const cards = [
        {
            title: "pH Verisi",
            count: phData.length,
            color: "blue",
            icon: <FaFlask size={28} />,
        },
        {
            title: "DO Verisi",
            count: doData.length,
            color: "green",
            icon: <FaWater size={28} />,
        },
        {
            title: "Sýcaklýk Verisi",
            count: tempData.length,
            color: "orange",
            icon: <FaTemperatureHigh size={28} />,
        },
        {
            title: "Sensör Verisi",
            count: sensorData.length,
            color: "purple",
            icon: <FaMicrochip size={28} />,
        },
    ];

    return (
        <div className="admindashboard-cards">
            {cards.map((card, index) => (
                <div key={index} className={`card ${card.color}`}>
                    <div className="icon">{card.icon}</div>
                    <h2>{card.count}</h2>
                    <p>{card.title}</p>
                </div>
            ))}
        </div>
    );
};

export default DashboardCards;
