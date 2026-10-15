import { useEffect, useId, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { RequestError } from '@/platform/request';
import { AccountField, AccountLink, AccountNotice, accountButtonClass, accountInputClass } from './AccountUI';
import { checkAccountResult, type AccountSession } from './client';
import { NAME_MAX_LENGTH, NOTE_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordProblem } from './config';
import { useAccount } from './context';
import { addNote, deleteNote, listNotes, type AccountNote } from './notes';
import { useAccountAction } from './useAccountAction';

function ProfileForm({ user }: { user: AccountSession['user'] }) {
  const { client } = useAccount();
  const action = useAccountAction();
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || name.trim().length > NAME_MAX_LENGTH) {
      action.setError('Enter a name between 1 and 80 characters.');
      return;
    }
    setSaved(false);
    const success = await action.run(async signal => {
      checkAccountResult(await client.updateUser({ name: name.trim() }, { signal }));
    }, 'Unable to save your profile. Please try again.');
    if (success) setSaved(true);
  };

  return <section className="rounded-2xl border border-[#30363D] bg-[#111827] p-6 sm:p-8" aria-labelledby="profile-title">
    <h2 id="profile-title" className="mb-6 text-xl font-semibold text-slate-100">Profile</h2>
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    {saved ? <AccountNotice>Profile saved.</AccountNotice> : null}
    <form onSubmit={submit} className="space-y-5" aria-busy={action.pending}>
      <AccountField label="Name" autoComplete="name" required maxLength={NAME_MAX_LENGTH} value={name} onChange={event => { setName(event.target.value); setSaved(false); }} disabled={action.pending} />
      <AccountField label="Email" type="email" value={user.email} readOnly hint="Your confirmed email identifies this account." />
      <button type="submit" disabled={action.pending} className={accountButtonClass}>{action.pending ? 'Saving…' : 'Save profile'}</button>
    </form>
  </section>;
}

