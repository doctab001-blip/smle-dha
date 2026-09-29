import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SITE_NAME } from '@/lib/constants';
import NavLinks from '@/components/NavLinks';

export default async function AppLayout({ children }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/dashboard" className="brand">{SITE_NAME}</Link>
          <NavLinks />
          <form action="/auth/signout" method="post">
            <button className="signout" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      {children}
    </>
  );
}
