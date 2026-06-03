import { useEffect } from 'react';
import { startReferenceRuntimeBridge, stopReferenceRuntimeBridge } from './bootstrap';
import { useReferenceProductMode } from './useReferenceProductMode';

/**
 * 参考前端默认必须保持轻量，不在启动时扫描游戏库或轮询后端。
 * 只有开启 Product Mode 后，才启动真实状态桥接，并且桥接层默认只读取轻量状态。
 */
export function ReferenceProductRuntimeBridgeController() {
  const productMode = useReferenceProductMode();

  useEffect(() => {
    if (!productMode.enabled) {
      stopReferenceRuntimeBridge();
      return;
    }

    startReferenceRuntimeBridge({
      intervalMs: 15000,
      includeDiagnostics: false,
      includeInventory: false
    });

    return () => {
      stopReferenceRuntimeBridge();
    };
  }, [productMode.enabled]);

  return null;
}
