import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountSession } from './client';
import AccountRoutes from './AccountRoutes';
import { AccountSessionLayout, RequireAccount } from './AccountSessionLayout';
import { useAccount } from './context';

const sdk = vi.hoisted(() => {
  const session = { data: null as AccountSession | null, isPending: false, isRefetching: false, error: null as Error | null, refetch: vi.fn(async () => {}) };
  const success = () => Promise.resolve({ data: {}, error: null });
  const client = {
    useSession: vi.fn(() => session),
    signIn: { email: vi.fn(success) }, signUp: { email: vi.fn(success) },
    signOut: vi.fn(success), requestPasswordReset: vi.fn(success), resetPassword: vi.fn(success),
    sendVerificationEmail: vi.fn(success), updateUser: vi.fn(success),
    changePassword: vi.fn(success), revokeOtherSessions: vi.fn(success),
  };
  return { session, client, getClient: vi.fn(() => client) };
});

vi.mock('./client', async importOriginal => ({ ...await importOriginal<typeof import('./client')>(), getAccountClient: sdk.getClient }));

const userSession: AccountSession = {
  user: { id: 'user-1', name: 'Ada', email: 'ada@example.com', emailVerified: true, createdAt: new Date(), updatedAt: new Date(), image: null },
  session: { id: 'session-1', userId: 'user-1', token: 'opaque-test-token', expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date(), ipAddress: null, userAgent: null },
};

function CurrentPath() {
  const location = useLocation();
  return <output aria-label="Current path">{location.pathname}{location.search}</output>;
}

