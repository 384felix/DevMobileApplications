/*
 * Datei: friends.jsx
 * Inhalt: Diese Datei bildet den sozialen Bereich für Freundschaften ab.
 *         Hier finden sich Nutzersuche, Freundschaftsanfragen,
 *         bestehende Freundeslisten sowie zusätzliche Informationen
 *         wie Online-Status, Avatare und gespeicherte Standorte.
 */

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
const DEFAULT_AVATAR_ID = 'Avatar_01';

// Firestore-Zeitstempel und Date-Objekte werden für Vergleiche in Millisekunden umgewandelt.
function toMillis(ts) {
    if (!ts) return null;
    if (typeof ts?.toMillis === 'function') return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return null;
}

// Erzeugt lesbare Texte wie "gerade eben" oder "vor 5 Min." für den letzten Online-Zeitpunkt.
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

// Liefert die Bildadresse des gewählten Avatars oder einen Standard-Avatar.
function avatarUrlFromId(avatarId) {
    const safeId = avatarId || DEFAULT_AVATAR_ID;
    return `${import.meta.env.BASE_URL}Avatars/${safeId}.png`;
}

// Versucht aus dem gespeicherten Profil direkt ein lesbares Standortlabel zu bilden.
function locationLabelFromProfile(profile) {
    const loc = profile?.lastLocation || null;
    if (!loc) return 'Unbekannt';
    const city = (loc.city || loc.town || loc.village || '').trim();
    const country = (loc.country || '').trim();
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return 'Unbekannt';
}

// Prüft, ob überhaupt Koordinaten vorhanden sind, die noch in Stadt/Land übersetzt werden können.
function hasCoords(lastLocation) {
    const lat = lastLocation?.lat;
    const lng = lastLocation?.lng;
    return Number.isFinite(lat) && Number.isFinite(lng);
}

// Fallback-Geocoding für Fälle, in denen nur rohe Koordinaten gespeichert wurden.
async function reverseGeocodeCity(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
    )}&lon=${encodeURIComponent(lng)}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`reverse geocode failed (${res.status})`);
    const json = await res.json();
    const a = json?.address || {};
    const city = (a.city || a.town || a.village || a.municipality || a.county || '').trim();
    const country = (a.country || '').trim();
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return 'Unbekannt';
}

// Die Freundschafts-ID ist bewusst deterministisch, damit ein Freundespaar nur ein gemeinsames Dokument erhält.
function makeFriendId(uidA, uidB) {
    return [uidA, uidB].sort().join('_');
}

