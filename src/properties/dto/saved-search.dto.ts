import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { InputType, Field, ID, Int } from '@nestjs/graphql';
import { SearchResultItem } from './search.dto';

@InputType()
export class CreateSavedSearchDto {
  @Field()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Object)
  @IsObject()
  criteria: Record<string, unknown>;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean = true;
}

@InputType()
export class UpdateSavedSearchDto {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  name?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Object, { nullable: true })
  @IsOptional()
  @IsObject()
  criteria?: Record<string, unknown>;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean;
}

@InputType()
export class SavedSearchResponse {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Object)
  criteria: Record<string, unknown>;

  @Field()
  isActive: boolean;

  @Field()
  alertEnabled: boolean;

  @Field({ nullable: true })
  lastRunAt?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Int, { nullable: true })
  matchCount?: number;

  @Field(() => [SearchAlertItem], { nullable: true })
  recentAlerts?: SearchAlertItem[];
}

@InputType()
export class SearchAlertItem {
  @Field(() => ID)
  id: string;

  @Field()
  propertyId: string;

  @Field()
  notified: boolean;

  @Field({ nullable: true })
  notifiedAt?: string;

  @Field()
  createdAt: Date;
}

@InputType()
export class RunSavedSearchResult {
  @Field(() => ID)
  savedSearchId: string;

  @Field(() => Int)
  newMatches: number;

  @Field(() => [SearchResultItem])
  properties: Array<{
    id: string;
    title: string;
    description?: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    price: number;
    propertyType: string;
    bedrooms?: number;
    bathrooms?: number;
    squareFeet?: number;
    lotSize?: number;
    yearBuilt?: number;
    features?: string[];
    location?: [number, number];
    status: string;
    createdAt: Date;
    owner?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;

  @Field()
  totalMatches: number;

  @Field()
  hasMore: boolean;

  @Field()
  nextCursor?: string;
}

@InputType()
export class ManageSavedSearchRequest {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  savedSearchId?: string;

  @Field()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;

  @Field(() => Object)
  @IsObject()
  criteria: Record<string, unknown>;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  alertEnabled?: boolean = true;

  @Field({ nullable: true, defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}
