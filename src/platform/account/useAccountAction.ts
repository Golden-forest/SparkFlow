import { useCallback, useEffect, useRef, useState } from 'react';
import { RequestError } from '@/platform/request';
import { AccountActionError } from './client';

export function useAccountAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      activeRequest.current?.abort();
    };
  }, []);

  const run = useCallback(async (operation: (signal: AbortSignal) => Promise<unknown>, failureMessage: string): Promise<boolean> => {
    if (activeRequest.current) return false;
    const controller = new AbortController();
    activeRequest.current = controller;
    setPending(true);
    setError(null);
    try {
      await operation(controller.signal);
      return mounted.current && !controller.signal.aborted;
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) {
        const status = failure instanceof AccountActionError || failure instanceof RequestError ? failure.status : undefined;
        setError(status === 429 ? 'Too many attempts. Please try again later.' : failureMessage);
      }
      return false;
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      if (mounted.current && !controller.signal.aborted) setPending(false);
    }
  }, []);

  return { pending, error, setError, run };
}
