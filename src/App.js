import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";
import UserDashboard from "./UserDashboard";
import AdminLogin from "./Components/AdminLogin";
import AdminPanel from "./Components/AdminPanel";
import PrivateRoute from "./Components/PrivateRoute";
import AdminDashboard from "./Components/AdminDashboard";
import AIAnalysis from "./AIAnalysis";
import TankLevel from "./TankLevel"; 
import SensorHistory from "./SensorHistory";
import SystemInfo from "./SystemInfo";
import WaterQualityDashboard from "./Components/WaterQualityDashboard";
import EnergyDashboard from "./Components/EnergyDashboard";
import AnomalyHistory from "./Components/AnomalyHistory";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Home />} />

              
                <Route path="/userdashboard" element={<UserDashboard />} />  
                <Route path="/admin" element={<AdminLogin />} />
                <Route path="/admindashboard" element={<AdminDashboard />} /> 
                <Route path="/ai-analysis" element={<AIAnalysis />} />     
                <Route path="/tank" element={<TankLevel />} />
                <Route path="/veriler" element={<SensorHistory />} />
                <Route path="/info" element={<SystemInfo />} />
                <Route path="/quality" element={<WaterQualityDashboard />} />
                <Route path="/energy" element={<EnergyDashboard />} />
                <Route path="/anomalies" element={<AnomalyHistory />} />
                {/*<Route path="/calibration" element={<Calibration />} /> */}

                {/* Admin Panel sadece giriş yapmış kullanıcıya açık */}  

                <Route
                    path="/admin-panel"
                    element={
                        <PrivateRoute>
                            <AdminPanel />
                        </PrivateRoute>
                    }
                />
            </Routes>
        </Router>
    );
}

export default App;
