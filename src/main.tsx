﻿import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './reference-ui/App';
import './reference-runtime.css';
import {
  ReferenceProductDiagnosticsPatcher,
  ReferenceProductActionPatcher,
  ReferenceProductActionResultPatcher,
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
    <ReferenceProductDiagnosticsPatcher />
    <ReferenceProductActionPatcher />
    <ReferenceProductActionResultPatcher />
    <ReferenceRuntimeDebugPanel />
  </React.StrictMode>
);