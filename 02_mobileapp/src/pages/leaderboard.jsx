import React from 'react';
import { Page, Navbar, Block, BlockTitle, NavRight } from 'framework7-react';
import ProfileButton from '../components/ProfileButton.jsx';

export default function LeaderboardPage() {
    return (
        <Page name="leaderboard">
            <Navbar title="Rangliste">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>

            <BlockTitle>Rangliste</BlockTitle>
            <Block strong inset>
                Platzhalter – Seite lädt ✅
            </Block>
        </Page>
    );
}
