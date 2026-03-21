import React from 'react';
import { createRoot } from 'react-dom/client';
import Framework7 from 'framework7/lite-bundle';
import Framework7React from 'framework7-react';
import 'framework7/css/bundle';
import '../css/icons.css';
import '../css/app.css';
import App from '../components/app.jsx';

// Einstiegspunkt der gesamten Web-App.
// Hier wird Framework7 mit React verbunden und die Hauptkomponente gemountet.
Framework7.use(Framework7React)

const root = createRoot(document.getElementById('app'));
root.render(React.createElement(App));
