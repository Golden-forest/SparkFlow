import { Route, Routes } from 'react-router-dom';
import { AccountCard, AccountLink } from './AccountUI';
import { AccountDashboard } from './AccountDashboard';
import { ForgotPasswordPage, ResetPasswordPage, SignInPage, SignUpPage, VerifyEmailPage } from './AccountForms';
import { accountConfig, type AccountConfig } from './config';
import { AccountSessionLayout, RequireAccount } from './AccountSessionLayout';

function AccountShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#0D1117] text-slate-100">
    <meta name="referrer" content="no-referrer" />
    <header className="border-b border-[#30363D] px-5 py-5 sm:px-8"><AccountLink to="/">Back to home</AccountLink></header>
    <main className="px-4 py-10 sm:px-8 sm:py-14">{children}</main>
  </div>;
}

/** Mount as <Route path="/account/*" element={<AccountRoutes />} />. */
export default function AccountRoutes({ config = accountConfig }: { config?: AccountConfig }) {
  return <AccountShell><Routes>
    <Route element={<AccountSessionLayout config={config} />}>
      <Route path="sign-in" element={<SignInPage />} />
      <Route path="sign-up" element={<SignUpPage />} />
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="verify-email" element={<VerifyEmailPage />} />
      <Route element={<RequireAccount />}><Route index element={<AccountDashboard />} /></Route>
      <Route path="*" element={<AccountCard title="Page not found"><AccountLink to="/account">Go to your account</AccountLink></AccountCard>} />
    </Route>
  </Routes></AccountShell>;
}
