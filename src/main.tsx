import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './reference-ui/App';
import './reference-ui/index.css';
import {
  ReferenceProductHeaderPatcher,
  ReferenceProductHomePatcher,
  ReferenceRuntimeDebugPanel,
  startReferenceRuntimeBridge
} from './reference-adapter';

startReferenceRuntimeBridge();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <ReferenceProductHeaderPatcher />
    <ReferenceProductHomePatcher />
    <ReferenceRuntimeDebugPanel />
  </React.StrictMode>
);
