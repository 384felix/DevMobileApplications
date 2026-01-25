import React from 'react';
import { Page, Navbar, Block, BlockTitle } from 'framework7-react';
import ProfileButton from '../components/ProfileButton.jsx';

export default function FriendsPage() {
    return (
        <Page name="friends">
            <Navbar title="Freunde">
                {/* Profil-Icon auch hier */}
                <ProfileButton />
            </Navbar>

            <BlockTitle>Deine Freunde</BlockTitle>
            <Block strong inset>
                Hier kommen später Freundesliste & Rangliste rein.
            </Block>
        </Page>
    );
}
