﻿import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './reference-ui/App';
import './reference-runtime.css';
import {
  ReferenceProductDiagnosticsPatcher,
  ReferenceProductActionPatcher,
  ReferenceProductActionResultPatcher,
  ReferenceProductAdvancedToolsPatcher,
  ReferenceProductHeaderPatcher,
  ReferenceProductHomePatcher,
  ReferenceProductRuntimeBridgeController,
  ReferenceRuntimeDebugPanel,
} from './reference-adapter';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <ReferenceProductRuntimeBridgeController />
    <ReferenceProductHeaderPatcher />
    <ReferenceProductHomePatcher />
    <ReferenceProductDiagnosticsPatcher />
    <ReferenceProductActionPatcher />
    <ReferenceProductActionResultPatcher />
    <ReferenceProductAdvancedToolsPatcher />
    <ReferenceRuntimeDebugPanel />
  </React.StrictMode>
);
