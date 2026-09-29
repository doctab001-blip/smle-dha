import { Suspense } from 'react';
import LoginForm from './LoginForm';
import SiteHeader from '@/components/SiteHeader';

export const metadata = { title: 'Sign in' };

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <div className="auth-wrap">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </>
  );
}
