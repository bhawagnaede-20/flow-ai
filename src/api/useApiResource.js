/**
 * useApiResource — loading/error/empty state machine for backend GETs.
 *
 * Mirrors the status contract the pages already use with useSimulatedResource
 * ('loading' | 'ready' | 'error' | 'empty') so pages can adopt backend data
 * without redesigning their state views, and honours the header's DemoState
 * preview modes (auto/loading/error/empty) exactly like the demo hook did.
 *
 * - `source` is 'backend' when data came from the API, 'demo' when the built-in
 *   fallback dataset was used because the backend failed (clearly labelled).
 * - Mutations are NOT handled here; callers must catch their ApiError and show
 *   the failure — never report a failed mutation as successful.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDemoState } from '../state/demoState.jsx';
import { DEMO_FALLBACK_NOTICE } from './endpoints.js';

const INITIAL = { status: 'loading', data: null, source: null, error: null };

function isEmpty(data, emptyWhen) {
  if (typeof emptyWhen === 'function') return Boolean(emptyWhen(data));
  if (Array.isArray(data)) return data.length === 0;
  if (data && typeof data === 'object' && Array.isArray(data.roads)) return data.roads.length === 0;
  if (data && typeof data === 'object' && Array.isArray(data.incidents)) return data.incidents.length === 0;
  if (data && typeof data === 'object' && Array.isArray(data.missions)) return data.missions.length === 0;
  return false;
}

/**
 * @param {() => Promise<any>} loader  a GET helper from ./endpoints.js (usually
 *                                     already mapped through ./adapter.js)
 * @param {object}  [options]
 * @param {any}     [options.fallback] demo dataset used (labelled) when the loader fails
 * @param {(data:any)=>boolean} [options.emptyWhen]
 * @returns {{ status: string, data: any, source: string|null, error: Error|null,
 *             isFallback: boolean, isForced: boolean, fallbackNotice: string|null,
 *             retry: () => void }}
 */
export function useApiResource(loader, { fallback = null, emptyWhen } = {}) {
  const { mode, reset } = useDemoState();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState(INITIAL);

  // Keep latest props in refs so identity changes do not re-trigger fetches.
  const loaderRef = useRef(loader);
  const fallbackRef = useRef(fallback);
  const emptyWhenRef = useRef(emptyWhen);
  loaderRef.current = loader;
  fallbackRef.current = fallback;
  emptyWhenRef.current = emptyWhen;

  useEffect(() => {
    // Header DemoState preview: force a state without touching the network.
    if (mode === 'loading') {
      setState(INITIAL);
      return undefined;
    }
    if (mode === 'error') {
      setState({ status: 'error', data: null, source: null, error: null });
      return undefined;
    }
    if (mode === 'empty') {
      setState({ status: 'empty', data: [], source: 'backend', error: null });
      return undefined;
    }

    let cancelled = false;
    setState(INITIAL);

    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => {
        if (cancelled) return;
        setState({
          status: isEmpty(data, emptyWhenRef.current) ? 'empty' : 'ready',
          data,
          source: 'backend',
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        const fb = fallbackRef.current;
        if (fb !== null && fb !== undefined) {
          // Demo fallback — always labelled, never presented as backend data.
          setState({
            status: isEmpty(fb, emptyWhenRef.current) ? 'empty' : 'ready',
            data: fb,
            source: 'demo',
            error,
          });
        } else {
          setState({ status: 'error', data: null, source: null, error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, attempt]);

  const retry = useCallback(() => {
    if (mode !== 'auto') reset();
    setAttempt((a) => a + 1);
  }, [mode, reset]);

  const isFallback = state.source === 'demo';
  return {
    ...state,
    isFallback,
    isForced: mode !== 'auto',
    fallbackNotice: isFallback ? DEMO_FALLBACK_NOTICE : null,
    retry,
  };
}

export default useApiResource;
