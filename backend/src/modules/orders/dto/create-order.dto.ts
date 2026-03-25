import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateOrderDto {
  @IsUUID()
  gig_id: string;

  @IsOptional()
  @IsUUID()
  package_id?: string;

  @IsOptional()
  @IsString()
  requirements?: string;
}

export class DeliverOrderDto {
  @IsOptional()
  @IsString()
  delivery_note?: string;

  @IsOptional()
  @IsString({ each: true })
  delivery_urls?: string[];
}

export class RevisionOrderDto {
  @IsString()
  note: string;
}

export class CancelOrderDto {
  @IsString()
  reason: string;
}
