import React, { useEffect, useState } from 'react';
import { Link } from 'framework7-react';
import { auth } from '../js/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function ProfileButton() {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    return (
        <Link href="/profile/" className="profile-btn" aria-label="Profil">
            <i className="f7-icons profile-btn__icon">person_crop_circle</i>
            {user && <span className="profile-btn__dot" />}
        </Link>
    );
}
