import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AccountCard, AccountField, AccountLink, AccountNotice, accountButtonClass } from './AccountUI';
import { NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, accountCallback, passwordProblem } from './config';
import { checkAccountResult } from './client';
import { useAccount } from './context';
import { useAccountAction } from './useAccountAction';

export function SignInPage() {
  const { client, session, refetch } = useAccount();
  const navigate = useNavigate();
  const action = useAccountAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = await action.run(async signal => {
      checkAccountResult(await client.signIn.email({ email: email.trim(), password }, { signal }));
      // The SDK's automatic session notification is delayed. Wait for the
      // server-backed session before navigating into the protected route.
      await refetch();
    }, 'Unable to sign in. Check your details and confirm your email, then try again.');
    if (success) navigate('/account', { replace: true });
  };

  if (session) return <Navigate to="/account" replace />;
  return <AccountCard title="Sign in" description="Sign in to manage your profile and private notes.">
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    <form onSubmit={submit} className="space-y-5" aria-busy={action.pending}>
      <AccountField label="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={action.pending} />
      <AccountField label="Password" type="password" autoComplete="current-password" required maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={event => setPassword(event.target.value)} disabled={action.pending} />
      <button type="submit" disabled={action.pending} className={`${accountButtonClass} w-full`}>{action.pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <div className="mt-6 flex flex-wrap justify-between gap-3">
      <AccountLink to="/account/sign-up">Create an account</AccountLink>
      <AccountLink to="/account/forgot-password">Forgot password?</AccountLink>
    </div>
    <div className="mt-4"><AccountLink to="/account/verify-email">Resend confirmation email</AccountLink></div>
  </AccountCard>;
}

export function SignUpPage() {
  const { client, session } = useAccount();
  const action = useAccountAction();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const problem = passwordProblem(password, confirmation);
    if (problem || !name.trim() || name.trim().length > NAME_MAX_LENGTH) {
      action.setError(problem ?? 'Enter a name between 1 and 80 characters.');
      return;
    }
    const success = await action.run(async signal => {
      checkAccountResult(await client.signUp.email({ name: name.trim(), email: email.trim(), password, callbackURL: accountCallback('verify-email') }, { signal }));
    }, 'Unable to complete this request. Check your details and try again.');
    if (success) {
      setPassword('');
      setConfirmation('');
      setSent(true);
    }
  };

  if (session) return <Navigate to="/account" replace />;
  if (sent) return <AccountCard title="Check your email" description="If this address can be registered, you will receive a confirmation link. Open it before signing in. Check your spam folder too.">
    <div className="flex flex-wrap gap-5"><AccountLink to="/account/sign-in">Sign in</AccountLink><AccountLink to="/account/verify-email">Resend confirmation email</AccountLink></div>
  </AccountCard>;
  return <AccountCard title="Create an account" description="Confirm your email to activate your account.">
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    <form onSubmit={submit} className="space-y-5" aria-busy={action.pending}>
      <AccountField label="Name" autoComplete="name" required maxLength={NAME_MAX_LENGTH} value={name} onChange={event => setName(event.target.value)} disabled={action.pending} />
      <AccountField label="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={action.pending} />
      <AccountField label="Password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} hint="Use 12–128 characters. A unique passphrase works well." value={password} onChange={event => setPassword(event.target.value)} disabled={action.pending} />
      <AccountField label="Confirm password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={action.pending} />
      <button type="submit" disabled={action.pending} className={`${accountButtonClass} w-full`}>{action.pending ? 'Creating account…' : 'Create account'}</button>
    </form>
    <div className="mt-6"><AccountLink to="/account/sign-in">Already have an account? Sign in</AccountLink></div>
  </AccountCard>;
}

