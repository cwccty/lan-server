import type { ReferenceRuntimeSnapshot } from './types';

declare global {
  interface Window {
    __LAN_HELPER_REFERENCE_RUNTIME__?: ReferenceRuntimeSnapshot;
  }
}

export {};
