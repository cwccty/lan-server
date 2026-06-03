import type { ReferenceProductModeState } from './productMode';
import type { ReferenceRuntimeSnapshot } from './types';

declare global {
  interface Window {
    __LAN_HELPER_REFERENCE_RUNTIME__?: ReferenceRuntimeSnapshot;
    __LAN_HELPER_REFERENCE_PRODUCT_MODE__?: ReferenceProductModeState;
  }
}

export {};
