import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth"; // 🔸 Bunu ekledik

const firebaseConfig = {
	apiKey: "AIzaSyCELa6_5_-UQcnpcD5C4p2rRosDlqIehNY",
	authDomain: "tempdeneme2.firebaseapp.com",
	databaseURL: "https://tempdeneme2-default-rtdb.firebaseio.com",
	projectId: "tempdeneme2",
	storageBucket: "tempdeneme2.firebasestorage.app",
	messagingSenderId: "998386567055",
	appId: "1:998386567055:web:f87c9a81be255b6dd46dfa",
	measurementId: "G-L66T6LXF6J"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
export const auth = getAuth(app); // 🔸 Bunu ekledik

export { db };
