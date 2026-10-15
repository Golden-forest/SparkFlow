import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountActionError } from './client';
import { useAccountAction } from './useAccountAction';

describe('account submission lifecycle', () => {
  it('locks duplicate submissions synchronously and reports success only after completion', async () => {
    let finish!: () => void;
    const operation = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { result } = renderHook(useAccountAction);
    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.run(operation, 'Unable to save.');
      second = result.current.run(operation, 'Unable to save.');
    });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(result.current.pending).toBe(true);
    await expect(second).resolves.toBe(false);
    await act(async () => finish());
    await expect(first).resolves.toBe(true);
    expect(result.current.pending).toBe(false);
  });

  it('aborts on unmount and ignores late successful completions', async () => {
    let finish!: () => void;
    let signal!: AbortSignal;
    const { result, unmount } = renderHook(useAccountAction);
    let completion!: Promise<boolean>;
    act(() => { completion = result.current.run(value => { signal = value; return new Promise<void>(resolve => { finish = resolve; }); }, 'Failed.'); });
    unmount();
    expect(signal.aborted).toBe(true);
    finish();
    await expect(completion).resolves.toBe(false);
  });

  it('shows a generic failure instead of leaking server account details', async () => {
    const { result } = renderHook(useAccountAction);
    await act(async () => { await result.current.run(async () => { throw new Error('USER_NOT_FOUND private@example.com'); }, 'Unable to sign in.'); });
    expect(result.current.error).toBe('Unable to sign in.');
    expect(result.current.pending).toBe(false);
    await act(async () => { await result.current.run(async () => { throw new AccountActionError(429); }, 'Unable to sign in.'); });
    expect(result.current.error).toBe('Too many attempts. Please try again later.');
  });
});
