import { useEffect, useState } from 'react';
import { useDemoState } from '../state/demoState.jsx';

const LOAD_DELAY_MS = 600;

/**
 * Simulates an async data fetch against the (future) backend.
 *
 * status: 'loading' | 'ready' | 'error' | 'empty'
 *
 * The DemoStateProvider in the header can force loading / error / empty so
 * every page can preview its states during the demo.
 *
 * @param {() => any} factory        returns the dataset (usually from simulatedData)
 * @param {object}    options
 * @param {number}    options.delay  simulated latency in ms
 * @param {boolean}   options.isEmptyOverride treat payload as empty
 */
export function useSimulatedResource(factory, { delay = LOAD_DELAY_MS, isEmptyOverride = false } = {}) {
  const { mode, reset } = useDemoState();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    if (mode === 'loading') {
      setState({ status: 'loading', data: null });
      return undefined;
    }
    if (mode === 'error') {
      setState({ status: 'error', data: null });
      return undefined;
    }

    let cancelled = false;
    setState({ status: 'loading', data: null });

    const timer = setTimeout(() => {
      if (cancelled) return;
      const data = factory();
      if (mode === 'empty' || isEmptyOverride) {
        setState({ status: 'empty', data: Array.isArray(data) ? [] : data });
      } else {
        setState({ status: 'ready', data });
      }
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, attempt, delay, isEmptyOverride]);

  const retry = () => {
    if (mode !== 'auto') reset();
    setAttempt((a) => a + 1);
  };

  return { ...state, retry, isForced: mode !== 'auto' };
}
