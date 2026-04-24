import { IsOptional, IsNumber, IsString, IsBoolean, IsArray, IsIn, Min, Max } from 'class-validator';
import { InputType, Field, Float, ID, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateIf } from 'class-validator';

// Sort fields and directions
export const PROPERTY_SORT_FIELDS = [
  'price',
  'createdAt',
  'squareFeet',
  'bedrooms',
  'bathrooms',
  'yearBuilt',
] as const;

export const SORT_DIRECTION = ['asc', 'desc'] as const;

export type PropertySortField = (typeof PROPERTY_SORT_FIELDS)[number];
export type SortDirection = (typeof SORT_DIRECTION)[number];

@InputType()
export class PropertySearchFilters {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  query?: string; // Full-text search across title, description, address, city

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cities?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  states?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  propertyTypes?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  minBedrooms?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  maxBedrooms?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  minBathrooms?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  maxBathrooms?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  minSquareFeet?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  maxSquareFeet?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  minLotSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  maxLotSize?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  minYearBuilt?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  maxYearBuilt?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => [Float], { nullable: true })
  @IsOptional()
  @IsArray()
  geoLocation?: [number, number]; // [longitude, latitude]

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  radius?: number; // Radius in kilometers for geo search

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hasPhotos?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;
}

@InputType()
export class CursorPaginationInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  cursor?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

@InputType()
export class SearchSortOptions {
  @Field(() => PropertySortField, { nullable: true })
  @IsOptional()
  field?: PropertySortField;

  @Field(() => SortDirection, { nullable: true })
  @IsOptional()
  @IsIn(SORT_DIRECTION)
  direction?: SortDirection = 'desc';
}

@InputType()
export class SearchCriteriaDto {
  @Field(() => PropertySearchFilters)
  filters: PropertySearchFilters;

  @Field(() => CursorPaginationInput, { nullable: true })
  @IsOptional()
  pagination?: CursorPaginationInput;

  @Field(() => SearchSortOptions, { nullable: true })
  @IsOptional()
  sort?: SearchSortOptions;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  includeTotalCount?: boolean = true;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  cacheResults?: boolean = true;
}

// Response DTOs
@InputType()
export class SearchResultItem {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  address: string;

  @Field()
  city: string;

  @Field()
  state: string;

  @Field()
  zipCode: string;

  @Field()
  country: string;

  @Field(() => Float)
  price: number;

  @Field()
  propertyType: string;

  @Field({ nullable: true })
  bedrooms?: number;

  @Field(() => Float, { nullable: true })
  bathrooms?: number;

  @Field(() => Float, { nullable: true })
  squareFeet?: number;

  @Field(() => Float, { nullable: true })
  lotSize?: number;

  @Field({ nullable: true })
  yearBuilt?: number;

  @Field(() => [String], { nullable: true })
  features?: string[];

  @Field(() => [Float], { nullable: true })
  location?: [number, number];

  @Field()
  status: string;

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  owner?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

@InputType()
export class PaginatedSearchResponse {
  @Field(() => [SearchResultItem])
  results: SearchResultItem[];

  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  @IsOptional()
  nextCursor?: string;

  @Field({ nullable: true })
  @IsOptional()
  totalCount?: number;

  @Field()
  pageInfo: {
    limit: number;
    offset: number;
  };
}
