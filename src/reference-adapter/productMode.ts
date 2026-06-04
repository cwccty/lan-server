const STORAGE_KEY = 'lan-helper.referenceProductMode';
const EVENT_NAME = 'lan-helper:reference-product-mode-changed';

export interface ReferenceProductModeState {
  enabled: boolean;
  updated_at: string;
}

function readStoredValue() {
  try {
    const isTauriRuntime = Boolean((window as typeof window & {
      __TAURI__?: unknown;
      __TAURI_INTERNALS__?: unknown;
    }).__TAURI__ || (window as typeof window & {
      __TAURI__?: unknown;
      __TAURI_INTERNALS__?: unknown;
    }).__TAURI_INTERNALS__);

    // 发布 EXE 不能因为旧 WebView localStorage 曾保存过 "0" 而退回参考展示模式。
    // Tauri/EXE 环境始终启用真实产品接入；只有普通浏览器预览允许关闭，
    // 用于继续检查最终参考 UI 的视觉保真。
    if (isTauriRuntime) return true;

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
    return false;
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

