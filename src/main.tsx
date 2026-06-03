import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './reference-ui/App';
import './reference-ui/index.css';
import { startReferenceRuntimeBridge } from './reference-adapter/bootstrap';

startReferenceRuntimeBridge();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
