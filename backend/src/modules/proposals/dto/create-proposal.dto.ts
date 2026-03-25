import {
  IsString, IsNumber, IsOptional, IsUUID, IsArray,
  IsInt, Min, Max, MinLength, MaxLength, IsPositive,
} from 'class-validator';

export class CreateProposalDto {
  @IsUUID()
  project_id: string;

  @IsString()
  @MinLength(50)
  @MaxLength(5000)
  cover_letter_en: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  cover_letter_ar?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  proposed_budget?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  proposed_hourly_rate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  estimated_hours?: number;

  @IsInt()
  @Min(1)
  @Max(365)
  delivery_days: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachment_urls?: string[];
}

export class RejectProposalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
