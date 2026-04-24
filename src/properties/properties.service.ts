import { Injectable, Logger, CacheInterceptor, CacheKey, CacheTTL, UseInterceptors } from '@nestjs/common';
import { Inject, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '../database/prisma.service';
import { CacheService } from '../cache/cache.service';
import { 
  CreatePropertyDto, 
  UpdatePropertyDto, 
  SearchCriteriaDto, 
  PropertySearchFilters,
  CursorPaginationInput,
  SearchSortOptions,
  SearchResultItem,
  PaginatedSearchResponse,
  PROPERTY_SORT_FIELDS,
  SORT_DIRECTION
} from './dto/search.dto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

type PropertySortField = (typeof PROPERTY_SORT_FIELDS)[number];
type SortDirection = (typeof SORT_DIRECTION)[number];

@Injectable({ scope: Scope.DEFAULT })
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);
  private readonly DEFAULT_LIMIT = 20;
  private readonly MAX_LIMIT = 100;

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  /**
   * Optimized search with cursor-based pagination
   */
  async search(criteria: SearchCriteriaDto): Promise<PaginatedSearchResponse> {
    const { filters, pagination, sort, includeTotalCount = true, cacheResults = true } = criteria;

    // Validate and normalize inputs
    const validatedFilters = this.normalizeFilters(filters);
    const validatedPagination = pagination || { limit: this.DEFAULT_LIMIT };
    
    // Build sort configuration
    const sortConfig = this.buildSortConfig(sort);

    // Generate cache key if caching is enabled
    if (cacheResults) {
      const cacheKey = this.buildCacheKey(validatedFilters, validatedPagination, sortConfig);
      const cached = await this.cacheService.get<PaginatedSearchResponse>(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for search: ${cacheKey}`);
        return cached;
      }
    }

    // Build optimized query
    const query = this.buildSearchQuery(validatedFilters, sortConfig, includeTotalCount);
    
    // Apply cursor pagination
    const { results, nextCursor, hasNextPage, totalCount } = await this.executePaginatedQuery(
      query,
      validatedPagination
    );

    const response: PaginatedSearchResponse = {
      results,
      hasNextPage,
      nextCursor: hasNextPage ? nextCursor : undefined,
      ...(includeTotalCount && { totalCount }),
      pageInfo: {
        limit: validatedPagination.limit,
        offset: 0, // Cursor-based, so offset is implicit
      },
    };

    // Cache results if enabled
    if (cacheResults) {
      const cacheKey = this.buildCacheKey(validatedFilters, validatedPagination, sortConfig);
      await this.cacheService.set(
        cacheKey,
        response,
        300, // 5 minutes TTL for search results
        'search',
      );
    }

    return response;
  }

  /**
   * Search with caching and performance monitoring
   */
  @UseInterceptors(CacheInterceptor)
  @CacheKey('search')
  @CacheTTL(300)
  async cachedSearch(@Inject(REQUEST) req: any, criteria: SearchCriteriaDto): Promise<PaginatedSearchResponse> {
    return this.search(criteria);
  }

  /**
   * Execute search with cursor pagination
   */
  private async executePaginatedQuery(
    baseQuery: any,
    pagination: CursorPaginationInput,
  ): Promise<{
    results: SearchResultItem[];
    nextCursor: string | undefined;
    hasNextPage: boolean;
    totalCount: number | null;
  }> {
    const { cursor, limit } = pagination;
    const validatedLimit = Math.min(
      limit || this.DEFAULT_LIMIT,
      this.MAX_LIMIT,
    );

    // Build cursor condition if provided
    if (cursor) {
      baseQuery.where = {
        ...baseQuery.where,
        id: {
          lt: cursor, // Use less-than for descending, gt for ascending
        },
      };
    }

    // Execute query with optimized include
    const results = await this.prisma.property.findMany({
      ...baseQuery,
      take: validatedLimit + 1, // Fetch one extra to check for next page
      skip: 0, // Cursor-based pagination doesn't use skip
    });

    // Check if there are more results
    const hasMore = results.length > validatedLimit;
    if (hasMore) {
      results.pop(); // Remove the extra item
    }

    // Generate next cursor from last item
    const nextCursor = hasMore && results.length > 0 
      ? results[results.length - 1].id 
      : undefined;

    // Get total count if requested
    let totalCount: number | null = null;
    if (baseQuery.select?.count || baseQuery.include?.count) {
      const countResult = await this.prisma.property.count({
        where: baseQuery.where,
      });
      totalCount = countResult;
    }

    return {
      results: this.mapToSearchResultItem(results),
      nextCursor,
      hasNextPage: hasMore,
      totalCount,
    };
  }

  /**
   * Build optimized Prisma query
   */
  private buildSearchQuery(
    filters: PropertySearchFilters,
    sortConfig: { field: PropertySortField; direction: SortDirection },
    includeCount: boolean,
  ): any {
    const where: any = {};
    const include: any = {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    };

    // Text search
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { address: { contains: filters.query, mode: 'insensitive' } },
        { city: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    // Exact match filters
    if (filters.cities?.length) {
      where.city = { in: filters.cities };
    }
    if (filters.states?.length) {
      where.state = { in: filters.states };
    }
    if (filters.propertyTypes?.length) {
      where.propertyType = { in: filters.propertyTypes };
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }
    if (filters.features?.length) {
      where.features = { hasSome: filters.features };
    }

    // Range filters
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {
        ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
        ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
      };
    }
    if (filters.minBedrooms !== undefined || filters.maxBedrooms !== undefined) {
      where.bedrooms = {
        ...(filters.minBedrooms !== undefined && { gte: filters.minBedrooms }),
        ...(filters.maxBedrooms !== undefined && { lte: filters.maxBedrooms }),
      };
    }
    if (filters.minBathrooms !== undefined || filters.maxBathrooms !== undefined) {
      where.bathrooms = {
        ...(filters.minBathrooms !== undefined && { gte: filters.minBathrooms }),
        ...(filters.maxBathrooms !== undefined && { lte: filters.maxBathrooms }),
      };
    }
    if (filters.minSquareFeet !== undefined || filters.maxSquareFeet !== undefined) {
      where.squareFeet = {
        ...(filters.minSquareFeet !== undefined && { gte: filters.minSquareFeet }),
        ...(filters.maxSquareFeet !== undefined && { lte: filters.maxSquareFeet }),
      };
    }
    if (filters.minLotSize !== undefined || filters.maxLotSize !== undefined) {
      where.lotSize = {
        ...(filters.minLotSize !== undefined && { gte: filters.minLotSize }),
        ...(filters.maxLotSize !== undefined && { lte: filters.maxLotSize }),
      };
    }
    if (filters.minYearBuilt !== undefined || filters.maxYearBuilt !== undefined) {
      where.yearBuilt = {
        ...(filters.minYearBuilt !== undefined && { gte: filters.minYearBuilt }),
        ...(filters.maxYearBuilt !== undefined && { lte: filters.maxYearBuilt }),
      };
    }

    // Geo search
    if (filters.geoLocation && filters.radius) {
      // PostGIS or simple distance calculation
      // For now, skip complex geo (would require PostGIS extension)
      // Could implement Haversine formula in application layer for simple cases
    }

    // Boolean flags
    if (filters.hasPhotos) {
      // Assuming documents table stores photos
      // This would require a subquery or join
    }
    if (filters.isVerified) {
      // Check if owner is verified
    }

    return {
      where,
      orderBy: {
        [sortConfig.field]: sortConfig.direction,
      },
      include,
      ...(includeCount && { select: { count: true } }),
    };
  }

  /**
   * Build sort configuration
   */
  private buildSortConfig(sort?: SearchSortOptions): { field: PropertySortField; direction: SortDirection } {
    return {
      field: sort?.field || 'createdAt',
      direction: sort?.direction || 'desc',
    };
  }

  /**
   * Build cache key from search parameters
   */
  private buildCacheKey(
    filters: PropertySearchFilters,
    pagination: CursorPaginationInput,
    sort: { field: PropertySortField; direction: SortDirection },
  ): string {
    const keyData = {
      f: filters,
      p: pagination,
      s: sort,
    };
    return `search:${this.hashObject(keyData)}`;
  }

  /**
   * Simple hash for objects (in production, use a robust hash like SHA256)
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Normalize and validate filters
   */
  private normalizeFilters(filters: PropertySearchFilters): PropertySearchFilters {
    // Remove empty/undefined arrays
    if (filters.cities?.length === 0) delete filters.cities;
    if (filters.states?.length === 0) delete filters.states;
    if (filters.propertyTypes?.length === 0) delete filters.propertyTypes;
    if (filters.features?.length === 0) delete filters.features;

    return filters;
  }

  /**
   * Map Prisma results to DTO
   */
  private mapToSearchResultItem(properties: any[]): SearchResultItem[] {
    return properties.map((prop) => ({
      id: prop.id,
      title: prop.title,
      description: prop.description,
      address: prop.address,
      city: prop.city,
      state: prop.state,
      zipCode: prop.zipCode,
      country: prop.country,
      price: parseFloat(prop.price.toString()),
      propertyType: prop.propertyType,
      bedrooms: prop.bedrooms,
      bathrooms: parseFloat(prop.bathrooms?.toString() || '0'),
      squareFeet: parseFloat(prop.squareFeet?.toString() || '0'),
      lotSize: parseFloat(prop.lotSize?.toString() || '0'),
      yearBuilt: prop.yearBuilt,
      features: prop.features,
      location: prop.latitude && prop.longitude ? [prop.longitude, prop.latitude] : undefined,
      status: prop.status,
      createdAt: prop.createdAt,
      owner: prop.owner ? {
        id: prop.owner.id,
        firstName: prop.owner.firstName,
        lastName: prop.owner.lastName,
        email: prop.owner.email,
      } : undefined,
    }));
  }

  // ==================== Existing Methods ====================

  async create(createPropertyDto: CreatePropertyDto, ownerId: string) {
    const { price, squareFeet, lotSize, ...rest } = createPropertyDto;

    return this.prisma.property.create({
      data: {
        ...rest,
        price: new (require('@prisma/client/runtime/library').Decimal)(price.toString()),
        squareFeet: squareFeet ? new (require('@prisma/client/runtime/library').Decimal)(squareFeet.toString()) : null,
        lotSize: lotSize ? new (require('@prisma/client/runtime/library').Decimal)(lotSize.toString()) : null,
        owner: {
          connect: { id: ownerId },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findAll(params?: any) {
    const { skip, take, where, orderBy } = params || {};
    return this.prisma.property.findMany({
      skip,
      take,
      where,
      orderBy,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        documents: true,
      },
    });
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto) {
    const { price, squareFeet, lotSize, ...rest } = updatePropertyDto;

    return this.prisma.property.update({
      where: { id },
      data: {
        ...rest,
        price: price ? new (require('@prisma/client/runtime/library').Decimal)(price.toString()) : undefined,
        squareFeet: squareFeet ? new (require('@prisma/client/runtime/library').Decimal)(squareFeet.toString()) : undefined,
        lotSize: lotSize ? new (require('@prisma/client/runtime/library').Decimal)(lotSize.toString()) : undefined,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.property.delete({
      where: { id },
    });
  }

  async findByOwnerId(ownerId: string) {
    return this.prisma.property.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }
}
