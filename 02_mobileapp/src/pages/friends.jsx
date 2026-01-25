import React from 'react';
import { Page, Navbar, Block, BlockTitle, NavRight } from 'framework7-react';
import ProfileButton from '../components/ProfileButton.jsx';

export default function FriendsPage() {
    return (
        <Page name="friends">
            <Navbar title="Freunde">
                <NavRight>
                    <ProfileButton />
                </NavRight>
            </Navbar>

            <BlockTitle>Deine Freunde</BlockTitle>
            <Block strong inset>
                Hier kommen später Freundesliste & Rangliste rein.
            </Block>
        </Page>
    );
}
