import {
  IsNumber, IsString, IsIn, IsOptional, Min, Max, Matches,
} from 'class-validator';

export class WithdrawalRequestDto {
  @IsNumber()
  @Min(20)
  @Max(50_000)
  amount: number;

  /** Supported withdrawal methods: bank transfer or CliQ */
  @IsIn(['bank_transfer', 'cliq'])
  method: string;

  // ── Bank transfer fields ──────────────────────────────────────
  @IsOptional()
  @IsString()
  bank_name?: string;

  @IsOptional()
  @IsString()
  bank_account?: string;

  /** Jordanian IBAN: JO + 2 check digits + 4-char bank code + 22 digits */
  @IsOptional()
  @Matches(/^JO\d{2}[A-Z]{4}\d{22}$/, { message: 'Invalid Jordanian IBAN format' })
  bank_iban?: string;

  // ── CliQ alias ────────────────────────────────────────────────
  /** CliQ registered alias (phone number or name alias) */
  @IsOptional()
  @IsString()
  cliq_alias?: string;
}
