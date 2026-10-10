import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * DemoState lets the header preview the three required UI states
 * (loading / error / empty) without touching the data layer.
 * 'auto' runs the normal simulated load sequence.
 */
const MODES = [
  { value: 'auto', label: 'Data' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
  { value: 'empty', label: 'Empty' },
];

const DemoStateContext = createContext({
  mode: 'auto',
  setMode: () => {},
  modes: MODES,
});

export function DemoStateProvider({ children }) {
  const [mode, setMode] = useState('auto');
  const value = useMemo(() => ({ mode, setMode, modes: MODES }), [mode]);
  return <DemoStateContext.Provider value={value}>{children}</DemoStateContext.Provider>;
}

export function useDemoState() {
  const ctx = useContext(DemoStateContext);
  if (!ctx) throw new Error('useDemoState must be used inside <DemoStateProvider>');
  const { mode, setMode, modes } = ctx;
  const reset = useCallback(() => setMode('auto'), [setMode]);
  return { mode, setMode, reset, modes };
}
