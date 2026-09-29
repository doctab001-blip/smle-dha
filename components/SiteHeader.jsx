import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SITE_NAME } from '@/lib/constants';

// Header for the public pages: shows "Dashboard" to signed-in visitors, "Sign in" otherwise.
export default async function SiteHeader() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">{SITE_NAME}</Link>
        <nav className="nav">
          <Link href="/smle">SMLE</Link>
          <Link href="/dha">DHA</Link>
        </nav>
        {user ? (
          <Link href="/dashboard" className="btn sm topbar-cta">Dashboard</Link>
        ) : (
          <Link href="/login" className="btn sm topbar-cta ghost-light">Sign in</Link>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      {SITE_NAME} is an independent study resource and is not affiliated with the Saudi Commission for Health
      Specialties (SCFHS), the Dubai Health Authority (DHA), DOH or MOHAP.
    </footer>
  );
}
