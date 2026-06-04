﻿import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './reference-ui/App';
import './reference-runtime.css';
import {
  ReferenceProductDiagnosticsPatcher,
  ReferenceProductActionPatcher,
  ReferenceProductActionResultPatcher,
  ReferenceProductAdvancedToolsPatcher,
  ReferenceProductInventoryPatcher,
  ReferenceProductSettingsPatcher,
  ReferenceProductRuntimeBridgeController,
  ReferenceRuntimeDebugPanel,
} from './reference-adapter';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <ReferenceProductRuntimeBridgeController />
    <ReferenceProductDiagnosticsPatcher />
    <ReferenceProductActionPatcher />
    <ReferenceProductActionResultPatcher />
    <ReferenceProductAdvancedToolsPatcher />
    <ReferenceProductInventoryPatcher />
    <ReferenceProductSettingsPatcher />
    <ReferenceRuntimeDebugPanel />
  </React.StrictMode>
);
