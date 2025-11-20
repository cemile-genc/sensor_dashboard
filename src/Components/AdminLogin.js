// AdminLogin.js
import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";

const AdminLogin = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            localStorage.setItem("isAdmin", "true");
            navigate("/admin-panel");
        } catch (error) {
            alert("Giriþ baþarýsýz: " + error.message);
        }
    };

    return (
        <div className="login-container">
            <h2>Admin Giriþ</h2>
            <form onSubmit={handleLogin}>
                <input type="email" placeholder="Email" value={email}
                    onChange={(e) => setEmail(e.target.value)} required />
                <input type="password" placeholder="Password" value={password}
                    onChange={(e) => setPassword(e.target.value)} required />
                <button type="submit">Giriþ Yap</button>
            </form>
        </div>
    );
};

export default AdminLogin;
