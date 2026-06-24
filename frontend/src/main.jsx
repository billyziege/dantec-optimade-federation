import React from 'react';
import { createRoot } from 'react-dom/client';
import { RelayEnvironmentProvider } from 'react-relay';
import { RelayEnvironment } from './relay/environment';
import App from './App';
import './index.css';

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <RelayEnvironmentProvider environment={RelayEnvironment}>
      <App />
    </RelayEnvironmentProvider>
  </React.StrictMode>
);
