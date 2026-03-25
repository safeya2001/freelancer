import {
  IsString, IsNumber, IsOptional, IsUUID, IsArray,
  IsInt, Min, Max, MinLength, MaxLength, IsPositive,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/** Converts empty strings to undefined so @IsOptional() skips them cleanly. */
const EmptyToUndefined = () => Transform(({ value }) => (value === '' || value === null) ? undefined : value);

export class CreateGigPackageDto {
  @IsString()
  package_type: 'basic' | 'standard' | 'premium';

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name_en: string;

  @IsOptional()
  @IsString()
  name_ar?: string;

  @IsOptional()
  @IsString()
  description_en?: string;

  @IsOptional()
  @IsString()
  description_ar?: string;

  @IsNumber()
  @IsPositive()
  price: number;

  @IsInt()
  @Min(1)
  @Max(365)
  delivery_days: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  revisions?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];
}

export class CreateGigDto {
  @IsUUID()
  category_id: string;

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
  @MaxLength(5000)
  description_en: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description_ar?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsInt()
  @Min(1)
  @Max(365)
  delivery_days: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery_urls?: string[];

  @IsOptional()
  @IsString()
  requirements_en?: string;

  @IsOptional()
  @IsString()
  requirements_ar?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  skill_ids?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => CreateGigPackageDto)
  packages?: CreateGigPackageDto[];
}

export class UpdateGigDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200)
  title_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title_ar?: string;

  @IsOptional()
  @IsString()
  @MinLength(30)
  @MaxLength(5000)
  description_en?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description_ar?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  delivery_days?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gallery_urls?: string[];

  @IsOptional()
  @IsString()
  requirements_en?: string;

  @IsOptional()
  @IsString()
  status?: 'active' | 'paused';
}

export class GigQueryDto {
  @IsOptional()
  @EmptyToUndefined()
  @IsUUID()
  category_id?: string;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber()
  min_price?: number;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber()
  max_price?: number;

  @IsOptional()
  @EmptyToUndefined()
  @Type(() => Number)
  @IsNumber()
  min_rating?: number;

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
