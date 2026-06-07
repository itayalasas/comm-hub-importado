import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { configManager } from './lib/config';

const root = ReactDOM.createRoot(document.getElementById('root')!);

void configManager.loadConfig();

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
