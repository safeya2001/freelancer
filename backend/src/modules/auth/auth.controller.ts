import {
  Controller, Post, Get, Body, Param, UseGuards,
  Req, Res, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import {
  RegisterDto, LoginDto, VerifyEmailDto, VerifyPhoneDto,
  ForgotPasswordDto, ResetPasswordDto,
} from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Issues a CSRF token as both a cookie (SameSite=strict) and response body.
   * The frontend must read the body value and send it as X-CSRF-Token on
   * all POST / PUT / PATCH / DELETE requests.
   */
  @Get('csrf-token')
  @SkipCsrf()
  getCsrfToken(@Req() req: any, @Res({ passthrough: true }) res: any) {
    // Reuse existing cookie if valid; issue a new one otherwise
    let token: string = req.cookies?.['csrf-token'];
    if (!token || token.length < 32) {
      token = randomBytes(32).toString('hex');
    }
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('csrf-token', token, {
      httpOnly: false,      // must be readable by JS so it can be put in the header
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });
    return { csrf_token: token };
  }

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @SkipCsrf()
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @SkipCsrf()
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.login(dto);
    const isProduction = process.env.NODE_ENV === 'production';
    // Set httpOnly cookies (checklist: HttpOnly + Secure + SameSite=strict)
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 min
    });
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    // Also return tokens in body so non-browser clients and the frontend
    // interceptor (Authorization header fallback) continue to work
    return result;
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @SkipCsrf()
  googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @SkipCsrf()
  async googleCallback(@Req() req: any, @Res() res: any) {
    const tokens = await this.authService.googleLogin(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Set tokens as httpOnly cookies instead of URL params to avoid token leakage
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.redirect(`${frontendUrl}/auth/callback?status=success`);
  }

  @Get('verify-email/:token')
  @SkipCsrf()
  verifyEmail(@Param() { token }: VerifyEmailDto) {
    return this.authService.verifyEmail(token);
  }

  @Post('send-phone-otp')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  sendOtp(@CurrentUser() user: any) {
    return this.authService.sendPhoneOtp(user.id);
  }

  @Post('verify-phone')
  @UseGuards(JwtAuthGuard)
  verifyPhone(@CurrentUser() user: any, @Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(user.id, dto.otp);
  }

  @Post('forgot-password')
  @UseGuards(ThrottlerGuard)
  @SkipCsrf()
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @SkipCsrf()
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @SkipCsrf()
  async refresh(
    @Body('refresh_token') bodyToken: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    // Accept refresh_token from request body (existing clients) OR httpOnly cookie
    const token = bodyToken || req.cookies?.['refresh_token'];
    const result = await this.authService.refreshToken(token);
    const isProduction = process.env.NODE_ENV === 'production';
    // Rotate cookies
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie('refresh_token', result.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return result;
  }

  @Post('logout')
  @SkipCsrf()
  logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', { httpOnly: true, secure: isProduction, sameSite: 'strict' });
    res.clearCookie('refresh_token', { httpOnly: true, secure: isProduction, sameSite: 'strict' });

    // Best-effort: revoke refresh token from DB if user identity is known
    const userId: string | undefined = (req as any).user?.id;
    if (userId) {
      this.authService.revokeAllRefreshTokens(userId).catch(() => {});
    }

    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: any) {
    return user;
  }
}
