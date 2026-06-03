import { useEffect, useMemo, useState } from 'react';
import { snapshotForDebug, summarizeReferenceRuntime } from './mappers';
import {
  getCurrentReferenceRuntimeSnapshot,
  selectReferenceLibraryStatus,
  selectReferenceNetworkStatus,
  selectReferenceTerrariaStatus,
  subscribeReferenceRuntime
} from './selectors';
import type { ReferenceRuntimeSnapshot } from './types';

export function useReferenceRuntime() {
  const [snapshot, setSnapshot] = useState<ReferenceRuntimeSnapshot | null>(() => getCurrentReferenceRuntimeSnapshot());

  useEffect(() => subscribeReferenceRuntime(setSnapshot), []);

  const summary = useMemo(() => (snapshot ? summarizeReferenceRuntime(snapshot) : null), [snapshot]);
  const debug = useMemo(() => (snapshot ? snapshotForDebug(snapshot) : null), [snapshot]);
  const network = useMemo(() => selectReferenceNetworkStatus(snapshot), [snapshot]);
  const terraria = useMemo(() => selectReferenceTerrariaStatus(snapshot), [snapshot]);
  const library = useMemo(() => selectReferenceLibraryStatus(snapshot), [snapshot]);

  return {
    snapshot,
    summary,
    debug,
    network,
    terraria,
    library,
    loaded: Boolean(snapshot),
    source: snapshot?.source ?? 'unavailable',
    errors: snapshot?.errors ?? []
  };
}
