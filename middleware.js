import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Signed-in area. Everything else (/, /smle, /dha, /login, /auth/*) is public.
const PROTECTED = ['/dashboard', '/qbank', '/mock', '/revision', '/notes', '/flagged', '/session'];
const EXAMS = ['smle', 'dha'];

const isProtected = (path) => PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname, searchParams } = request.nextUrl;

  // Not signed in → protected pages go to /login (remembering where they were headed).
  if (!user && isProtected(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Already signed in and clicked "Start practising" on /login?exam=… → straight to the
  // dashboard, carrying the exam so it becomes their active context.
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    const exam = searchParams.get('exam');
    url.pathname = '/dashboard';
    url.search = '';
    if (EXAMS.includes(exam)) url.searchParams.set('exam', exam);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
