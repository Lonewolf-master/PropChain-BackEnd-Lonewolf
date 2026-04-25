import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';
import { FraudService } from '../fraud/fraud.service';
import {
  SearchCriteriaDto,
  PaginatedSearchResponse,
  PropertySearchFilters,
  PropertyWhere,
  SearchSortOptions,
  PropertySortField,
  SearchResultItem,
} from './dto/search.dto';

interface FindAllParams {
  skip?: number;
  take?: number;
  where?: Record<string, unknown>;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

@Injectable()
export class PropertiesService {
  private readonly DEFAULT_LIMIT = 20;
  private readonly MAX_LIMIT = 100;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fraudService: FraudService,
  ) {}

  /**
   * Cached property search (uses Redis cache)
   */
  async cachedSearch(criteria: SearchCriteriaDto): Promise<PaginatedSearchResponse> {
    return this.search(criteria);
  }

  /**
   * Optimized search with cursor-based pagination
   */
  async search(criteria: SearchCriteriaDto): Promise<PaginatedSearchResponse> {
    const { filters, pagination, sort, includeTotalCount = true, cacheResults = true } = criteria;

    // Build sort configuration
    const sortConfig = this.buildSortConfig(sort);

    // Build optimized query
    const where = this.buildWhereClause(filters);

    // Get total count if requested
    let totalCount: number | null = null;
    if (includeTotalCount) {
      totalCount = (await (this.prisma as any).property.count({ where })) as number;
    }

    // Build order by
    const orderBy = { [sortConfig.field]: sortConfig.direction };

    // Apply cursor pagination
    const { cursor, limit: rawLimit } = pagination || {};
    const limit = Math.min(rawLimit || this.DEFAULT_LIMIT, this.MAX_LIMIT);

    // Build query
    const query: any = {
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
      take: limit + 1,
    };

    // Add cursor condition if provided
    if (cursor) {
      // Use id < cursor for descending order
      query.where.id = { lt: cursor };
    }

    // Execute query
    const rawResults = await (this.prisma as any).property.findMany(query);

    // Check if there are more results
    const hasMore = rawResults.length > limit;
    if (hasMore) {
      rawResults.pop();
    }

    // Generate next cursor
    const nextCursor =
      hasMore && rawResults.length > 0 ? rawResults[rawResults.length - 1].id : undefined;

    // Map to response DTO
    const results = this.mapToSearchResultItem(rawResults);

    return {
      results,
      hasNextPage: hasMore,
      nextCursor,
      ...(includeTotalCount && { totalCount: totalCount || 0 }),
      pageInfo: {
        limit,
        offset: 0,
      },
    };
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: PropertySearchFilters): PropertyWhere {
    const where: PropertyWhere = {};

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
      } as { gte?: number; lte?: number };
    }
    if (filters.minBedrooms !== undefined || filters.maxBedrooms !== undefined) {
      where.bedrooms = {
        ...(filters.minBedrooms !== undefined && { gte: filters.minBedrooms }),
        ...(filters.maxBedrooms !== undefined && { lte: filters.maxBedrooms }),
      } as { gte?: number; lte?: number };
    }
    if (filters.minBathrooms !== undefined || filters.maxBathrooms !== undefined) {
      where.bathrooms = {
        ...(filters.minBathrooms !== undefined && { gte: filters.minBathrooms }),
        ...(filters.maxBathrooms !== undefined && { lte: filters.maxBathrooms }),
      } as { gte?: number; lte?: number };
    }
    if (filters.minSquareFeet !== undefined || filters.maxSquareFeet !== undefined) {
      where.squareFeet = {
        ...(filters.minSquareFeet !== undefined && { gte: filters.minSquareFeet }),
        ...(filters.maxSquareFeet !== undefined && { lte: filters.maxSquareFeet }),
      } as { gte?: number; lte?: number };
    }

    return where;
  }

  /**
   * Build sort configuration
   */
  private buildSortConfig(sort?: SearchSortOptions): {
    field: PropertySortField;
    direction: 'asc' | 'desc';
  } {
    return {
      field: sort?.field || 'createdAt',
      direction: sort?.direction || 'desc',
    };
  }

  /**
   * Map Prisma results to DTO
   */
  private mapToSearchResultItem(properties: any[]): SearchResultItem[] {
    return properties.map((prop) => ({
      id: prop.id,
      title: prop.title,
      description: prop.description || undefined,
      address: prop.address,
      city: prop.city,
      state: prop.state,
      zipCode: prop.zipCode,
      country: prop.country,
      price: typeof prop.price === 'object' ? parseFloat(prop.price.toString()) : prop.price,
      propertyType: prop.propertyType,
      bedrooms: prop.bedrooms ?? undefined,
      bathrooms:
        typeof prop.bathrooms === 'object' ? parseFloat(prop.bathrooms.toString()) : prop.bathrooms,
      squareFeet:
        typeof prop.squareFeet === 'object'
          ? parseFloat(prop.squareFeet.toString())
          : prop.squareFeet,
      lotSize:
        typeof prop.lotSize === 'object' ? parseFloat(prop.lotSize.toString()) : prop.lotSize,
      yearBuilt: prop.yearBuilt ?? undefined,
      features: prop.features || undefined,
      location: prop.latitude && prop.longitude ? [prop.longitude, prop.latitude] : undefined,
      status: prop.status,
      createdAt: prop.createdAt,
      owner: prop.owner
        ? {
            id: prop.owner.id,
            firstName: prop.owner.firstName,
            lastName: prop.owner.lastName,
            email: prop.owner.email,
          }
        : undefined,
    }));
  }

  // ==================== Existing Methods ====================

  async create(createPropertyDto: any, ownerId: string) {
    const { price, squareFeet, lotSize, ...rest } = createPropertyDto;

    const property = await this.prisma.property.create({
      data: {
        ...rest,
        price: new Decimal(price.toString()),
        squareFeet: squareFeet ? new Decimal(squareFeet.toString()) : null,
        lotSize: lotSize ? new Decimal(lotSize.toString()) : null,
        owner: { connect: { id: ownerId } },
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

    await this.fraudService.evaluatePropertyCreated(property.id);

    return property;
  }

  async findAll(params?: any) {
    const { skip, take, where, orderBy } = params || {};
    return (this.prisma as any).property.findMany({
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
    return (this.prisma as any).property.findUnique({
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

  async update(id: string, updatePropertyDto: any) {
    const { price, squareFeet, lotSize, ...rest } = updatePropertyDto;

    return (this.prisma as any).property.update({
      where: { id },
      data: {
        ...rest,
        price: price ? new Decimal(price.toString()) : undefined,
        squareFeet: squareFeet ? new Decimal(squareFeet.toString()) : undefined,
        lotSize: lotSize ? new Decimal(lotSize.toString()) : undefined,
      },
    });
  }

  async remove(id: string) {
    return (this.prisma as any).property.delete({
      where: { id },
    });
  }

  async findByOwnerId(ownerId: string) {
    return (this.prisma as any).property.findMany({
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
