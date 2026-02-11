import React, { useEffect, useState } from 'react';
import { Link } from 'framework7-react';
import { auth } from '../js/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Network } from '@capacitor/network';

export default function ProfileButton() {
    const [user, setUser] = useState(null);
    const [online, setOnline] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    useEffect(() => {
        let listener;

        const initNetwork = async () => {
            try {
                const status = await Network.getStatus();
                setOnline(status.connected);

                listener = await Network.addListener('networkStatusChange', (s) => {
                    setOnline(s.connected);
                });
            } catch (e) {
                const update = () => setOnline(navigator.onLine);
                update();
                window.addEventListener('online', update);
                window.addEventListener('offline', update);

                return () => {
                    window.removeEventListener('online', update);
                    window.removeEventListener('offline', update);
                };
            }
        };

        const cleanupFallback = initNetwork();

        return () => {
            if (listener) listener.remove();
            if (typeof cleanupFallback === 'function') cleanupFallback();
        };
    }, []);

    return (
        <Link href="/profile/" className="profile-btn" aria-label="Profil">
            <i className="f7-icons profile-btn__icon">person</i>
            {user && <span className={`profile-btn__dot ${online ? 'online' : 'offline'}`} />}
        </Link>
    );
}
