import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const SKIP_CSRF_KEY = 'skip_csrf';

/**
 * CSRF protection using the Double-Submit Cookie pattern.
 *
 * Flow:
 * 1. Client fetches GET /auth/csrf-token → receives token in response body AND
 *    as a `csrf-token` cookie (SameSite=strict, httpOnly=false so JS can read it).
 * 2. Client stores the token and sends it as `X-CSRF-Token` header on
 *    every POST / PUT / PATCH / DELETE request.
 * 3. This guard compares the header value to the cookie value.
 *    If they don't match, the request is rejected with 403.
 *
 * Bearer-token-only endpoints are still safe without CSRF tokens because
 * browsers cannot automatically attach Authorization headers cross-site.
 * This guard adds an extra layer for cookie-authenticated flows (e.g. OAuth).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly stateMutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Allow skipping CSRF via @SkipCsrf() decorator
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<Request>();

    // Only validate state-mutating methods
    if (!this.stateMutatingMethods.has(req.method)) return true;

    // Bearer-token requests are inherently CSRF-safe: browsers cannot
    // automatically set the Authorization header cross-site (blocked by CORS).
    // Enforcing double-submit cookie on top of a valid Bearer token is redundant
    // and breaks non-browser API clients.
    const authHeader = req.headers.authorization as string | undefined;
    if (authHeader?.startsWith('Bearer ')) return true;

    // httpOnly access_token cookie (set by the login endpoint) is also CSRF-safe
    // because it is SameSite=strict — the browser will never include it in a
    // cross-site request. JwtStrategy accepts this cookie as a valid credential,
    // so it must be treated the same as a Bearer header here.
    // Without this bypass, requests sent after the 15-min js-cookie expires (but
    // while the httpOnly cookie is still valid) would get a 403 instead of a 401,
    // preventing the Axios refresh-token interceptor from ever running.
    const httpOnlyToken = req.cookies?.['access_token'] as string | undefined;
    if (httpOnlyToken) return true;

    // For pure cookie-authenticated flows (e.g. Google OAuth redirect) that carry
    // neither a Bearer header nor the httpOnly access_token, enforce the
    // Double-Submit Cookie pattern.
    const tokenFromHeader = req.headers['x-csrf-token'] as string | undefined;
    const tokenFromCookie = req.cookies?.['csrf-token'] as string | undefined;

    if (!tokenFromHeader || !tokenFromCookie) {
      this.logger.warn(`CSRF token missing on ${req.method} ${req.path}`);
      throw new ForbiddenException('CSRF token missing');
    }

    if (tokenFromHeader !== tokenFromCookie) {
      this.logger.warn(`CSRF token mismatch on ${req.method} ${req.path}`);
      throw new ForbiddenException('CSRF token invalid');
    }

    return true;
  }
}
