import { betterAuth } from 'better-auth';
import { PostgresDialect } from 'kysely';
import type { Pool } from 'pg';
import type { ServerConfig } from './config.js';
import type { Mailer } from './mail.js';

export function createAuth(config: ServerConfig, pool: Pool, mailer: Mailer) {
  return betterAuth({
    appName: config.appName, secret: config.secret, baseURL: config.authBaseURL, basePath: '/api/auth',
    database: { dialect: new PostgresDialect({ pool }), type: 'postgres', schemaName: 'auth' },
    trustedOrigins: [config.appOrigin],
    emailAndPassword: {
      enabled: true, requireEmailVerification: true, autoSignIn: false,
      minPasswordLength: 12, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      sendResetPassword: async ({ user, url }) => {
        mailer.enqueue({ to: user.email, subject: 'Reset your password', text: `Reset your password using this link:\n${url}\nThis link expires in 30 minutes.` });
      },
    },
    emailVerification: {
      sendOnSignUp: true, sendOnSignIn: false, autoSignInAfterVerification: false, expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        mailer.enqueue({ to: user.email, subject: 'Verify your email address', text: `Verify your email using this link:\n${url}\nThis link expires in one hour.` });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    advanced: {
      useSecureCookies: config.mode === 'production',
      // Only the loopback reverse proxy may provide this overwritten, single-address header.
      ipAddress: { ipAddressHeaders: ['x-real-ip'] },
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: config.mode === 'production' },
    },
    rateLimit: { enabled: true, storage: 'database', window: 10, max: 100 },
    logger: { disabled: true },
  });
}
