import { IsString, IsOptional, IsIn } from 'class-validator';

// Only CliQ is supported for manual (local) deposits.
// Stripe is handled separately via /payments/checkout/*.
const LOCAL_METHODS = ['cliq'] as const;

export class InitiateLocalPaymentDto {
  @IsOptional()
  @IsString()
  order_id?: string;

  @IsOptional()
  @IsString()
  milestone_id?: string;

  @IsIn(LOCAL_METHODS)
  payment_method: typeof LOCAL_METHODS[number];

  /** Reference number from the user's CliQ transfer receipt */
  @IsOptional()
  @IsString()
  user_reference?: string;

  /** URL of the uploaded payment screenshot */
  @IsOptional()
  @IsString()
  proof_image_url?: string;
}
