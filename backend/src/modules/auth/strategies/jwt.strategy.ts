import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DB } from '../../../database/database.module';
import postgres from 'postgres';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private config: ConfigService,
    @Inject(DB) private sql: postgres.Sql,
  ) {
    super({
      // Accept JWT from Authorization: Bearer header OR from httpOnly cookie
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => req?.cookies?.['access_token'] ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: false,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    const [user] = await this.sql`
      SELECT id, email, role, status, phone_verified, email_verified, phone
      FROM users WHERE id = ${payload.sub}
    `;
    if (!user || user.status === 'banned' || user.status === 'suspended') {
      throw new UnauthorizedException('Account is inactive');
    }
    const isDev = this.config.get<string>('NODE_ENV', 'development') !== 'production';
    return {
      id:             user.id,
      email:          user.email,
      role:           user.role,
      phone:          user.phone,
      phone_verified: isDev ? true : user.phone_verified,
      email_verified: isDev ? true : user.email_verified,
    };
  }
}
