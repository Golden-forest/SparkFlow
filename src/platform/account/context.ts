import { useOutletContext } from 'react-router-dom';
import type { AccountClient, AccountSession } from './client';

export interface AccountContext {
  apiURL: string;
  client: AccountClient;
  session: AccountSession | null;
  isPending: boolean;
  isRefetching: boolean;
  error: boolean;
  refetch: () => Promise<void>;
}

export function useAccount(): AccountContext {
  return useOutletContext<AccountContext>();
}
