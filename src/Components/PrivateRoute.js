// src/Components/PrivateRoute.js
import React from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ children }) => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";

    return isAdmin ? children : <Navigate to="/admin" replace />;
};

export default PrivateRoute;