function PrivateNotes() {
  const { apiURL, refetch } = useAccount();
  const action = useAccountAction();
  const [notes, setNotes] = useState<AccountNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [revision, setRevision] = useState(0);
  const [body, setBody] = useState('');
  const noteInput = useId();

  useEffect(() => {
    const controller = new AbortController();
    listNotes(apiURL, controller.signal).then(result => {
      if (!controller.signal.aborted) setNotes(result);
    }).catch(failure => {
      if (controller.signal.aborted) return;
      if (failure instanceof RequestError && failure.status === 401) {
        setNotes([]);
        setExpired(true);
        void refetch().catch(() => undefined);
      }
      setLoadError('Unable to load your notes. Please try again.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [apiURL, refetch, revision]);

  const retry = () => {
    setLoading(true);
    setLoadError(null);
    setExpired(false);
    setRevision(value => value + 1);
  };

  const expireIfUnauthorized = (failure: unknown) => {
    if (failure instanceof RequestError && failure.status === 401) {
      setNotes([]);
      setExpired(true);
      void refetch().catch(() => undefined);
    }
    throw failure;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim() || body.trim().length > NOTE_MAX_LENGTH) {
      action.setError('Enter a note between 1 and 2000 characters.');
      return;
    }
    let created: AccountNote | undefined;
    const success = await action.run(async signal => {
      try { created = await addNote(apiURL, body, signal); }
      catch (failure) { if (!signal.aborted) expireIfUnauthorized(failure); else throw failure; }
    }, 'Unable to save your note. Please try again.');
    if (success && created) {
      const note = created;
      setNotes(current => [note, ...current]);
      setBody('');
    }
  };

  const remove = async (id: string) => {
    const success = await action.run(async signal => {
      try { await deleteNote(apiURL, id, signal); }
      catch (failure) { if (!signal.aborted) expireIfUnauthorized(failure); else throw failure; }
    }, 'Unable to delete this note. Please refresh and try again.');
    if (success) setNotes(current => current.filter(note => note.id !== id));
  };

  return <section className="rounded-2xl border border-[#30363D] bg-[#111827] p-6 sm:p-8" aria-labelledby="notes-title">
    <h2 id="notes-title" className="mb-2 text-xl font-semibold text-slate-100">Private notes</h2>
    <p className="mb-6 text-sm leading-relaxed text-slate-400">Notes are saved to your account and available after signing in on another device.</p>
    {expired ? <AccountNotice error>Your session has ended. <AccountLink to="/account/sign-in">Sign in again</AccountLink></AccountNotice> : null}
    {!expired && loadError ? <AccountNotice error>{loadError} <button type="button" className="ml-2 underline" onClick={retry}>Try again</button></AccountNotice> : null}
    {action.error && !expired ? <AccountNotice error>{action.error}</AccountNotice> : null}
    {!expired ? <>
      <form onSubmit={submit} className="mb-6 space-y-4" aria-busy={action.pending}>
        <div>
          <label htmlFor={noteInput} className="mb-2 block text-sm font-medium text-slate-300">Note</label>
          <textarea id={noteInput} className={`${accountInputClass} min-h-28 resize-y`} rows={4} required maxLength={NOTE_MAX_LENGTH} value={body} onChange={event => setBody(event.target.value)} disabled={loading || !!loadError || action.pending} aria-describedby={`${noteInput}-hint`} />
          <p id={`${noteInput}-hint`} className="mt-2 text-xs text-slate-400">{body.length} / 2000 characters</p>
        </div>
        <button type="submit" disabled={loading || !!loadError || action.pending} className={accountButtonClass}>{action.pending ? 'Saving…' : 'Add note'}</button>
      </form>
      {loading ? <p role="status" className="text-sm text-slate-400">Loading notes…</p> : null}
      {!loading && !loadError && notes.length === 0 ? <p className="text-sm text-slate-400">No notes yet.</p> : null}
      {!loading && !loadError ? <ul className="space-y-4" aria-label="Your notes">
        {notes.map(note => <li key={note.id} className="rounded-lg border border-slate-700 bg-[#0D1117] p-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{note.body}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <time dateTime={note.createdAt} className="text-xs text-slate-500">{new Date(note.createdAt).toLocaleString()}</time>
            <button type="button" onClick={() => void remove(note.id)} disabled={action.pending} className="rounded-md px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-red-300 disabled:opacity-50">Delete note</button>
          </div>
        </li>)}
      </ul> : null}
    </> : null}
  </section>;
}

function AccountSecurity() {
  const { client, refetch } = useAccount();
  const action = useAccountAction();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = passwordProblem(newPassword, confirmation);
    if (problem) {
      action.setError(problem);
      return;
    }
    setMessage(null);
    const success = await action.run(async signal => {
      checkAccountResult(await client.changePassword({ currentPassword, newPassword, revokeOtherSessions: true }, { signal }));
      await refetch();
    }, 'Unable to change your password. Check your current password and try again.');
    if (success) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setMessage('Password updated. Other devices have been signed out.');
    }
  };

  const revokeOthers = async () => {
    setMessage(null);
    const success = await action.run(async signal => {
      checkAccountResult(await client.revokeOtherSessions({}, { signal }));
    }, 'Unable to sign out other devices. Please try again.');
    if (success) setMessage('Other devices have been signed out.');
  };

  return <section className="rounded-2xl border border-[#30363D] bg-[#111827] p-6 sm:p-8" aria-labelledby="security-title">
    <h2 id="security-title" className="mb-2 text-xl font-semibold text-slate-100">Account security</h2>
    <p className="mb-6 text-sm leading-relaxed text-slate-400">Changing your password also signs out your other devices.</p>
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    {message ? <AccountNotice>{message}</AccountNotice> : null}
    <form onSubmit={submit} className="space-y-5" aria-busy={action.pending}>
      <AccountField label="Current password" type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX_LENGTH} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={action.pending} />
      <AccountField label="New password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} hint="Use 12–128 characters." value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={action.pending} />
      <AccountField label="Confirm new password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={action.pending} />
      <button type="submit" disabled={action.pending} className={accountButtonClass}>Change password</button>
    </form>
    <div className="mt-7 border-t border-slate-700 pt-6">
      <button type="button" onClick={() => void revokeOthers()} disabled={action.pending} className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50">Sign out other devices</button>
      <p className="mt-3 text-xs text-slate-400">You will stay signed in on this device.</p>
    </div>
  </section>;
}

export function AccountDashboard() {
  const { client, session, refetch } = useAccount();
  const navigate = useNavigate();
  const action = useAccountAction();
  if (!session) return null;

  const signOut = async () => {
    const success = await action.run(async signal => {
      checkAccountResult(await client.signOut({}, { signal }));
      await refetch();
    }, 'Unable to sign out. Please try again.');
    if (success) navigate('/account/sign-in', { replace: true });
  };

  return <div className="mx-auto w-full max-w-3xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl font-semibold text-slate-100">Your account</h1>
      <button type="button" onClick={() => void signOut()} disabled={action.pending} className="rounded-lg border border-slate-600 px-5 py-2.5 text-sm text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-cyan-300 disabled:opacity-50">{action.pending ? 'Signing out…' : 'Sign out'}</button>
    </div>
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    <ProfileForm key={`profile-${session.user.id}`} user={session.user} />
    <AccountSecurity key={`security-${session.user.id}`} />
    <PrivateNotes key={`notes-${session.user.id}`} />
  </div>;
}
