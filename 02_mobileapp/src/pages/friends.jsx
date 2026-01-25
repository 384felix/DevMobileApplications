import React, { useEffect, useState } from 'react';
import {
    Page,
    Navbar,
    Block,
    BlockTitle,
    List,
    ListItem,
    ListInput,
    Button,
    f7,
    NavRight,
} from 'framework7-react';

import ProfileButton from '../components/ProfileButton.jsx';

import { auth, db } from '../js/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from 'firebase/firestore';

// friendId deterministisch
function makeFriendId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

export default function FriendsPage({ f7router }) {
    const [user, setUser] = useState(null);

    // Suche
    const [searchText, setSearchText] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // Vorschläge
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Requests
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);

    // Friends
    const [friendsDocs, setFriendsDocs] = useState([]);
    const [friendsProfiles, setFriendsProfiles] = useState({}); // uid -> { username, avatarUrl }

    // Auth listener
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    const myUid = user?.uid || null;

    // -------------------------
    // Vorschläge: neueste users
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        (async () => {
            setLoadingSuggestions(true);
            try {
                const qSug = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(10));
                const snap = await getDocs(qSug);

                const rows = [];
                snap.forEach((d) => {
                    if (d.id === myUid) return;
                    const data = d.data();
                    rows.push({
                        uid: d.id,
                        username: data.username || '',
                        usernameLower: data.usernameLower || '',
                        email: data.email || '',
                        avatarUrl: data.avatarUrl || '',
                    });
                });

                setSuggestions(rows);
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingSuggestions(false);
            }
        })();
    }, [myUid]);

    // -------------------------
    // Incoming / Outgoing Requests live
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        const qIn = query(
            collection(db, 'friendRequests'),
            where('toUid', '==', myUid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const qOut = query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', myUid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const unsubIn = onSnapshot(qIn, (snap) => {
            const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setIncoming(rows);
        });

        const unsubOut = onSnapshot(qOut, (snap) => {
            const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setOutgoing(rows);
        });

        return () => {
            unsubIn();
            unsubOut();
        };
    }, [myUid]);

    // -------------------------
    // Friends live
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        const qFriends = query(
            collection(db, 'friends'),
            where('uids', 'array-contains', myUid),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(qFriends, (snap) => {
            const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            setFriendsDocs(rows);
        });

        return () => unsub();
    }, [myUid]);

    // -------------------------
    // Friend profiles nachladen (für Anzeige)
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        const otherUids = new Set();
        friendsDocs.forEach((f) => {
            (f.uids || []).forEach((uid) => {
                if (uid && uid !== myUid) otherUids.add(uid);
            });
        });

        const missing = [...otherUids].filter((uid) => !friendsProfiles[uid]);
        if (missing.length === 0) return;

        (async () => {
            try {
                const updates = {};
                for (const uid of missing) {
                    const snap = await getDoc(doc(db, 'users', uid));
                    if (snap.exists()) {
                        const data = snap.data();
                        updates[uid] = {
                            uid,
                            username: data.username || '',
                            usernameLower: data.usernameLower || '',
                            avatarUrl: data.avatarUrl || '',
                            email: data.email || '',
                        };
                    } else {
                        updates[uid] = { uid, username: '', avatarUrl: '' };
                    }
                }
                setFriendsProfiles((p) => ({ ...p, ...updates }));
            } catch (e) {
                console.error(e);
            }
        })();
        // absichtlich KEIN friendsProfiles im deps-array -> sonst loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friendsDocs, myUid]);

    // -------------------------
    // Suche: nur usernameLower (exakt)
    // -------------------------
    const handleSearch = async () => {
        if (!myUid) {
            f7.dialog.alert('Bitte zuerst einloggen.');
            return;
        }

        const qText = searchText.trim();
        if (!qText) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const key = qText.toLowerCase();

            const q1 = query(collection(db, 'users'), where('usernameLower', '==', key), limit(10));
            const snap = await getDocs(q1);

            const rows = [];
            snap.forEach((d) => {
                if (d.id === myUid) return;
                const data = d.data();
                rows.push({
                    uid: d.id,
                    username: data.username || '',
                    usernameLower: data.usernameLower || '',
                    email: data.email || '',
                    avatarUrl: data.avatarUrl || '',
                });
            });

            setSearchResults(rows);

            if (rows.length === 0) {
                f7.toast.create({ text: 'Kein User gefunden', closeTimeout: 1200 }).open();
            }
        } catch (e) {
            console.error(e);
            f7.dialog.alert(e.message || String(e), 'Suche fehlgeschlagen');
        } finally {
            setSearching(false);
        }
    };

    // -------------------------
    // Request senden
    // -------------------------
    const sendRequest = async (toUid) => {
        if (!myUid) return;

        if (toUid === myUid) {
            f7.dialog.alert('Du kannst dir selbst keine Anfrage senden 🙂');
            return;
        }

        try {
            // Duplikatcheck (pending)
            const qDup = query(
                collection(db, 'friendRequests'),
                where('fromUid', '==', myUid),
                where('toUid', '==', toUid),
                where('status', '==', 'pending'),
                limit(1)
            );
            const dupSnap = await getDocs(qDup);
            if (!dupSnap.empty) {
                f7.toast.create({ text: 'Anfrage läuft bereits…', closeTimeout: 1200 }).open();
                return;
            }

            await addDoc(collection(db, 'friendRequests'), {
                fromUid: myUid,
                toUid,
                status: 'pending',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });

            f7.toast.create({ text: 'Anfrage gesendet ✅', closeTimeout: 1400 }).open();
        } catch (e) {
            console.error(e);
            f7.dialog.alert(e.message || String(e), 'Anfrage fehlgeschlagen');
        }
    };

    // -------------------------
    // Request annehmen/ablehnen/stornieren
    // -------------------------
    const acceptRequest = async (req) => {
        if (!myUid) return;

        try {
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'accepted',
                updatedAt: serverTimestamp(),
            });

            // friend doc deterministisch: friends/{friendId}
            const friendId = makeFriendId(req.fromUid, req.toUid);
            await setDoc(
                doc(db, 'friends', friendId),
                {
                    uids: [req.fromUid, req.toUid],
                    friendId,
                    createdAt: serverTimestamp(),
                },
                { merge: true }
            );

            f7.toast.create({ text: 'Freund hinzugefügt ✅', closeTimeout: 1400 }).open();
        } catch (e) {
            console.error(e);
            f7.dialog.alert(e.message || String(e), 'Annehmen fehlgeschlagen');
        }
    };

    const rejectRequest = async (req) => {
        try {
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'rejected',
                updatedAt: serverTimestamp(),
            });
            f7.toast.create({ text: 'Anfrage abgelehnt', closeTimeout: 1200 }).open();
        } catch (e) {
            console.error(e);
            f7.dialog.alert(e.message || String(e), 'Ablehnen fehlgeschlagen');
        }
    };

    const cancelRequest = async (req) => {
        try {
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'cancelled',
                updatedAt: serverTimestamp(),
            });
            f7.toast.create({ text: 'Anfrage storniert', closeTimeout: 1200 }).open();
        } catch (e) {
            console.error(e);
            f7.dialog.alert(e.message || String(e), 'Stornieren fehlgeschlagen');
        }
    };

    // Anzeigehelper: Username bevorzugt
    const labelForUid = (uid) => {
        const p = friendsProfiles[uid];
        if (p?.username) return `@${p.username}`;
        return uid ? `${uid.slice(0, 6)}…` : '(unbekannt)';
    };

    const labelForUserRow = (row) => {
        if (row?.username) return `@${row.username}`;
        return row?.uid ? `${row.uid.slice(0, 6)}…` : '(unbekannt)';
    };

    return (
        <Page name="friends">
            <Navbar title="Freunde">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>

            {!user ? (
                <Block strong inset>
                    Bitte zuerst einloggen, um Freunde hinzuzufügen.
                    <div style={{ marginTop: 10 }}>
                        <Button fill onClick={() => f7router.navigate('/profile/')}>Zum Profil / Login</Button>
                    </div>
                </Block>
            ) : (
                <>
                    {/* Suche */}
                    <BlockTitle>Freunde suchen</BlockTitle>
                    <Block strong inset>
                        <List strong inset dividersIos style={{ margin: 0 }}>
                            <ListInput
                                label="Username"
                                type="text"
                                placeholder="z.B. flizzmaster"
                                value={searchText}
                                onInput={(e) => setSearchText(e.target.value)}
                                clearButton
                            />
                        </List>

                        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            <Button fill onClick={handleSearch} disabled={searching}>
                                {searching ? 'Suche…' : 'Suchen'}
                            </Button>
                            <Button outline onClick={() => { setSearchText(''); setSearchResults([]); }}>
                                Leeren
                            </Button>
                        </div>

                        {searchResults.length > 0 && (
                            <List inset strong style={{ marginTop: 12 }}>
                                {searchResults.map((u) => (
                                    <ListItem
                                        key={u.uid}
                                        title={labelForUserRow(u)}
                                        subtitle={u.email || ''}
                                        after={
                                            <Button small fill onClick={() => sendRequest(u.uid)}>
                                                Anfrage
                                            </Button>
                                        }
                                    />
                                ))}
                            </List>
                        )}
                    </Block>

                    {/* Vorschläge */}
                    <BlockTitle>Vorschläge</BlockTitle>
                    <Block strong inset>
                        {loadingSuggestions ? (
                            <div>lade…</div>
                        ) : suggestions.length === 0 ? (
                            <div style={{ opacity: 0.7 }}>Keine Vorschläge gefunden.</div>
                        ) : (
                            <List inset strong style={{ margin: 0 }}>
                                {suggestions.map((u) => (
                                    <ListItem
                                        key={u.uid}
                                        title={labelForUserRow(u)}
                                        subtitle={u.email || ''}
                                        after={
                                            <Button small outline onClick={() => sendRequest(u.uid)}>
                                                Anfrage
                                            </Button>
                                        }
                                    />
                                ))}
                            </List>
                        )}
                    </Block>

                    {/* Eingehend */}
                    <BlockTitle>Anfragen (eingehend)</BlockTitle>
                    <Block strong inset>
                        {incoming.length === 0 ? (
                            <div style={{ opacity: 0.7 }}>Keine neuen Anfragen.</div>
                        ) : (
                            <List inset strong style={{ margin: 0 }}>
                                {incoming.map((req) => (
                                    <ListItem
                                        key={req.id}
                                        title={labelForUid(req.fromUid)}
                                        subtitle="möchte dich hinzufügen"
                                        after={
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <Button small fill onClick={() => acceptRequest(req)}>Annehmen</Button>
                                                <Button small outline onClick={() => rejectRequest(req)}>Ablehnen</Button>
                                            </div>
                                        }
                                    />
                                ))}
                            </List>
                        )}
                    </Block>

                    {/* Ausgehend */}
                    <BlockTitle>Anfragen (ausgehend)</BlockTitle>
                    <Block strong inset>
                        {outgoing.length === 0 ? (
                            <div style={{ opacity: 0.7 }}>Keine offenen Anfragen.</div>
                        ) : (
                            <List inset strong style={{ margin: 0 }}>
                                {outgoing.map((req) => (
                                    <ListItem
                                        key={req.id}
                                        title={labelForUid(req.toUid)}
                                        subtitle="wartet auf Antwort"
                                        after={
                                            <Button small outline onClick={() => cancelRequest(req)}>
                                                Stornieren
                                            </Button>
                                        }
                                    />
                                ))}
                            </List>
                        )}
                    </Block>

                    {/* Freunde */}
                    <BlockTitle>Meine Freunde</BlockTitle>
                    <Block strong inset>
                        {friendsDocs.length === 0 ? (
                            <div style={{ opacity: 0.7 }}>Du hast noch keine Freunde.</div>
                        ) : (
                            <List inset strong style={{ margin: 0 }}>
                                {friendsDocs.map((fr) => {
                                    const otherUid = (fr.uids || []).find((u) => u !== myUid) || '';
                                    return (
                                        <ListItem
                                            key={fr.id}
                                            title={labelForUid(otherUid)}
                                            subtitle="Freund"
                                        />
                                    );
                                })}
                            </List>
                        )}
                    </Block>
                </>
            )}
        </Page>
    );
}