export function ForgotPasswordPage() {
  const { client } = useAccount();
  const action = useAccountAction();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = await action.run(async signal => {
      checkAccountResult(await client.requestPasswordReset({ email: email.trim(), redirectTo: accountCallback('reset-password') }, { signal }));
    }, 'Unable to send this request. Please try again later.');
    if (success) setSent(true);
  };

  return <AccountCard title={sent ? 'Check your email' : 'Reset your password'} description={sent ? 'If an account exists for this address, you will receive a password reset link. Check your spam folder too.' : 'Enter your email to request a password reset link.'}>
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    {!sent ? <form onSubmit={submit} className="space-y-5" aria-busy={action.pending}>
      <AccountField label="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={action.pending} />
      <button type="submit" disabled={action.pending} className={`${accountButtonClass} w-full`}>{action.pending ? 'Sending…' : 'Send reset link'}</button>
    </form> : null}
    <div className="mt-6"><AccountLink to="/account/sign-in">Back to sign in</AccountLink></div>
  </AccountCard>;
}

export function ResetPasswordPage() {
  const { client } = useAccount();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const action = useAccountAction();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [complete, setComplete] = useState(false);
  const token = search.get('token');
  const invalidLink = !token || token.length > 4096 || search.has('error');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (invalidLink) return;
    const problem = passwordProblem(password, confirmation);
    if (problem) {
      action.setError(problem);
      return;
    }
    const success = await action.run(async signal => {
      checkAccountResult(await client.resetPassword({ newPassword: password, token }, { signal }));
    }, 'Unable to reset your password. Request a new link and try again.');
    if (success) {
      setPassword('');
      setConfirmation('');
      setComplete(true);
      // Remove the one-time secret from the address and browser history entry.
      navigate('/account/reset-password', { replace: true });
    }
  };

  if (complete) return <AccountCard title="Password updated" description="Your password has been changed. Sign in with your new password."><AccountLink to="/account/sign-in">Sign in</AccountLink></AccountCard>;
  if (invalidLink) return <AccountCard title="Reset link unavailable" description="This reset link is incomplete, invalid, or expired."><AccountLink to="/account/forgot-password">Request a new reset link</AccountLink></AccountCard>;
  return <AccountCard title="Choose a new password" description="Use a unique password you do not use on other sites.">
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    <form onSubmit={submit} className="space-y-5" aria-busy={action.pending}>
      <AccountField label="New password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} hint="Use 12–128 characters." value={password} onChange={event => setPassword(event.target.value)} disabled={action.pending} />
      <AccountField label="Confirm password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={action.pending} />
      <button type="submit" disabled={action.pending} className={`${accountButtonClass} w-full`}>{action.pending ? 'Updating…' : 'Reset password'}</button>
    </form>
  </AccountCard>;
}

export function VerifyEmailPage() {
  const { client } = useAccount();
  const [search] = useSearchParams();
  const action = useAccountAction();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const success = await action.run(async signal => {
      checkAccountResult(await client.sendVerificationEmail({ email: email.trim(), callbackURL: accountCallback('verify-email') }, { signal }));
    }, 'Unable to send this request. Please try again later.');
    if (success) setSent(true);
  };

  return <AccountCard title="Email confirmation" description="Open the confirmation link in your email, then sign in. If you already opened a valid link, you can continue to sign in below.">
    {search.has('error') ? <AccountNotice error>This confirmation link is invalid or expired. Request a new email below.</AccountNotice> : null}
    {action.error ? <AccountNotice error>{action.error}</AccountNotice> : null}
    {sent ? <AccountNotice>If this address needs confirmation, a new link will be sent. Check your inbox and spam folder.</AccountNotice> : <form onSubmit={submit} className="space-y-5" aria-busy={action.pending}>
      <AccountField label="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} disabled={action.pending} />
      <button type="submit" disabled={action.pending} className={`${accountButtonClass} w-full`}>{action.pending ? 'Sending…' : 'Resend confirmation email'}</button>
    </form>}
    <div className="mt-6"><AccountLink to="/account/sign-in">Sign in</AccountLink></div>
  </AccountCard>;
}
