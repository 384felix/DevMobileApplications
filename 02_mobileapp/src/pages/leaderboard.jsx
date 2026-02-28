import React, { useEffect, useMemo, useState } from 'react';
import { Page, Navbar, Block, NavRight, List, ListItem, Button, f7 } from 'framework7-react';
import ProfileButton from '../components/ProfileButton.jsx';
import { collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../js/firebase';

export default function LeaderboardPage() {
    const [events, setEvents] = useState([]);
    const [uid, setUid] = useState('');
    const [friendUids, setFriendUids] = useState([]);
    const [viewMode, setViewMode] = useState('ranking'); // ranking | feed
    const [scopeFilter, setScopeFilter] = useState('all'); // all | friends
    const [timeFilter, setTimeFilter] = useState('all'); // all | today
    const [difficultyFilter, setDifficultyFilter] = useState('all'); // all | easy | medium | hard
    const [reactionsByEvent, setReactionsByEvent] = useState({});
    const [reactionBusyByEvent, setReactionBusyByEvent] = useState({});

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => setUid(u?.uid || ''));
        return () => unsub();
    }, []);

    useEffect(() => {
        const q = query(collection(db, 'sudokuEvents'), orderBy('createdAt', 'desc'), limit(200));
        const unsub = onSnapshot(q, (snap) => {
            setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadFriends = async () => {
            if (!uid) {
                setFriendUids([]);
                return;
            }
            try {
                const q = query(collection(db, 'friends'), where('uids', 'array-contains', uid));
                const snap = await getDocs(q);
                if (cancelled) return;
                const others = new Set();
                snap.forEach((d) => {
                    const uids = Array.isArray(d.data()?.uids) ? d.data().uids : [];
                    uids.forEach((id) => {
                        if (id && id !== uid) others.add(id);
                    });
                });
                setFriendUids(Array.from(others));
            } catch (e) {
                console.error('[leaderboard] load friends failed', e);
                if (!cancelled) setFriendUids([]);
            }
        };

        loadFriends();
        return () => {
            cancelled = true;
        };
    }, [uid]);

    const filteredEvents = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const friendSet = new Set(friendUids);

        return events.filter((e) => {
            const diff = String(e.difficulty || '');
            const ts = e.createdAt?.toDate ? e.createdAt.toDate() : null;

            if (difficultyFilter !== 'all' && diff !== difficultyFilter) return false;
            if (timeFilter === 'today' && (!ts || ts < startOfToday)) return false;
            if (scopeFilter === 'friends' && !friendSet.has(e.uid)) return false;
            return true;
        });
    }, [events, friendUids, scopeFilter, timeFilter, difficultyFilter]);

    const rankingRows = useMemo(() => {
        const pointsByDifficulty = {
            easy: 10,
            medium: 25,
            hard: 50,
        };
        const map = new Map();

        filteredEvents.forEach((e) => {
            const eventUid = e.uid || '';
            if (!eventUid) return;
            const diff = String(e.difficulty || '');
            const points = pointsByDifficulty[diff] || 10;
            const ts = e.createdAt?.toDate ? e.createdAt.toDate() : null;
            const row = map.get(eventUid) || {
                uid: eventUid,
                username: e.username || 'Unbekannt',
                points: 0,
                solvedCount: 0,
                lastAtMs: 0,
            };
            row.points += points;
            row.solvedCount += 1;
            if (e.username) row.username = e.username;
            if (ts && ts.getTime() > row.lastAtMs) row.lastAtMs = ts.getTime();
            map.set(eventUid, row);
        });

        return Array.from(map.values())
            .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                if (b.solvedCount !== a.solvedCount) return b.solvedCount - a.solvedCount;
                return b.lastAtMs - a.lastAtMs;
            })
            .map((row, index) => ({ ...row, rank: index + 1 }));
    }, [filteredEvents]);

    useEffect(() => {
        let cancelled = false;

        const loadReactions = async () => {
            if (viewMode !== 'feed') return;
            const eventIds = filteredEvents.map((e) => e.id).filter(Boolean);
            if (!eventIds.length) {
                setReactionsByEvent({});
                return;
            }
            const chunks = [];
            for (let i = 0; i < eventIds.length; i += 30) {
                chunks.push(eventIds.slice(i, i + 30));
            }
            const nextMap = {};
            try {
                for (const ids of chunks) {
                    const q = query(collection(db, 'sudokuEventReactions'), where('eventId', 'in', ids));
                    const snap = await getDocs(q);
                    snap.forEach((d) => {
                        const data = d.data() || {};
                        const eventId = data.eventId;
                        if (!eventId) return;
                        if (!nextMap[eventId]) nextMap[eventId] = { count: 0, reactedByMe: false };
                        nextMap[eventId].count += 1;
                        if (uid && data.uid === uid) nextMap[eventId].reactedByMe = true;
                    });
                }
                if (!cancelled) setReactionsByEvent(nextMap);
            } catch (e) {
                console.error('[leaderboard] load reactions failed', e);
                if (!cancelled) setReactionsByEvent({});
            }
        };

        loadReactions();
        return () => {
            cancelled = true;
        };
    }, [viewMode, filteredEvents, uid]);

    const toggleClapReaction = async (eventId) => {
        if (!eventId) return;
        if (!uid) {
            f7.dialog.alert('Bitte einloggen, um zu reagieren.');
            return;
        }
        const reactionDocId = `${eventId}_${uid}`;
        const reactionRef = doc(db, 'sudokuEventReactions', reactionDocId);
        const current = reactionsByEvent[eventId] || { count: 0, reactedByMe: false };
        const willReact = !current.reactedByMe;

        setReactionBusyByEvent((prev) => ({ ...prev, [eventId]: true }));
        setReactionsByEvent((prev) => {
            const old = prev[eventId] || { count: 0, reactedByMe: false };
            const nextCount = willReact ? old.count + 1 : Math.max(0, old.count - 1);
            return { ...prev, [eventId]: { count: nextCount, reactedByMe: willReact } };
        });

        try {
            if (willReact) {
                await setDoc(
                    reactionRef,
                    {
                        eventId,
                        uid,
                        reaction: 'clap',
                        createdAt: serverTimestamp(),
                    },
                    { merge: true }
                );
            } else {
                await deleteDoc(reactionRef);
            }
        } catch (e) {
            console.error('[leaderboard] toggle reaction failed', e);
            setReactionsByEvent((prev) => ({
                ...prev,
                [eventId]: current,
            }));
            f7.toast.create({ text: 'Reaktion konnte nicht gespeichert werden.', closeTimeout: 1800 }).open();
        } finally {
            setReactionBusyByEvent((prev) => ({ ...prev, [eventId]: false }));
        }
    };

    return (
        <Page name="leaderboard">
            <Navbar title="Rangliste">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>

            <Block strong inset className="leaderboard-view-switch" role="tablist" aria-label="Ansicht wählen">
                <Button
                    small
                    fill={viewMode === 'ranking'}
                    outline={viewMode !== 'ranking'}
                    role="tab"
                    aria-selected={viewMode === 'ranking'}
                    onClick={() => setViewMode('ranking')}
                >
                    Rangliste
                </Button>
                <Button
                    small
                    fill={viewMode === 'feed'}
                    outline={viewMode !== 'feed'}
                    role="tab"
                    aria-selected={viewMode === 'feed'}
                    onClick={() => setViewMode('feed')}
                >
                    Live Feed
                </Button>
            </Block>
            <div className="leaderboard-filter-title">Filter</div>
            <Block strong inset className="leaderboard-filters" role="region" aria-label="Ranglistenfilter">
                <div className="leaderboard-filters__group" role="group" aria-label="Bereich">
                    <Button
                        small
                        fill={scopeFilter === 'all'}
                        outline={scopeFilter !== 'all'}
                        aria-pressed={scopeFilter === 'all'}
                        onClick={() => setScopeFilter('all')}
                    >
                        Alle
                    </Button>
                    <Button
                        small
                        fill={scopeFilter === 'friends'}
                        outline={scopeFilter !== 'friends'}
                        aria-pressed={scopeFilter === 'friends'}
                        onClick={() => setScopeFilter('friends')}
                    >
                        Freunde
                    </Button>
                </div>
                <div className="leaderboard-filters__group" role="group" aria-label="Zeit">
                    <Button
                        small
                        fill={timeFilter === 'all'}
                        outline={timeFilter !== 'all'}
                        aria-pressed={timeFilter === 'all'}
                        onClick={() => setTimeFilter('all')}
                    >
                        Alle Zeiten
                    </Button>
                    <Button
                        small
                        fill={timeFilter === 'today'}
                        outline={timeFilter !== 'today'}
                        aria-pressed={timeFilter === 'today'}
                        onClick={() => setTimeFilter('today')}
                    >
                        Nur heute
                    </Button>
                </div>
                <div className="leaderboard-filters__group" role="group" aria-label="Schwierigkeit">
                    <Button
                        small
                        fill={difficultyFilter === 'all'}
                        outline={difficultyFilter !== 'all'}
                        aria-pressed={difficultyFilter === 'all'}
                        onClick={() => setDifficultyFilter('all')}
                    >
                        Alle
                    </Button>
                    <Button
                        small
                        fill={difficultyFilter === 'easy'}
                        outline={difficultyFilter !== 'easy'}
                        aria-pressed={difficultyFilter === 'easy'}
                        onClick={() => setDifficultyFilter('easy')}
                    >
                        Easy
                    </Button>
                    <Button
                        small
                        fill={difficultyFilter === 'medium'}
                        outline={difficultyFilter !== 'medium'}
                        aria-pressed={difficultyFilter === 'medium'}
                        onClick={() => setDifficultyFilter('medium')}
                    >
                        Medium
                    </Button>
                    <Button
                        small
                        fill={difficultyFilter === 'hard'}
                        outline={difficultyFilter !== 'hard'}
                        aria-pressed={difficultyFilter === 'hard'}
                        onClick={() => setDifficultyFilter('hard')}
                    >
                        Hard
                    </Button>
                </div>
            </Block>
            {viewMode === 'ranking' ? (
                rankingRows.length === 0 ? (
                    <Block strong inset className="empty-state-card">
                        <div className="empty-state-title">Noch keine Punkte verfügbar</div>
                        <div className="empty-state-text">
                            Löse ein Sudoku, dann erscheinen hier Punkte und Platzierungen.
                        </div>
                        <Button small fill onClick={() => f7.views.main?.router.navigate('/sudoku/?mode=daily')}>
                            Daily starten
                        </Button>
                    </Block>
                ) : (
                    <List inset strong aria-live="polite">
                        <ListItem
                            className="leaderboard-table-head"
                            title="Platzierung / Username"
                            after="Punkte"
                        />
                        {rankingRows.map((row) => (
                            <ListItem
                                key={row.uid}
                                className={row.uid === uid ? 'leaderboard-row--me' : ''}
                                title={`${row.rank}. ${row.username}`}
                                text={`${row.solvedCount} gelöst`}
                                after={`${row.points} P`}
                            />
                        ))}
                    </List>
                )
            ) : filteredEvents.length === 0 ? (
                <Block strong inset className="empty-state-card">
                    <div className="empty-state-title">Noch keine Live-Meldungen</div>
                    <div className="empty-state-text">
                        Für den gewählten Filter gibt es aktuell keine Einträge.
                    </div>
                    <Button small fill onClick={() => f7.views.main?.router.navigate('/sudoku/?mode=daily')}>
                        Daily starten
                    </Button>
                </Block>
            ) : (
                <List inset strong aria-live="polite">
                    {filteredEvents.map((e) => {
                        const diff = String(e.difficulty || 'unbekannt');
                        const diffLabel =
                            diff === 'easy' ? 'Easy' : diff === 'medium' ? 'Medium' : diff === 'hard' ? 'Hard' : diff;
                        const ts = e.createdAt?.toDate ? e.createdAt.toDate() : null;
                        const tsLabel = ts ? new Intl.DateTimeFormat('de-DE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                        }).format(ts) : '–';
                        const reactionState = reactionsByEvent[e.id] || { count: 0, reactedByMe: false };
                        return (
                        <ListItem
                            key={e.id}
                            title={`${e.username || 'Unbekannt'} hat Sudoku Nr. ${e.puzzleIndex + 1} in der Schwierigkeitsklasse ${diffLabel} gelöst 🎉`}
                            after={tsLabel}
                            footer={
                                <div className="feed-reaction-row">
                                    <button
                                        type="button"
                                        className={`feed-reaction-btn ${reactionState.reactedByMe ? 'is-active' : ''}`}
                                        disabled={!!reactionBusyByEvent[e.id]}
                                        aria-label={`Applaus geben. Aktuell ${reactionState.count} Reaktionen`}
                                        onClick={(ev) => {
                                            ev.preventDefault();
                                            ev.stopPropagation();
                                            toggleClapReaction(e.id);
                                        }}
                                    >
                                        👏
                                    </button>
                                    <span className="feed-reaction-count">{reactionState.count}</span>
                                </div>
                            }
                        />
                    )})}
                </List>
            )}
            <Block strong inset className="leaderboard-points-legend">
                Punkte-Legende: Easy = 10, Medium = 25, Hard = 50
            </Block>
        </Page>
    );
}
