import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Einmalige Firebase-Grundkonfiguration für Authentifizierung und Datenbankzugriff.
const firebaseConfig = {
    apiKey: "AIzaSyBb3XCI_TgErNIKbR_-C8RS73bJ-m_hdFk",
    authDomain: "mobileapp-02.firebaseapp.com",
    projectId: "mobileapp-02",
    storageBucket: "mobileapp-02.firebasestorage.app",
    messagingSenderId: "450954434564",
    appId: "1:450954434564:web:ef629e67bc0fc48b2bfd51"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
