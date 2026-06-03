import { useEffect, useState } from 'react';
import { getReferenceProductMode, setReferenceProductMode, subscribeReferenceProductMode, type ReferenceProductModeState } from './productMode';

export function useReferenceProductMode() {
  const [state, setState] = useState<ReferenceProductModeState>(() => getReferenceProductMode());

  useEffect(() => subscribeReferenceProductMode(setState), []);

  return {
    enabled: state.enabled,
    updated_at: state.updated_at,
    setEnabled: setReferenceProductMode,
    toggle: () => setReferenceProductMode(!state.enabled)
  };
}
