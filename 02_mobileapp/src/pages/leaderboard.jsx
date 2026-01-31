import React, { useEffect, useState } from 'react';
import { Page, Navbar, Block, BlockTitle, NavRight, List, ListItem } from 'framework7-react';
import ProfileButton from '../components/ProfileButton.jsx';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '../js/firebase';

export default function LeaderboardPage() {
    const [events, setEvents] = useState([]);

    useEffect(() => {
        const q = query(collection(db, 'sudokuEvents'), orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    return (
        <Page name="leaderboard">
            <Navbar title="Rangliste">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>

            <BlockTitle>Live Feed</BlockTitle>
            {events.length === 0 ? (
                <Block strong inset>Keine Meldungen.</Block>
            ) : (
                <List inset strong>
                    {events.map((e) => {
                        const diff = String(e.difficulty || 'unbekannt');
                        const diffLabel =
                            diff === 'easy' ? 'Easy' : diff === 'medium' ? 'Medium' : diff === 'hard' ? 'Hard' : diff;
                        const ts = e.createdAt?.toDate ? e.createdAt.toDate() : null;
                        const tsLabel = ts ? new Intl.DateTimeFormat('de-DE', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                        }).format(ts) : '–';
                        return (
                        <ListItem
                            key={e.id}
                            title={`${e.username || 'Unbekannt'} hat Sudoku Nr. ${e.puzzleIndex + 1} in der Schwierigkeitsklasse ${diffLabel} gelöst 🎉`}
                            after={tsLabel}
                        />
                    )})}
                </List>
            )}
        </Page>
    );
}
