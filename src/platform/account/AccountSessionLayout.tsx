import { Navigate, Outlet } from 'react-router-dom';
import { AccountCard, AccountLink, AccountNotice, accountButtonClass } from './AccountUI';
import { accountConfig, type AccountConfig } from './config';
import { getAccountClient, type AccountClient } from './client';
import { useAccount, type AccountContext } from './context';

function SessionOutlet({ client, apiURL }: { client: AccountClient; apiURL: string }) {
  const { data, isPending, isRefetching, error, refetch } = client.useSession();
  const context: AccountContext = { client, apiURL, session: data, isPending, isRefetching, error: !!error, refetch };
  return <Outlet context={context} />;
}

/** Provide real account sessions to nested routes, without imposing a page shell. */
export function AccountSessionLayout({ config = accountConfig }: { config?: AccountConfig }) {
  if (config.status !== 'ready') return <AccountCard title={config.status === 'disabled' ? 'Accounts are not configured' : 'Account unavailable'}>
    <AccountNotice>{config.status === 'disabled' ? 'Account services have not been connected for this installation. Please contact the site owner.' : 'Account services are not configured correctly. Please contact the site owner.'}</AccountNotice>
    <AccountLink to="/">Back to home</AccountLink>
  </AccountCard>;
  return <SessionOutlet client={getAccountClient(config.apiURL)} apiURL={config.apiURL} />;
}

/** Nest below AccountSessionLayout to protect any application route. */
export function RequireAccount() {
  const context = useAccount();
  if (context.isPending || (!context.session && context.isRefetching)) {
    return <AccountCard title="Loading your account"><p role="status" className="text-sm text-slate-400">Checking your session…</p></AccountCard>;
  }
  if (context.error) return <AccountCard title="Account unavailable" description="Unable to check your session. Please try again.">
    <button type="button" onClick={() => void context.refetch()} className={accountButtonClass}>Try again</button>
  </AccountCard>;
  if (!context.session) return <Navigate to="/account/sign-in" replace />;
  if (!context.session.user.emailVerified) return <Navigate to="/account/verify-email" replace />;
  return <Outlet context={context} />;
}
