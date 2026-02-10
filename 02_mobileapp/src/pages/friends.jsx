// friends.jsx
import React, { useEffect, useMemo, useState } from 'react';
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
    deleteDoc,
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

const ONLINE_STALE_MS = 60 * 1000;

function toMillis(ts) {
    if (!ts) return null;
    if (typeof ts?.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return null;
}

function formatLastSeenLabel(lastSeenMs, nowMs) {
    if (!Number.isFinite(lastSeenMs)) return 'Zuletzt online: unbekannt';
    const diffMs = Math.max(0, nowMs - lastSeenMs);
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Zuletzt online: gerade eben';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Zuletzt online: vor ${diffMin} Min.`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Zuletzt online: vor ${diffHours} Std.`;
    const diffDays = Math.floor(diffHours / 24);
    return `Zuletzt online: vor ${diffDays} Tag${diffDays === 1 ? '' : 'en'}`;
}

// friendId deterministisch
function makeFriendId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

export default function FriendsPage({ f7router }) {
    const [user, setUser] = useState(null);
    const [nowTs, setNowTs] = useState(Date.now());

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
    const [friendsProfiles, setFriendsProfiles] = useState({}); // uid -> { username, avatarUrl, online, lastSeen }

    // Auth listener
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    useEffect(() => {
        const id = window.setInterval(() => setNowTs(Date.now()), 15000);
        return () => window.clearInterval(id);
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
                console.error('[suggestions] load error:', e);
            } finally {
                setLoadingSuggestions(false);
            }
        })();
    }, [myUid]);

    // -------------------------
    // Incoming / Outgoing Requests live
    // (pending-only + Error-Handler + Debug-Logs)
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        // Incoming: nur pending
        const qIn = query(
            collection(db, 'friendRequests'),
            where('toUid', '==', myUid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        // Outgoing: nur pending
        const qOut = query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', myUid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const unsubIn = onSnapshot(
            qIn,
            (snap) => {
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                console.log('[friendRequests] INCOMING rows:', rows);
                setIncoming(rows);
            },
            (err) => {
                console.error('[friendRequests] INCOMING listener error:', err);
            }
        );

        const unsubOut = onSnapshot(
            qOut,
            (snap) => {
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                console.log('[friendRequests] OUTGOING rows:', rows);
                setOutgoing(rows);
            },
            (err) => {
                console.error('[friendRequests] OUTGOING listener error:', err);
            }
        );

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

        const unsub = onSnapshot(
            qFriends,
            (snap) => {
                const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
                setFriendsDocs(rows);
            },
            (err) => {
                console.error('[friends] listener error:', err);
            }
        );

        return () => unsub();
    }, [myUid]);

    // -------------------------
    // Freunde-Profile live (inkl. Online/Offline)
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        const friendUids = [...new Set(
            friendsDocs
                .flatMap((f) => f.uids || [])
                .filter((uid) => uid && uid !== myUid)
        )];

        if (friendUids.length === 0) return;

        const unsubs = friendUids.map((uid) =>
            onSnapshot(
                doc(db, 'users', uid),
                (snap) => {
                    const data = snap.exists() ? snap.data() : {};
                    setFriendsProfiles((prev) => ({
                        ...prev,
                        [uid]: {
                            ...(prev[uid] || {}),
                            uid,
                            username: data.username || prev[uid]?.username || '',
                            usernameLower: data.usernameLower || prev[uid]?.usernameLower || '',
                            avatarUrl: data.avatarUrl || prev[uid]?.avatarUrl || '',
                            email: data.email || prev[uid]?.email || '',
                            online: !!data.online,
                            lastSeen: data.lastSeen || null,
                        },
                    }));
                },
                (err) => {
                    console.error('[friends profiles] listener error:', uid, err);
                }
            )
        );

        return () => {
            unsubs.forEach((u) => u());
        };
    }, [friendsDocs, myUid]);

    // -------------------------
    // Friend/Request profiles nachladen (für Anzeige)
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        const otherUids = new Set();
        friendsDocs.forEach((f) => {
            (f.uids || []).forEach((uid) => {
                if (uid && uid !== myUid) otherUids.add(uid);
            });
        });
        incoming.forEach((r) => {
            if (r.fromUid && r.fromUid !== myUid) otherUids.add(r.fromUid);
        });
        outgoing.forEach((r) => {
            if (r.toUid && r.toUid !== myUid) otherUids.add(r.toUid);
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
                            online: !!data.online,
                            lastSeen: data.lastSeen || null,
                        };
                    } else {
                        updates[uid] = { uid, username: '', avatarUrl: '', online: false, lastSeen: null };
                    }
                }
                setFriendsProfiles((p) => ({ ...p, ...updates }));
            } catch (e) {
                console.error('[profiles] load error:', e);
            }
        })();
        // absichtlich KEIN friendsProfiles im deps-array -> sonst loop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friendsDocs, incoming, outgoing, myUid]);

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
            console.error('[search] error:', e);
            f7.dialog.alert(e.message || String(e), 'Suche fehlgeschlagen');
        } finally {
            setSearching(false);
        }
    };

    // -------------------------
    // Request senden
    // Fix: createdAt/updatedAt sofort mit Client-Zeit setzen,
    // damit orderBy(createdAt) das Doc DIREKT im Snapshot sieht.
    // Zusätzlich Server-Timestamps in *Server Feldern* speichern.
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

            const now = new Date();

            const docRef = await addDoc(collection(db, 'friendRequests'), {
                fromUid: myUid,
                toUid,
                status: 'pending',

                // ✅ sofort vorhanden -> Snapshot-Query (orderBy createdAt) nimmt es direkt mit
                createdAt: now,
                updatedAt: now,

                // optional: echte Serverzeit zusätzlich (falls du später server-time brauchst)
                createdAtServer: serverTimestamp(),
                updatedAtServer: serverTimestamp(),
            });

            console.log('[sendRequest] created', { id: docRef.id, fromUid: myUid, toUid });
            f7.toast.create({ text: 'Anfrage gesendet ✅', closeTimeout: 1400 }).open();
        } catch (e) {
            console.error('[sendRequest] error:', e);
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
                updatedAt: new Date(),
                updatedAtServer: serverTimestamp(),
            });
            console.log('[acceptRequest] updated', { id: req.id, fromUid: req.fromUid, toUid: req.toUid });
            // incoming wird eh durch Snapshot aktualisiert – der Filter ist nur UX sofort
            setIncoming((prev) => prev.filter((r) => r.id !== req.id));

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
            console.error('[acceptRequest] error:', e);
            f7.dialog.alert(e.message || String(e), 'Annehmen fehlgeschlagen');
        }
    };

    const rejectRequest = async (req) => {
        try {
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'rejected',
                updatedAt: new Date(),
                updatedAtServer: serverTimestamp(),
            });
            console.log('[rejectRequest] updated', { id: req.id, fromUid: req.fromUid, toUid: req.toUid });
            setIncoming((prev) => prev.filter((r) => r.id !== req.id));
            f7.toast.create({ text: 'Anfrage abgelehnt', closeTimeout: 1200 }).open();
        } catch (e) {
            console.error('[rejectRequest] error:', e);
            f7.dialog.alert(e.message || String(e), 'Ablehnen fehlgeschlagen');
        }
    };

    const cancelRequest = async (req) => {
        try {
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'cancelled',
                updatedAt: new Date(),
                updatedAtServer: serverTimestamp(),
            });

            console.log('[cancelRequest] updated', { id: req.id, fromUid: req.fromUid, toUid: req.toUid });
            // outgoing ist pending-only im Snapshot -> nach cancel verschwindet es automatisch
            // der lokale Filter ist nur "sofortiges" UI:
            setOutgoing((prev) => prev.filter((r) => r.id !== req.id));

            f7.toast.create({ text: 'Anfrage storniert', closeTimeout: 1200 }).open();
        } catch (e) {
            console.error('[cancelRequest] error:', e);
            f7.dialog.alert(e.message || String(e), 'Stornieren fehlgeschlagen');
        }
    };

    const removeFriend = async (friendDoc) => {
        const confirmed = await new Promise((resolve) => {
            f7.dialog.confirm(
                'Möchtest du diesen Freund wirklich entfernen?',
                'Freund entfernen?',
                () => resolve(true),
                () => resolve(false)
            );
        });
        if (!confirmed) return;
        try {
            await deleteDoc(doc(db, 'friends', friendDoc.id));
            f7.toast.create({ text: 'Freund entfernt', closeTimeout: 1200 }).open();
        } catch (e) {
            console.error('[removeFriend] error:', e);
            f7.dialog.alert(e.message || String(e), 'Entfernen fehlgeschlagen');
        }
    };

    // Anzeigehelper: Username bevorzugt
    const labelForUid = (uid) => {
        const p = friendsProfiles[uid];
        if (p?.username) return p.username;
        return uid ? `${uid.slice(0, 6)}…` : '(unbekannt)';
    };

    const labelForUserRow = (row) => {
        if (row?.username) return row.username;
        return row?.uid ? `${row.uid.slice(0, 6)}…` : '(unbekannt)';
    };

    const getIncomingForUid = (uid) => incoming.find((r) => r.fromUid === uid);

    // outgoing ist pending-only, daher reicht toUid match
    const getOutgoingPendingForUid = (uid) => outgoing.find((r) => r.toUid === uid);

    const friendUidSet = useMemo(() => {
        const s = new Set();
        friendsDocs.forEach((f) => {
            (f.uids || []).forEach((uid) => {
                if (uid) s.add(uid);
            });
        });
        return s;
    }, [friendsDocs]);

    const filteredSuggestions = useMemo(
        () => suggestions.filter((u) => !friendUidSet.has(u.uid)),
        [suggestions, friendUidSet]
    );

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
                                        after={(() => {
                                            const isFriend = friendsDocs.some((f) => (f.uids || []).includes(u.uid));
                                            if (isFriend) return <span style={{ fontSize: 12, opacity: 0.7 }}>Freund</span>;

                                            const inc = getIncomingForUid(u.uid);
                                            if (inc) return <span style={{ fontSize: 12, opacity: 0.7 }}>Eingehend</span>;

                                            const out = getOutgoingPendingForUid(u.uid);
                                            if (out) {
                                                return (
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <span style={{ fontSize: 12, opacity: 0.7 }}>Angefragt</span>
                                                        <Button small outline onClick={() => cancelRequest(out)}>
                                                            Zurückziehen
                                                        </Button>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <Button small fill onClick={() => sendRequest(u.uid)}>
                                                    Anfrage
                                                </Button>
                                            );
                                        })()}
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
                        ) : filteredSuggestions.length === 0 ? (
                            <div style={{ opacity: 0.7 }}>Keine Vorschläge gefunden.</div>
                        ) : (
                            <List inset strong style={{ margin: 0 }}>
                                {filteredSuggestions.map((u) => (
                                    <ListItem
                                        key={u.uid}
                                        title={labelForUserRow(u)}
                                        subtitle={u.email || ''}
                                        after={(() => {
                                            const isFriend = friendsDocs.some((f) => (f.uids || []).includes(u.uid));
                                            if (isFriend) return <span style={{ fontSize: 12, opacity: 0.7 }}>Freund</span>;

                                            const inc = getIncomingForUid(u.uid);
                                            if (inc) return <span style={{ fontSize: 12, opacity: 0.7 }}>Eingehend</span>;

                                            const out = getOutgoingPendingForUid(u.uid);
                                            if (out) {
                                                return (
                                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                        <span style={{ fontSize: 12, opacity: 0.7 }}>Angefragt</span>
                                                        <Button small outline onClick={() => cancelRequest(out)}>
                                                            Zurückziehen
                                                        </Button>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <Button small outline onClick={() => sendRequest(u.uid)}>
                                                    Anfrage
                                                </Button>
                                            );
                                        })()}
                                    />
                                ))}
                            </List>
                        )}
                    </Block>

                    {/* Eingehend */}
                    <BlockTitle>{incoming.length === 0 ? 'Anfragen' : 'Anfragen (eingehend)'}</BlockTitle>
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

                    {/* Freunde */}
                    <BlockTitle>Meine Freunde</BlockTitle>
                    <Block strong inset>
                        {friendsDocs.length === 0 ? (
                            <div style={{ opacity: 0.7 }}>Du hast noch keine Freunde.</div>
                        ) : (
                            <List inset strong style={{ margin: 0 }}>
                                {friendsDocs.map((fr) => {
                                    const otherUid = (fr.uids || []).find((u) => u !== myUid) || '';
                                    const friendProfile = friendsProfiles[otherUid] || {};
                                    const lastSeenMs = toMillis(friendProfile.lastSeen);
                                    const isFresh = typeof lastSeenMs === 'number' && nowTs - lastSeenMs <= ONLINE_STALE_MS;
                                    const isOnline = !!friendProfile.online && isFresh;
                                    const lastSeenLabel = isOnline ? 'Zuletzt online: jetzt' : formatLastSeenLabel(lastSeenMs, nowTs);
                                    return (
                                        <ListItem
                                            key={fr.id}
                                            title={
                                                <div style={{ display: 'grid', gap: 2 }}>
                                                    <div>{labelForUid(otherUid)}</div>
                                                    <div style={{ fontSize: 12, opacity: 0.7 }}>
                                                        {lastSeenLabel}
                                                    </div>
                                                </div>
                                            }
                                            after={
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            fontSize: 12,
                                                            opacity: 0.8,
                                                        }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 8,
                                                                height: 8,
                                                                borderRadius: 999,
                                                                background: isOnline
                                                                    ? 'var(--f7-color-green)'
                                                                    : 'var(--f7-color-gray)',
                                                                display: 'inline-block',
                                                            }}
                                                        />
                                                        {isOnline ? 'Online' : 'Offline'}
                                                    </span>
                                                    <Button small outline onClick={() => removeFriend(fr)}>
                                                        Entfernen
                                                    </Button>
                                                </div>
                                            }
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
