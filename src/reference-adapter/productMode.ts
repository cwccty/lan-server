const STORAGE_KEY = 'lan-helper.referenceProductMode';
const EVENT_NAME = 'lan-helper:reference-product-mode-changed';

export interface ReferenceProductModeState {
  enabled: boolean;
  updated_at: string;
}

function readStoredValue() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function getReferenceProductMode(): ReferenceProductModeState {
  return {
    enabled: readStoredValue(),
    updated_at: new Date().toISOString()
  };
}

export function setReferenceProductMode(enabled: boolean): ReferenceProductModeState {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // localStorage 不可用时保持内存外观，不影响默认参考 UI。
  }

  const state = getReferenceProductMode();
  window.__LAN_HELPER_REFERENCE_PRODUCT_MODE__ = state;
  window.dispatchEvent(new CustomEvent<ReferenceProductModeState>(EVENT_NAME, { detail: state }));
  return state;
}

export function subscribeReferenceProductMode(listener: (state: ReferenceProductModeState) => void) {
  const handleUpdate = (event: Event) => {
    const custom = event as CustomEvent<ReferenceProductModeState>;
    listener(custom.detail ?? getReferenceProductMode());
  };

  window.addEventListener(EVENT_NAME, handleUpdate as EventListener);
  listener(getReferenceProductMode());

  return () => window.removeEventListener(EVENT_NAME, handleUpdate as EventListener);
}

export { EVENT_NAME as REFERENCE_PRODUCT_MODE_EVENT };
