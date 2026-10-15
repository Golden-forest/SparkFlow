import { createAuthClient } from 'better-auth/react';

export type AccountClient = ReturnType<typeof createAuthClient>;
export type AccountSession = NonNullable<ReturnType<AccountClient['useSession']>['data']>;

let cachedClient: { apiURL: string; client: AccountClient } | undefined;

/** Cookie sessions are managed by the browser and server, never localStorage. */
export function getAccountClient(apiURL: string): AccountClient {
  if (cachedClient?.apiURL === apiURL) return cachedClient.client;
  const client = createAuthClient({
    baseURL: apiURL,
    basePath: '/api/auth',
    fetchOptions: { credentials: 'include', timeout: 15_000 },
    sessionOptions: { refetchOnWindowFocus: true, refetchWhenOffline: false },
  });
  cachedClient = { apiURL, client };
  return client;
}

export class AccountActionError extends Error {
  readonly status?: number;

  constructor(status?: number) {
    super('Account request failed.');
    this.status = status;
  }
}

export function checkAccountResult(result: { error: { status?: number } | null }): void {
  if (result.error) throw new AccountActionError(result.error.status);
}
