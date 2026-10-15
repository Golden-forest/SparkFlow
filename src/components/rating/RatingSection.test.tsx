import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RatingSection } from './RatingSection';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/components/simulation/LazyPreview', () => ({ LazyPreview: () => null }));

const manifest = {
  version: 1,
  rateable: [{ id: 'a1', bg: 'Background' }],
  orders: { teacher1: ['a1'] },
  browse: [],
  cal: [{ n: 1, file: 'cal/a1.html', label: 'Calibration one', symptom: 'Evidence', goal: 'Target' }],
};

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest), {
    headers: { 'content-type': 'application/json' },
  })));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('rating persistence', () => {
  it('reports corrupt stored data and preserves the original while new ratings stay usable', async () => {
    window.localStorage.setItem('sparkflow.rating.rater', 'teacher1');
    window.localStorage.setItem('sparkflow.rating.v1', 'null');
    render(<RatingSection />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Export them before leaving.');
    fireEvent.click(screen.getByRole('button', { name: 'tab.rate' }));
    fireEvent.click(screen.getByRole('button', { name: 'dim.d3 5' }));
    expect(window.localStorage.getItem('sparkflow.rating.v1')).toBe('null');
    expect(screen.getByRole('button', { name: 'dim.d3 5' })).toHaveClass('bg-cyan-500/25');
  });

  it('keeps scoring available when browser storage is unavailable', async () => {
    render(<RatingSection />);
    const select = await screen.findByRole('button', { name: 'identity.teacher1' });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
    fireEvent.click(select);
    fireEvent.click(screen.getByRole('button', { name: 'tab.rate' }));
    fireEvent.click(screen.getByRole('button', { name: 'dim.d3 5' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Your current ratings remain in this tab.');
    expect(screen.getByRole('button', { name: 'dim.d3 5' })).toHaveClass('bg-cyan-500/25');
    expect(screen.getByRole('button', { name: 'export.button' })).toBeEnabled();
  });

  it('merges consecutive scores and opens calibration at its real asset URL', async () => {
    render(<RatingSection />);
    fireEvent.click(await screen.findByRole('button', { name: 'identity.teacher1' }));
    // The card title is below the preview; activate its clickable preview separately.
    const title = screen.getByText('Calibration one');
    fireEvent.click(title.closest('article')!.firstElementChild!);
    const frame = screen.getByTitle('Calibration one');
    expect(frame).toHaveAttribute('src', '/rating/cal/a1.html');
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    fireEvent.click(screen.getByRole('button', { name: 'tab.rate' }));
    fireEvent.click(screen.getByRole('button', { name: 'dim.d3 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'dim.d4 4' }));
    expect(JSON.parse(window.localStorage.getItem('sparkflow.rating.v1')!).teacher1.a1.dims).toEqual({ d3: 5, d4: 4 });
  });
});
