import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID:     config.get('GOOGLE_CLIENT_ID')     || 'DISABLED',
      clientSecret: config.get('GOOGLE_CLIENT_SECRET') || 'DISABLED',
      callbackURL:  `${config.get('BACKEND_URL') || config.get('FRONTEND_URL') || 'http://localhost:3001'}/api/v1/auth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const { id, emails, displayName } = profile;
    done(null, {
      google_id: id,
      email: emails[0].value,
      full_name_en: displayName,
    });
  }
}
