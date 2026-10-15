import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HydrogenAbstractView from './HydrogenAbstractView';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../components/simulation/AbstractSideToolbar', () => ({
  AbstractSideToolbar: ({ onInitialLevelChange, onElectronCountChange, onViewModeChange, onTogglePlay }: {
    onInitialLevelChange: (level: number) => void;
    onElectronCountChange: (count: 'single' | 'multi') => void;
    onViewModeChange: (mode: 'spontaneous' | 'excitation') => void;
    onTogglePlay: () => void;
  }) => <div>
    <button onClick={() => onInitialLevelChange(2)}>Level 2</button>
    <button onClick={() => onElectronCountChange('multi')}>Multiple electrons</button>
    <button onClick={() => onViewModeChange('excitation')}>Excitation</button>
    <button onClick={onTogglePlay}>Toggle play</button>
  </div>,
}));

describe('abstract simulation configuration', () => {
  it('initializes immediately and resets paused configuration changes', () => {
    const { container } = render(<MemoryRouter><HydrogenAbstractView /></MemoryRouter>);
    const electrons = () => container.querySelectorAll('circle[fill="#00ffff"]');
    expect(electrons()).toHaveLength(1);
    expect(electrons()[0]).toHaveAttribute('cy', '210');

    fireEvent.click(screen.getByText('Level 2'));
    expect(electrons()[0]).toHaveAttribute('cy', '385');
    fireEvent.click(screen.getByText('Multiple electrons'));
    expect(electrons()).toHaveLength(100);
    fireEvent.click(screen.getByText('Excitation'));
    expect(electrons()).toHaveLength(1);
    expect(electrons()[0]).toHaveAttribute('cy', '560');
  });

  it('keeps active electron state when a configuration change happens during playback', () => {
    const request = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const { container, unmount } = render(<MemoryRouter><HydrogenAbstractView /></MemoryRouter>);
    fireEvent.click(screen.getByText('Toggle play'));
    fireEvent.click(screen.getByText('Multiple electrons'));
    expect(container.querySelectorAll('circle[fill="#00ffff"]')).toHaveLength(1);
    unmount();
    expect(cancel).toHaveBeenCalled();
    request.mockRestore();
    cancel.mockRestore();
  });
});
