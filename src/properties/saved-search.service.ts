import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateSavedSearchDto,
  UpdateSavedSearchDto,
  SavedSearchResponse,
} from './dto/saved-search.dto';

@Injectable()
export class SavedSearchService {
  private readonly logger = new Logger(SavedSearchService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new saved search
   */
  async create(createDto: CreateSavedSearchDto, userId: string): Promise<SavedSearchResponse> {
    const result = await (this.prisma as any).savedSearch.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        criteria: createDto.criteria,
        isActive: true,
        alertEnabled: createDto.alertEnabled ?? true,
        lastRunAt: new Date(),
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    return result;
  }

  /**
   * Get all saved searches for a user
   */
  async findByUser(userId: string, includeAlerts: boolean = false): Promise<SavedSearchResponse[]> {
    const result = await (this.prisma as any).savedSearch.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        ...(includeAlerts && {
          alerts: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              property: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  status: true,
                },
              },
            },
          },
        }),
      },
      orderBy: { updatedAt: 'desc' },
    });
    return result;
  }

  /**
   * Find by ID
   */
  async findById(id: string, userId?: string): Promise<SavedSearchResponse | null> {
    const where = userId ? { id, userId } : { id };

    const result = await (this.prisma as any).savedSearch.findUnique({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        alerts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            property: {
              select: {
                id: true,
                title: true,
                price: true,
                status: true,
              },
            },
          },
        },
      },
    });
    return result;
  }

  /**
   * Update saved search
   */
  async update(
    id: string,
    updateDto: UpdateSavedSearchDto,
    userId: string,
  ): Promise<SavedSearchResponse> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error('Saved search not found');
    }

    const data: Record<string, any> = {};
    if (updateDto.name !== undefined) data.name = updateDto.name;
    if (updateDto.description !== undefined) data.description = updateDto.description;
    if (updateDto.criteria !== undefined) data.criteria = updateDto.criteria;
    if (updateDto.isActive !== undefined) data.isActive = updateDto.isActive;
    if (updateDto.alertEnabled !== undefined) data.alertEnabled = updateDto.alertEnabled;

    const result = await (this.prisma as any).savedSearch.update({
      where: { id, userId },
      data,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    return result;
  }

  /**
   * Delete saved search
   */
  async delete(id: string, userId: string): Promise<void> {
    await (this.prisma as any).savedSearch.deleteMany({
      where: { id, userId },
    });
  }

  /**
   * Run a saved search to find matching properties
   */
  async runSearch(searchId: string, userId: string) {
    const savedSearch = await this.findById(searchId, userId);
    if (!savedSearch) {
      throw new Error('Saved search not found');
    }

    return this.findNewMatches(searchId);
  }

  /**
   * Find new properties matching a saved search since last run
   */
  private async findNewMatches(savedSearchId: string): Promise<{
    savedSearchId: string;
    newMatches: any[];
    totalMatches: number;
  }> {
    const savedSearch = await (this.prisma as any).savedSearch.findUnique({
      where: { id: savedSearchId },
    });

    if (!savedSearch || !savedSearch.isActive) {
      return { savedSearchId, newMatches: [], totalMatches: 0 };
    }

    // Build query from saved criteria
    const criteria = savedSearch.criteria as any;
    const filters = criteria?.filters || {};
    const where: any = {};

    // Apply filters
    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { address: { contains: filters.query, mode: 'insensitive' } },
        { city: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    if (filters.cities?.length) where.city = { in: filters.cities };
    if (filters.states?.length) where.state = { in: filters.states };
    if (filters.propertyTypes?.length) where.propertyType = { in: filters.propertyTypes };
    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.features?.length) where.features = { hasSome: filters.features };

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

    // Get total count
    const totalMatches = await (this.prisma as any).property.count({ where });

    // Get only new properties since last run
    if (savedSearch.lastRunAt) {
      where.createdAt = { gt: savedSearch.lastRunAt };
    }

    // Order by date
    const sortOptions = criteria?.sort || { field: 'createdAt', direction: 'desc' };
    const orderBy: any = { [sortOptions.field || 'createdAt']: sortOptions.direction || 'desc' };

    // Fetch new properties
    const newProperties = await (this.prisma as any).property.findMany({
      where,
      orderBy,
      take: 50,
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

    // Update lastRunAt
    await (this.prisma as any).savedSearch.update({
      where: { id: savedSearchId },
      data: { lastRunAt: new Date() },
    });

    return {
      savedSearchId,
      newMatches: newProperties,
      totalMatches,
    };
  }

  /**
   * Duplicate a saved search
   */
  async duplicate(id: string, userId: string, newName?: string): Promise<SavedSearchResponse> {
    const original = await this.findById(id, userId);
    if (!original) {
      throw new Error('Saved search not found');
    }

    return this.create(
      {
        name: newName || `${original.name} (Copy)`,
        description: original.description,
        criteria: original.criteria,
        alertEnabled: original.alertEnabled,
      },
      userId,
    );
  }
}

// Forward declaration - the actual alert service will be in same file
@Injectable()
export class SavedSearchAlertService {
  private readonly logger = new Logger(SavedSearchAlertService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Find new properties matching a saved search since last run
   */
  async findNewMatches(savedSearchId: string): Promise<{
    savedSearchId: string;
    newMatches: any[];
    totalMatches: number;
  }> {
    const savedSearch = await (this.prisma as any).savedSearch.findUnique({
      where: { id: savedSearchId },
    });

    if (!savedSearch || !savedSearch.isActive) {
      return { savedSearchId, newMatches: [], totalMatches: 0 };
    }

    const criteria = savedSearch.criteria as any;
    const filters = criteria?.filters || {};
    const where: any = {};

    if (filters.query) {
      where.OR = [
        { title: { contains: filters.query, mode: 'insensitive' } },
        { description: { contains: filters.query, mode: 'insensitive' } },
        { address: { contains: filters.query, mode: 'insensitive' } },
        { city: { contains: filters.query, mode: 'insensitive' } },
      ];
    }
    if (filters.cities?.length) where.city = { in: filters.cities };
    if (filters.states?.length) where.state = { in: filters.states };
    if (filters.propertyTypes?.length) where.propertyType = { in: filters.propertyTypes };
    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.features?.length) where.features = { hasSome: filters.features };

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

    const totalMatches = await (this.prisma as any).property.count({ where });

    if (savedSearch.lastRunAt) {
      where.createdAt = { gt: savedSearch.lastRunAt };
    }

    const sortOptions = criteria?.sort || { field: 'createdAt', direction: 'desc' };
    const orderBy: any = { [sortOptions.field || 'createdAt']: sortOptions.direction || 'desc' };

    const newProperties = await (this.prisma as any).property.findMany({
      where,
      orderBy,
      take: 50,
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

    await (this.prisma as any).savedSearch.update({
      where: { id: savedSearchId },
      data: { lastRunAt: new Date() },
    });

    return {
      savedSearchId,
      newMatches: newProperties,
      totalMatches,
    };
  }

  /**
   * Create alerts for new matching properties
   */
  async createAlertsForMatches(savedSearchId: string, propertyIds: string[]): Promise<void> {
    if (propertyIds.length === 0) return;

    const alertRecords = propertyIds.map((propertyId) => ({
      savedSearchId,
      propertyId,
      createdAt: new Date(),
    }));

    await (this.prisma as any).searchAlert.createMany({
      data: alertRecords,
      skipDuplicates: true,
    });

    this.logger.debug(`Created ${propertyIds.length} alerts for saved search ${savedSearchId}`);
  }

  /**
   * Get unnotified alerts for a user
   */
  async getUnnotifiedAlerts(userId: string) {
    return (this.prisma as any).searchAlert.findMany({
      where: {
        savedSearch: {
          userId,
        },
        notified: false,
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
          },
        },
        savedSearch: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Mark alerts as notified
   */
  async markAlertsAsNotified(alertIds: string[]): Promise<void> {
    await (this.prisma as any).searchAlert.updateMany({
      where: { id: { in: alertIds } },
      data: { notified: true, notifiedAt: new Date() },
    });
  }

  /**
   * Get search statistics for a user
   */
  async getSearchStats(userId: string) {
    const [totalSavedSearches, totalAlerts, unnotifiedAlerts] = await Promise.all([
      (this.prisma as any).savedSearch.count({ where: { userId } }),
      (this.prisma as any).searchAlert.count({
        where: {
          savedSearch: {
            userId,
          },
        },
      }),
      (this.prisma as any).searchAlert.count({
        where: {
          savedSearch: {
            userId,
          },
          notified: false,
        },
      }),
    ]);

    return {
      totalSavedSearches,
      totalAlerts,
      unnotifiedAlerts,
    };
  }
}
