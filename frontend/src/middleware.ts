import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard', '/admin'];
// Routes that authenticated users should not see
const AUTH_ROUTES = ['/auth/login', '/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The access_token cookie is written by js-cookie on the client after login.
  // It is a plain (non-httpOnly) cookie so the browser sends it with every
  // same-origin request, including the getServerSideProps fetch that Next.js
  // makes when navigating client-side.  This lets us gate hard page loads here.
  const token = request.cookies.get('access_token')?.value;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Unauthenticated user hitting a protected route → send to login
  if (isProtected && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting an auth route → send to dashboard
  if (isAuthRoute && token) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/auth/login',
    '/auth/register',
  ],
};
