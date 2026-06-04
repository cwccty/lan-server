const STORAGE_KEY = 'lan-helper.referenceProductMode';
const EVENT_NAME = 'lan-helper:reference-product-mode-changed';

export interface ReferenceProductModeState {
  enabled: boolean;
  updated_at: string;
}

function readStoredValue() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;

    // 打包后的 EXE 必须默认进入真实产品模式，不能把一比一参考稿里的
    // 24ms、75%、n2n.edge.me 等演示状态当成真实产品状态展示给用户。
    // 普通浏览器预览仍保持参考模式，方便继续做视觉保真检查。
    return Boolean((window as typeof window & {
      __TAURI__?: unknown;
      __TAURI_INTERNALS__?: unknown;
    }).__TAURI__ || (window as typeof window & {
      __TAURI__?: unknown;
      __TAURI_INTERNALS__?: unknown;
    }).__TAURI_INTERNALS__);
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
