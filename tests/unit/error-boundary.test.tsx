import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/platform/ErrorBoundary';

function BrokenPage(): never {
  throw new Error('Sensitive diagnostic detail');
}

describe('application error boundary', () => {
  it('shows recovery actions without displaying internal error details', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ErrorBoundary><BrokenPage /></ErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Sensitive diagnostic detail')).not.toBeInTheDocument();
  });
});
