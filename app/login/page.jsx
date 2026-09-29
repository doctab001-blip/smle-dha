import { Suspense } from 'react';
import Link from 'next/link';
import LoginForm from './LoginForm';
import { SITE_NAME } from '@/lib/constants';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand">{SITE_NAME}</Link>
        </div>
      </header>
      <div className="auth-wrap">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </>
  );
}
