import { IsOptional, IsNumber, IsString, IsBoolean, IsArray, IsIn, Min, Max } from 'class-validator';
import { InputType, Field, Float } from '@nestjs/graphql';

// Sort fields (as string literals for GraphQL enum)
export const PROPERTY_SORT_FIELDS = ['price', 'createdAt', 'squareFeet', 'bedrooms', 'bathrooms', 'yearBuilt'];
export const SORT_DIRECTION = ['asc', 'desc'];

export type PropertySortField = 'price' | 'createdAt' | 'squareFeet' | 'bedrooms' | 'bathrooms' | 'yearBuilt';
export type SortDirection = 'asc' | 'desc';

@InputType()
export class PropertySearchFilters {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  query?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  cities?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  states?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
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
  @IsString()
  status?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  features?: string[];
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
  @Field({ nullable: true })
  @IsOptional()
  field?: PropertySortField;

  @Field({ nullable: true })
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

@InputType()
export class SearchResultItem {
  @Field(() => Float)
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
  nextCursor?: string;

  @Field({ nullable: true })
  totalCount?: number;

  @Field()
  pageInfo: {
    limit: number;
    offset: number;
  };
}

// Auxiliary DTOs for internal use
export interface PropertyInclude {
  owner?: {
    select: {
      id: boolean;
      firstName: boolean;
      lastName: boolean;
      email: boolean;
    };
  };
}

export interface PropertyWhere {
  AND?: any[];
  OR?: any[];
  id?: string;
  title?: { contains: string; mode: string };
  description?: { contains: string; mode: string };
  city?: { in: string[] } | string;
  state?: { in: string[] } | string;
  propertyType?: { in: string[] } | string;
  price?: { gte: number; lte: number } | number;
  bedrooms?: { gte: number; lte: number } | number;
  bathrooms?: { gte: number; lte: number } | number;
  squareFeet?: { gte: number; lte: number } | number;
  status?: string;
  ownerId?: string;
  features?: { hasSome: string[] };
  createdAt?: { gt: Date };
}

export interface PropertyOrderBy {
  [key: string]: 'asc' | 'desc';
}
