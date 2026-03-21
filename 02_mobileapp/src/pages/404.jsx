/*
 * Datei: 404.jsx
 * Inhalt: Diese Datei enthält die Fallback-Seite für ungültige Routen.
 *         Sie wird angezeigt, wenn eine Adresse aufgerufen wird,
 *         für die in der App keine passende Seite definiert ist,
 *         und informiert knapp über den nicht gefundenen Inhalt.
 */

import React from 'react';
import { Page, Navbar, Block } from 'framework7-react';

const NotFoundPage = () => (
  <Page>
    <Navbar title="Not found" backLink />
    <Block strong inset>
      <p>Sorry</p>
      <p>Requested content not found.</p>
    </Block>
  </Page>
);

export default NotFoundPage;
