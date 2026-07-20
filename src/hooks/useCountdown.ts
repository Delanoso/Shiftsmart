import { useEffect, useState } from 'react';
import { COUNTDOWN_SECONDS } from '../types';

interface UseCountdownOptions {
  active: boolean;
  onDone: () => void;
}

export function useCountdown({ active, onDone }: UseCountdownOptions) {
  const [value, setValue] = useState<number | null>(null);

  useEffect(() => {
    if (!active) {
      setValue(null);
      return;
    }

    setValue(COUNTDOWN_SECONDS);
    let current = COUNTDOWN_SECONDS;
    const id = window.setInterval(() => {
      current -= 1;
      if (current <= 0) {
        window.clearInterval(id);
        setValue(null);
        onDone();
      } else {
        setValue(current);
      }
    }, 1000);

    return () => window.clearInterval(id);
  }, [active, onDone]);

  return value;
}
