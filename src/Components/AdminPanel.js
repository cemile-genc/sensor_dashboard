// AdminPanel.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, auth } from "../firebaseConfig";
import { ref, onValue, remove } from "firebase/database";
import DataTable from "react-data-table-component";
import { CSVLink } from "react-csv";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Tabs, Tab, Box } from "@mui/material";
import "./AdminPanel.css";
import { signOut } from "firebase/auth";
import DashboardCards from "./DashboardCards";

const AdminPanel = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(0);
    const [search, setSearch] = useState("");

    const [phData, setPhData] = useState([]);
    const [doData, setDoData] = useState([]);
    const [tempData, setTempData] = useState([]);
    const [sensorData, setSensorData] = useState([]);

    useEffect(() => {
        const isAdmin = localStorage.getItem("isAdmin");
        if (isAdmin !== "true") navigate("/admin");
    }, [navigate]);

    useEffect(() => {
        const fetchData = (path, setter) => {
            const dataRef = ref(db, path);
            onValue(dataRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const parsed = Object.entries(data).map(([id, val]) => ({ id, ...val }));
                    setter(parsed);
                }
            });
        };

        fetchData("phData", setPhData);
        fetchData("doData", setDoData);
        fetchData("temperatureData", setTempData);
        fetchData("sensorData", setSensorData);
    }, []);

    const handleDelete = (path, id) => {
        if (!window.confirm("Bu veriyi silmek istediğinize emin misiniz?")) return;
        remove(ref(db, `${path}/${id}`))
            .then(() => alert("Veri başarıyla silindi."))
            .catch((err) => alert("Silme işlemi başarısız oldu."));
    };

    const filterData = (data) =>
        data.filter((row) =>
            Object.values(row).some((val) =>
                String(val).toLowerCase().includes(search.toLowerCase())
            )
        );

    const exportPDF = (data, columns, title, filename) => {
        const doc = new jsPDF();
        const tableRows = data.map((item) =>
            columns.filter((col) => col.selector).map((col) => item[col.selector.name || col.selector])
        );
        const tableHeaders = columns.filter((col) => col.selector).map((col) => col.name);
        doc.autoTable(tableHeaders, tableRows, { startY: 20 });
        doc.text(title, 14, 15);
        doc.save(filename);
    };

    const customStyles = {
        headCells: { style: { backgroundColor: "#1e40af", color: "#fff", fontWeight: "bold" } },
        rows: { style: { fontSize: "13px", "&:hover": { backgroundColor: "#eef2ff" } } },
    };

    const createColumns = (base, path) => [
        ...base,
        {
            name: "Sil",
            cell: (row) => <button onClick={() => handleDelete(path, row.id)} className="btn-red">Sil</button>,
            ignoreCSVExport: true,
        },
    ];

    const tabs = [
        {
            label: "pH Data",
            path: "phData",
            data: filterData(phData),
            columns: createColumns([
                { name: "ID", selector: (row) => row.id },
                { name: "pH", selector: (row) => row.ph },
                { name: "Voltage", selector: (row) => row.voltage },
                { name: "Timestamp", selector: (row) => row.timestamp },
            ], "phData"),
            csvFilename: "ph_data.csv",
            pdfTitle: "pH Data Report",
            pdfFilename: "ph_data.pdf",
        },
        {
            label: "DO Data",
            path: "doData",
            data: filterData(doData),
            columns: createColumns([
                { name: "ID", selector: (row) => row.id },
                { name: "DO (mg/L)", selector: (row) => row.do_mg_L },
                { name: "Voltage", selector: (row) => row.voltage },
                { name: "Timestamp", selector: (row) => row.timestamp },
            ], "doData"),
            csvFilename: "do_data.csv",
            pdfTitle: "DO Data Report",
            pdfFilename: "do_data.pdf",
        },
        {
            label: "Temperature Data",
            path: "temperatureData",
            data: filterData(tempData),
            columns: createColumns([
                { name: "ID", selector: (row) => row.id },
                { name: "Temperature", selector: (row) => row.temperature },
                { name: "Timestamp", selector: (row) => row.timestamp },
            ], "temperatureData"),
            csvFilename: "temperature_data.csv",
            pdfTitle: "Temperature Data Report",
            pdfFilename: "temperature_data.pdf",
        },
        {
            label: "Sensor Data",
            path: "sensorData",
            data: filterData(sensorData),
            columns: createColumns([
                { name: "ID", selector: (row) => row.id },
                { name: "Temperature", selector: (row) => row.temperature },
                { name: "Timestamp", selector: (row) => row.timestamp },
            ], "sensorData"),
            csvFilename: "sensor_data.csv",
            pdfTitle: "Sensor Data Report",
            pdfFilename: "sensor_data.pdf",
        },
    ];

    const currentTab = activeTab > 0 ? tabs[activeTab - 1] : null;

    const handleLogout = () => {
        signOut(auth).then(() => {
            localStorage.removeItem("isAdmin");
            navigate("/admin");
        });
    };

    return (
        <div className="admin-panel">
            <header className="admin-header">
                <h1 className="admin-title">👨‍💼 Admin Panel</h1>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </header>

            <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
                <Tabs value={activeTab} onChange={(e, newVal) => setActiveTab(newVal)} textColor="primary" indicatorColor="primary">
                    <Tab label="Genel Durum" />
                    {tabs.map((tab, i) => <Tab key={i} label={tab.label} />)}
                </Tabs>
            </Box>

            <main className="admin-content">
                {activeTab === 0 && (
                    <DashboardCards
                        phData={phData}
                        doData={doData}
                        tempData={tempData}
                        sensorData={sensorData}
                    />
                )}

                {activeTab > 0 && currentTab && (
                    <>
                        <div className="tools-bar">
                            <input
                                type="text"
                                placeholder="Veri ara..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="search-input"
                            />
                            <CSVLink data={currentTab.data} filename={currentTab.csvFilename} className="btn">CSV Aktar</CSVLink>
                            <button className="btn" onClick={() => exportPDF(currentTab.data, currentTab.columns, currentTab.pdfTitle, currentTab.pdfFilename)}>PDF Aktar</button>
                        </div>

                        <DataTable
                            columns={currentTab.columns}
                            data={currentTab.data}
                            pagination
                            customStyles={customStyles}
                            striped
                            highlightOnHover
                            dense
                        />
                    </>
                )}
            </main>
        </div>
    );
};

export default AdminPanel;

