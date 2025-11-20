import React from "react";
import DashboardCards from "./DashboardCards";
import { useNavigate } from "react-router-dom";
import "./AdminApp.css";


const Dashboard = () => {
    const navigate = useNavigate();


    return (
        <div className="dashboard-container">
            <h1 className="text-3xl font-bold text-center mt-8">Hoşgeldiniz Admin 👋</h1>
            <p className="text-center text-gray-600 mt-2">Sistem özetine aşağıdan ulaşabilirsiniz</p>


            <div className="flex justify-center mt-8">
                <DashboardCards />
            </div>


            <div className="flex justify-center mt-6">
                <button
                    onClick={() => navigate("/adminpanel")}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded shadow"
                >
                    Veri Paneline Git
                </button>
            </div>
        </div>
    );
};


export default Dashboard;