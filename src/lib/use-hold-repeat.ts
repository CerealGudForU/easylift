import { useCallback, useEffect, useRef } from 'react';

const HOLD_DELAY = 400;
const HOLD_INTERVAL = 90;

/**
 * Press-and-hold repeat for −/+ buttons: fires once on press, then repeatedly while held.
 * Wire `start(dir)` to onPressIn and `stop` to onPressOut.
 */
export function useHoldRepeat(onStep: (dir: 1 | -1) => void) {
  const stepRef = useRef(onStep);
  useEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});

  const stop = useCallback(() => {
    clearTimeout(timers.current.delay);
    clearInterval(timers.current.repeat);
  }, []);

  const start = useCallback(
    (dir: 1 | -1) => {
      stop();
      stepRef.current(dir);
      timers.current.delay = setTimeout(() => {
        timers.current.repeat = setInterval(() => stepRef.current(dir), HOLD_INTERVAL);
      }, HOLD_DELAY);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);
  return { start, stop };
}