export default function FriendsPage({ f7router }) {
    const [user, setUser] = useState(null);
    const [nowTs, setNowTs] = useState(Date.now());

    // Suche nach anderen Nutzern über deren Username
    const [searchText, setSearchText] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // Vorschlagsliste auf Basis aktueller Nutzerkonten
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    // Eingehende und ausgehende Freundschaftsanfragen
    const [incoming, setIncoming] = useState([]);
    const [outgoing, setOutgoing] = useState([]);

    // Bestehende Freundschaften und dazu geladene Profildaten
    const [friendsDocs, setFriendsDocs] = useState([]);
    const [friendsProfiles, setFriendsProfiles] = useState({}); // uid -> { username, avatarId, online, lastSeen, lastLocation }
    const [resolvedLocationLabels, setResolvedLocationLabels] = useState({}); // uid -> "Stadt, Land"

    // Auth listener
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
        return () => unsub();
    }, []);

    useEffect(() => {
        const id = window.setInterval(() => setNowTs(Date.now()), 15000);
        return () => window.clearInterval(id);
    }, []);

    // Eigene Nutzer-ID als Kurzform, damit die folgenden Abfragen kompakter bleiben.
    const myUid = user?.uid || null;

    // -------------------------
    // Vorschläge: einige der zuletzt angelegten Nutzerkonten
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
                        avatarId: data.avatarId || DEFAULT_AVATAR_ID,
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
    // Offene eingehende und ausgehende Anfragen werden live aus Firestore geladen.
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        // Incoming: nur offene Anfragen, die an den aktuellen Nutzer gerichtet sind
        const qIn = query(
            collection(db, 'friendRequests'),
            where('toUid', '==', myUid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        // Outgoing: nur offene Anfragen, die vom aktuellen Nutzer verschickt wurden
        const qOut = query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', myUid),
            where('status', '==', 'pending'),
            orderBy('createdAt', 'desc')
        );

        const unsubIn = onSnapshot(
            qIn,
            (snap) => {
                setIncoming(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            },
            (err) => {
                console.error('[friendRequests] INCOMING listener error:', err);
            }
        );

        const unsubOut = onSnapshot(
            qOut,
            (snap) => {
                setOutgoing(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    // Eigentliche Freundschaften werden als eigene Dokumente live beobachtet
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
    // Freunde-Profile live, damit Online-Status und Standort aktuell bleiben
    // -------------------------
    useEffect(() => {
        if (!myUid) return;

        // Aus allen Freundschaftsdokumenten werden nur die jeweils anderen Nutzer-IDs extrahiert.
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
                            avatarId: data.avatarId || prev[uid]?.avatarId || DEFAULT_AVATAR_ID,
                            email: data.email || prev[uid]?.email || '',
                            online: !!data.online,
                            lastSeen: data.lastSeen || null,
                            lastLocation: data.lastLocation || prev[uid]?.lastLocation || null,
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
    // Zusätzliche Profile nachladen, damit Anfragen und Freundeslisten sprechende Namen anzeigen
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

        // Bereits bekannte Profile werden übersprungen, nur fehlende werden nachgeladen.
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
                            avatarId: data.avatarId || DEFAULT_AVATAR_ID,
                            email: data.email || '',
                            online: !!data.online,
                            lastSeen: data.lastSeen || null,
                            lastLocation: data.lastLocation || null,
                        };
                    } else {
                        updates[uid] = {
                            uid,
                            username: '',
                            avatarId: DEFAULT_AVATAR_ID,
                            online: false,
                            lastSeen: null,
                            lastLocation: null,
                        };
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
    // Falls nur Koordinaten vorhanden sind, wird clientseitig ein lesbares Standortlabel ermittelt
    // -------------------------
    useEffect(() => {
        const candidates = Object.entries(friendsProfiles)
            .filter(([uid, p]) => {
                if (resolvedLocationLabels[uid]) return false;
                const label = locationLabelFromProfile(p);
                return label === 'Unbekannt' && hasCoords(p?.lastLocation);
            })
            .map(([uid, p]) => ({ uid, loc: p.lastLocation }));

        if (candidates.length === 0) return;

        let cancelled = false;
        (async () => {
            const updates = {};
            await Promise.all(
                candidates.map(async ({ uid, loc }) => {
                    try {
                        const label = await reverseGeocodeCity(loc.lat, loc.lng);
                        updates[uid] = label || 'Unbekannt';
                    } catch (e) {
                        console.error('[friends] reverse geocode failed', uid, e);
                        updates[uid] = 'Unbekannt';
                    }
                })
            );
            if (!cancelled && Object.keys(updates).length > 0) {
                setResolvedLocationLabels((prev) => ({ ...prev, ...updates }));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [friendsProfiles, resolvedLocationLabels]);

    // -------------------------
    // Die Suche erfolgt bewusst exakt über usernameLower
    // -------------------------
    const handleSearch = async () => {
        if (!myUid) {
            f7.dialog.alert('Bitte zuerst einloggen.');
            return;
        }

        // Leere Suche soll keinen unnötigen Datenbankzugriff auslösen.
        const qText = searchText.trim();
        if (!qText) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const key = qText.toLowerCase();

            // Gesucht wird exakt über usernameLower, damit das Verhalten eindeutig bleibt.
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
                        avatarId: data.avatarId || DEFAULT_AVATAR_ID,
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
    // Neue Freundschaftsanfrage an einen anderen Nutzer senden
    // -------------------------
    const sendRequest = async (toUid) => {
        if (!myUid) return;

        if (toUid === myUid) {
            f7.dialog.alert('Du kannst dir selbst keine Anfrage senden 🙂');
            return;
        }

        try {
            // Vor dem Schreiben wird geprüft, ob bereits eine offene Anfrage an denselben Nutzer existiert.
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

            await addDoc(collection(db, 'friendRequests'), {
                fromUid: myUid,
                toUid,
                status: 'pending',

                // Sofort vorhanden, damit die Anfrage direkt in geordneten Snapshots sichtbar ist
                createdAt: now,
                updatedAt: now,

                // Zusätzliche Serverzeit für spätere Auswertungen
                createdAtServer: serverTimestamp(),
                updatedAtServer: serverTimestamp(),
            });

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
            // Zuerst wird die Anfrage selbst auf "accepted" gesetzt.
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'accepted',
                updatedAt: new Date(),
                updatedAtServer: serverTimestamp(),
            });
            // incoming wird eh durch Snapshot aktualisiert – der Filter ist nur UX sofort
            setIncoming((prev) => prev.filter((r) => r.id !== req.id));

            // Danach wird das eigentliche Freundschaftsdokument erzeugt oder ergänzt.
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
            // Ablehnen bedeutet: Anfrage bleibt dokumentiert, zählt aber nicht mehr als offen.
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'rejected',
                updatedAt: new Date(),
                updatedAtServer: serverTimestamp(),
            });
            setIncoming((prev) => prev.filter((r) => r.id !== req.id));
            f7.toast.create({ text: 'Anfrage abgelehnt', closeTimeout: 1200 }).open();
        } catch (e) {
            console.error('[rejectRequest] error:', e);
            f7.dialog.alert(e.message || String(e), 'Ablehnen fehlgeschlagen');
        }
    };

    const cancelRequest = async (req) => {
        try {
            // Stornieren betrifft nur selbst verschickte, noch offene Anfragen.
            await updateDoc(doc(db, 'friendRequests', req.id), {
                status: 'cancelled',
                updatedAt: new Date(),
                updatedAtServer: serverTimestamp(),
            });

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
        // Vor dem Entfernen wird bewusst eine Rückfrage angezeigt.
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

    // Anzeigehelfer: im UI wird nach Möglichkeit immer der Username statt der UID gezeigt.
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

    // Outgoing enthält nur offene Anfragen, daher reicht die Ziel-ID für die Zuordnung.
    const getOutgoingPendingForUid = (uid) => outgoing.find((r) => r.toUid === uid);

    // Diese Menge erleichtert spätere Prüfungen, ob ein Nutzer bereits in der Freundesliste ist.
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
                    {/* Suchbereich für das direkte Finden anderer Nutzer über ihren Username */}
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

                    {/* Vorschläge zeigen einige aktuelle Nutzer, die noch nicht in der Freundesliste sind */}
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

                    {/* Eingehende Anfragen können hier direkt angenommen oder abgelehnt werden */}
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

                    {/* Die Freundesliste bündelt Profilbild, Online-Status, Standort und Entfernen-Aktion */}
                    <BlockTitle>Meine Freunde</BlockTitle>
                    <Block strong inset>
                        {friendsDocs.length === 0 ? (
                            <div className="empty-state-card">
                                <div className="empty-state-title">Du hast noch keine Freunde</div>
                                <div className="empty-state-text">Nutze die Suche oben, um direkt jemanden hinzuzufügen.</div>
                                <Button
                                    small
                                    fill
                                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                >
                                    Freunde suchen
                                </Button>
                            </div>
                        ) : (
                            <List inset strong style={{ margin: 0 }}>
                                {friendsDocs.map((fr) => {
                                    const otherUid = (fr.uids || []).find((u) => u !== myUid) || '';
                                    const friendProfile = friendsProfiles[otherUid] || {};
                                    const lastSeenMs = toMillis(friendProfile.lastSeen);
                                    const isFresh = typeof lastSeenMs === 'number' && nowTs - lastSeenMs <= ONLINE_STALE_MS;
                                    const isOnline = !!friendProfile.online && isFresh;
                                    const lastSeenLabel = isOnline ? 'Zuletzt online: jetzt' : formatLastSeenLabel(lastSeenMs, nowTs);
                                    const lastSeenText = lastSeenLabel.replace(/^Zuletzt online:\s*/i, '');
                                    const rawLocationLabel = locationLabelFromProfile(friendProfile);
                                    const locationLabel = resolvedLocationLabels[otherUid] || rawLocationLabel;
                                    const locationLoading =
                                        rawLocationLabel === 'Unbekannt'
                                        && hasCoords(friendProfile?.lastLocation)
                                        && !resolvedLocationLabels[otherUid];
                                    const avatarSrc = avatarUrlFromId(friendProfile.avatarId);
                                    return (
                                        <ListItem
                                            key={fr.id}
                                            title={
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <img
                                                        src={avatarSrc}
                                                        alt="Avatar"
                                                        style={{ width: 34, height: 34, borderRadius: 999, objectFit: 'cover' }}
                                                    />
                                                    <div style={{ display: 'grid', gap: 2 }}>
                                                        <div>{labelForUid(otherUid)}</div>
                                                        <div className="last-seen-label" style={{ fontSize: 12, opacity: 0.7 }}>
                                                            <span className="last-seen-prefix-full">Zuletzt online: </span>
                                                            <span className="last-seen-prefix-short">Zul. onl. </span>
                                                            <span>{lastSeenText}</span>
                                                        </div>
                                                        <div style={{ fontSize: 12, opacity: 0.72 }}>
                                                            {locationLoading
                                                                ? 'Standort: wird ermittelt…'
                                                                : locationLabel !== 'Unbekannt'
                                                                    ? locationLabel
                                                                    : 'Standort: Unbekannt'}
                                                        </div>
                                                    </div>
                                                </div>
                                            }
                                            after={
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                    <span
                                                        className="friend-status-indicator"
                                                        style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            fontSize: 12,
                                                            opacity: 0.8,
                                                        }}
                                                    >
                                                        <span
                                                            className="friend-status-dot"
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
                                                        <span className="friend-status-text">{isOnline ? 'Online' : 'Offline'}</span>
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
