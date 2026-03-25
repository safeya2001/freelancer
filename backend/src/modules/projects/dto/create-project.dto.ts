import {
  IsString, IsNumber, IsOptional, IsUUID, IsArray,
  IsInt, Min, Max, MinLength, MaxLength, IsPositive,
  IsDateString, IsIn,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const EmptyToUndefined = () => Transform(({ value }) => (value === '' || value === null) ? undefined : value);

export class CreateProjectDto {
  // ── Category: accept either a UUID (category_id) or a slug string (category)
  @IsOptional()
  @IsUUID()
  category_id?: string;

  /** Slug-based category (sent by the frontend form; resolved to UUID in service) */
  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title_en: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title_ar?: string;

  @IsString()
  @MinLength(30)
  @MaxLength(10000)
  description_en: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description_ar?: string;

  @IsOptional()
  @IsIn(['fixed', 'hourly'])
  budget_type?: 'fixed' | 'hourly';

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  budget_min?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  budget_max?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  hourly_rate_min?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  hourly_rate_max?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  // ── Location: accept either preferred_city or city (sent by frontend)
  @IsOptional()
  @IsString()
  preferred_city?: string;

  @IsOptional()
  @IsString()
  city?: string;

  // ── Experience level (frontend-only field; stored as metadata, no DB column)
  @IsOptional()
  @IsIn(['entry', 'intermediate', 'expert'])
  experience_level?: 'entry' | 'intermediate' | 'expert';

  // ── Duration (frontend-only field; stored as metadata, no DB column)
  @IsOptional()
  @IsString()
  duration?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachment_urls?: string[];

  // ── Skills: accept either UUIDs (skill_ids) or name strings (skills_required)
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  skill_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills_required?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description_en?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  budget_min?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  budget_max?: number;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsIn(['open', 'closed'])
  status?: 'open' | 'closed';
}

export class ProjectQueryDto {
  @IsOptional()
  @EmptyToUndefined()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsIn(['fixed', 'hourly'])
  budget_type?: string;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber()
  min_budget?: number;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber()
  max_budget?: number;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  city?: string;

  @IsOptional()
  @EmptyToUndefined()
  @IsString()
  search?: string;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
