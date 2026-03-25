import {
  IsEmail, IsString, IsNotEmpty, MinLength, IsOptional,
  Matches, IsIn,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase and a number',
  })
  password: string;

  @IsIn(['client', 'freelancer'])
  @IsNotEmpty()
  role: 'client' | 'freelancer';

  @IsString()
  @IsNotEmpty()
  full_name_en: string;

  @IsOptional()
  @IsString()
  full_name_ar?: string;

  @IsOptional()
  @Matches(/^\+9627[789]\d{7}$/, { message: 'Must be a valid Jordanian phone number' })
  phone?: string;

  @IsOptional()
  @IsIn(['en', 'ar'])
  preferred_language?: 'en' | 'ar';
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class VerifyEmailDto {
  @IsString()
  token: string;
}

export class VerifyPhoneDto {
  @IsString()
  otp: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase and a number',
  })
  new_password: string;
}
