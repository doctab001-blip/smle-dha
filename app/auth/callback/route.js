import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Handles the email-confirmation / magic-link redirect from Supabase Auth.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  let next = searchParams.get('next') || '/dashboard';
  if (!next.startsWith('/')) next = '/dashboard';

  const supabase = await createClient();
  let error = null;
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = { message: 'Missing confirmation code' };
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('Confirmation link is invalid or has expired. Please sign in or request a new one.')}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