function account(path: string, config: Parameters<typeof AccountRoutes>[0]['config'] = { status: 'ready', apiURL: 'https://api.example.com' }) {
  return render(<MemoryRouter initialEntries={[path]}>
    <CurrentPath />
    <Routes><Route path="/account/*" element={<AccountRoutes config={config} />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sdk.session.data = null;
  sdk.session.isPending = false;
  sdk.session.isRefetching = false;
  sdk.session.error = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ notes: [] })));
});
afterEach(() => {
  expect(console.error).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe('account route boundaries', () => {
  it('does not create an auth client when account services are disabled or invalid', () => {
    const view = account('/account/sign-in', { status: 'disabled' });
    expect(screen.getByRole('heading', { name: 'Accounts are not configured' })).toBeInTheDocument();
    expect(sdk.getClient).not.toHaveBeenCalled();
    view.unmount();
    account('/account', { status: 'invalid' });
    expect(screen.getByRole('heading', { name: 'Account unavailable' })).toBeInTheDocument();
    expect(sdk.getClient).not.toHaveBeenCalled();
  });

  it('waits for session restoration and then sends anonymous users to sign in without using returnTo', () => {
    sdk.session.isPending = true;
    const view = account('/account?returnTo=https://evil.example.com');
    expect(screen.getByText('Checking your session…')).toHaveAttribute('role', 'status');
    sdk.session.isPending = false;
    view.rerender(<MemoryRouter initialEntries={['/account']}><Routes><Route path="/account/*" element={<AccountRoutes config={{ status: 'ready', apiURL: 'https://api.example.com' }} />} /></Routes></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('keeps session failures distinct from signed-out state and offers retry', () => {
    sdk.session.error = new Error('private network details');
    account('/account');
    expect(screen.getByRole('heading', { name: 'Account unavailable' })).toBeInTheDocument();
    expect(screen.queryByText('private network details')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(sdk.session.refetch).toHaveBeenCalledTimes(1);
  });

  it('does not expose protected UI to an unconfirmed session', () => {
    sdk.session.data = { ...userSession, user: { ...userSession.user, emailVerified: false } };
    account('/account');
    expect(screen.getByRole('heading', { name: 'Email confirmation' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Private notes' })).not.toBeInTheDocument();
  });
});

describe('reusable business route protection', () => {
  function BusinessDashboard() {
    const { session } = useAccount();
    return <main><h1>Business dashboard</h1><p>{session?.user.name}</p></main>;
  }

  function business(config: Parameters<typeof AccountSessionLayout>[0]['config']) {
    return render(<MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<AccountSessionLayout config={config} />}>
          <Route element={<RequireAccount />}>
            <Route path="/dashboard" element={<BusinessDashboard />} />
          </Route>
        </Route>
        <Route path="/account/sign-in" element={<h1>Business sign in destination</h1>} />
      </Routes>
    </MemoryRouter>);
  }

  it('protects routes outside /account and forwards session context without adding account chrome', () => {
    sdk.session.data = userSession;
    business({ status: 'ready', apiURL: 'https://api.example.com' });
    expect(screen.getByRole('heading', { name: 'Business dashboard' })).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Back to home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your account' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('fails closed without configuration and never renders protected business content', () => {
    business({ status: 'disabled' });
    expect(screen.getByRole('heading', { name: 'Accounts are not configured' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Business dashboard' })).not.toBeInTheDocument();
    expect(sdk.getClient).not.toHaveBeenCalled();
  });

  it('redirects anonymous business-route visits to the single sign-in route', () => {
    business({ status: 'ready', apiURL: 'https://api.example.com' });
    expect(screen.getByRole('heading', { name: 'Business sign in destination' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Business dashboard' })).not.toBeInTheDocument();
  });
});

describe('account email and password flows', () => {
  it('rejects password mismatch before registration and uses only the fixed confirmation callback', async () => {
    account('/account/sign-up?returnTo=https://evil.example.com');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Ada ' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'Strong password 123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different password' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('The passwords do not match.');
    expect(sdk.client.signUp.email).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Strong password 123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Create account' }).closest('form')!);
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(sdk.client.signUp.email).toHaveBeenCalledWith({ name: 'Ada', email: 'ada@example.com', password: 'Strong password 123', callbackURL: `${window.location.origin}/account/verify-email` }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(sdk.client.signIn.email).not.toHaveBeenCalled();
  });

  it('uses a generic reset-request response and a fixed local redirect', async () => {
    account('/account/forgot-password?redirectTo=https://evil.example.com');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'unknown@example.com' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Send reset link' }).closest('form')!);
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    expect(screen.getByText(/If an account exists for this address/)).toBeInTheDocument();
    expect(sdk.client.requestPasswordReset).toHaveBeenCalledWith({ email: 'unknown@example.com', redirectTo: `${window.location.origin}/account/reset-password` }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('scrubs the reset token after success without automatically signing in', async () => {
    account('/account/reset-password?token=one-time-secret&returnTo=https://evil.example.com');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'New password 123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'New password 123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Reset password' }).closest('form')!);
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument();
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/account/reset-password');
    expect(screen.getByLabelText('Current path')).not.toHaveTextContent('token=');
    expect(sdk.client.resetPassword).toHaveBeenCalledWith({ newPassword: 'New password 123', token: 'one-time-secret' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(sdk.client.signIn.email).not.toHaveBeenCalled();
  });

  it('treats incomplete reset links as unavailable and never claims direct confirmation visits succeeded', () => {
    const view = account('/account/reset-password');
    expect(screen.getByRole('heading', { name: 'Reset link unavailable' })).toBeInTheDocument();
    expect(sdk.client.resetPassword).not.toHaveBeenCalled();
    view.unmount();
    account('/account/verify-email');
    expect(screen.getByRole('heading', { name: 'Email confirmation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend confirmation email' })).toBeInTheDocument();
    expect(screen.queryByText(/Your email has been verified/)).not.toBeInTheDocument();
  });
});

describe('signed-in account tools', () => {
  it('saves a trimmed profile and performs real sign-out', async () => {
    sdk.session.data = userSession;
    account('/account');
    expect(screen.getByRole('heading', { name: 'Your account' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: ' Ada Lovelace ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save profile' }).closest('form')!);
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
    expect(sdk.client.updateUser).toHaveBeenCalledWith({ name: 'Ada Lovelace' }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(sdk.client.signOut).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(sdk.session.refetch).toHaveBeenCalledTimes(1));
  });

  it('changes passwords with current-password verification and explicit other-session revocation', async () => {
    sdk.session.data = userSession;
    account('/account');
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Old password 123' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'New password 123' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'New password 123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Change password' }).closest('form')!);
    expect(await screen.findByText('Password updated. Other devices have been signed out.')).toBeInTheDocument();
    expect(sdk.client.changePassword).toHaveBeenCalledWith({ currentPassword: 'Old password 123', newPassword: 'New password 123', revokeOtherSessions: true }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Sign out other devices' }));
    expect(await screen.findByText('Other devices have been signed out.')).toBeInTheDocument();
    expect(sdk.client.revokeOtherSessions).toHaveBeenCalledTimes(1);
  });

  it('renders note text safely and only removes a note after successful deletion', async () => {
    const note = { id: 'note-1', body: '<script>alert("unsafe")</script>', createdAt: '2026-10-06T00:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ notes: [note] })).mockResolvedValueOnce(new Response(null, { status: 204 })));
    sdk.session.data = userSession;
    account('/account');
    const notes = await screen.findByRole('list', { name: 'Your notes' });
    expect(within(notes).getByText(note.body)).toBeInTheDocument();
    expect(notes.querySelector('script')).toBeNull();
    fireEvent.click(within(notes).getByRole('button', { name: 'Delete note' }));
    expect(await screen.findByText('No notes yet.')).toBeInTheDocument();
  });

  it('clears cached private notes and disables editing when the server expires the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    sdk.session.data = userSession;
    sdk.session.refetch.mockImplementationOnce(async () => { sdk.session.data = null; });
    const view = account('/account');
    expect(await screen.findByText(/Your session has ended/)).toBeInTheDocument();
    expect(sdk.session.refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute('href', '/account/sign-in');
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
    // The SDK mock exposes snapshots; rerender to publish the refetched session.
    view.rerender(<MemoryRouter initialEntries={['/account']}><CurrentPath /><Routes><Route path="/account/*" element={<AccountRoutes config={{ status: 'ready', apiURL: 'https://api.example.com' }} />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your account' })).not.toBeInTheDocument();
  });

  it.each(['add', 'delete'])('refreshes the session and clears private data when %s returns unauthorized', async operation => {
    const note = { id: 'note-1', body: 'Previously loaded private note', createdAt: '2026-10-06T00:00:00.000Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ notes: [note] })).mockResolvedValueOnce(new Response(null, { status: 401 })));
    sdk.session.data = userSession;
    account('/account');
    expect(await screen.findByText(note.body)).toBeInTheDocument();
    if (operation === 'add') {
      fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Another note' } });
      fireEvent.submit(screen.getByRole('button', { name: 'Add note' }).closest('form')!);
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    }
    expect(await screen.findByText(/Your session has ended/)).toBeInTheDocument();
    expect(screen.queryByText(note.body)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Note')).not.toBeInTheDocument();
    expect(sdk.session.refetch).toHaveBeenCalledTimes(1);
  });
});
