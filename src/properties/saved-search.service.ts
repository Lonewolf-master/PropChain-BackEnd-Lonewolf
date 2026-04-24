import { Injectable, Logger, Cron, CronExpression } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

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
    const savedSearch = await this.prisma.savedSearch.findUnique({
      where: { id: savedSearchId },
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

    if (!savedSearch || !savedSearch.isActive) {
      return { savedSearchId, newMatches: [], totalMatches: 0 };
    }

    // Build query from saved criteria
    const criteria = savedSearch.criteria as any;
    const filters = criteria?.filters || {};
    
    // Build search query
    const where: any = {};
    
    // Apply filters from saved criteria
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

    // Price range
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      where.price = {
        ...(filters.minPrice !== undefined && { gte: filters.minPrice }),
        ...(filters.maxPrice !== undefined && { lte: filters.maxPrice }),
      };
    }

    // Bedrooms range
    if (filters.minBedrooms !== undefined || filters.maxBedrooms !== undefined) {
      where.bedrooms = {
        ...(filters.minBedrooms !== undefined && { gte: filters.minBedrooms }),
        ...(filters.maxBedrooms !== undefined && { lte: filters.maxBedrooms }),
      };
    }

    // Bathrooms range
    if (filters.minBathrooms !== undefined || filters.maxBathrooms !== undefined) {
      where.bathrooms = {
        ...(filters.minBathrooms !== undefined && { gte: filters.minBathrooms }),
        ...(filters.maxBathrooms !== undefined && { lte: filters.maxBathrooms }),
      };
    }

    // Square feet range
    if (filters.minSquareFeet !== undefined || filters.maxSquareFeet !== undefined) {
      where.squareFeet = {
        ...(filters.minSquareFeet !== undefined && { gte: filters.minSquareFeet }),
        ...(filters.maxSquareFeet !== undefined && { lte: filters.maxSquareFeet }),
      };
    }

    // Get total count
    const totalMatches = await this.prisma.property.count({ where });

    // Get only new properties since last run
    if (savedSearch.lastRunAt) {
      where.createdAt = { gt: savedSearch.lastRunAt };
    }

    // Order by date
    const sortOptions = criteria?.sort || { field: 'createdAt', direction: 'desc' };
    const orderBy: any = { [sortOptions.field || 'createdAt']: sortOptions.direction || 'desc' };

    // Fetch new properties
    const newProperties = await this.prisma.property.findMany({
      where,
      orderBy,
      take: 50, // Limit per run
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
    await this.prisma.savedSearch.update({
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

    // Create alert records
    const alertRecords = propertyIds.map((propertyId) => ({
      savedSearchId,
      propertyId,
      createdAt: new Date(),
    }));

    await this.prisma.searchAlert.createMany({
      data: alertRecords as any,
      skipDuplicates: true,
    });

    this.logger.debug(`Created ${propertyIds.length} alerts for saved search ${savedSearchId}`);
  }

  /**
   * Mark alerts as notified
   */
  async markAlertsAsNotified(alertIds: string[]): Promise<void> {
    await this.prisma.searchAlert.updateMany({
      where: { id: { in: alertIds } },
      data: {
        notified: true,
        notifiedAt: new Date(),
      },
    });
  }

  /**
   * Get un notified alerts for a user
   */
  async getUnnotifiedAlerts(userId: string): Promise<any[]> {
    return this.prisma.searchAlert.findMany({
      where: {
        savedSearch: { userId },
        notified: false,
      },
      include: {
        property: {
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
        },
        savedSearch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Run all active searches and create alerts
   * Can be triggered by a cron job
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runDailySearchCheck(): Promise<void> {
    this.logger.log('Running daily saved search check...');

    // Get all active saved searches with alerts enabled
    const activeSearches = await this.prisma.savedSearch.findMany({
      where: {
        isActive: true,
        alertEnabled: true,
      },
      select: { id: true },
    });

    for (const savedSearch of activeSearches) {
      try {
        const { newMatches } = await this.findNewMatches(savedSearch.id);
        
        if (newMatches.length > 0) {
          const propertyIds = newMatches.map((p) => p.id);
          await this.createAlertsForMatches(savedSearch.id, propertyIds);
          
          this.logger.log(`Found ${newMatches.length} new matches for search ${savedSearch.id}`);
        }
      } catch (error) {
        this.logger.error(`Error running saved search ${savedSearch.id}:`, error);
      }
    }

    this.logger.log('Daily saved search check completed');
  }

  /**
   * Get search statistics
   */
  async getSearchStats(userId: string): Promise<{
    totalSearches: number;
    activeSearches: number;
    totalAlerts: number;
    unNotifiedAlerts: number;
  }> {
    const [totalSearches, activeSearches, totalAlerts, unNotifiedAlerts] = await Promise.all([
      this.prisma.savedSearch.count({ where: { userId } }),
      this.prisma.savedSearch.count({ where: { userId, isActive: true } }),
      this.prisma.searchAlert.count({
        where: {
          savedSearch: { userId },
        },
      }),
      this.prisma.searchAlert.count({
        where: {
          savedSearch: { userId },
          notified: false,
        },
      }),
    ]);

    return {
      totalSearches,
      activeSearches,
      totalAlerts,
      unNotifiedAlerts,
    };
  }
}

@Injectable()
export class SavedSearchService {
  private readonly logger = new Logger(SavedSearchService.name);

  constructor(
    private prisma: PrismaService,
    private alertService: SavedSearchAlertService,
  ) {}

  /**
   * Create a new saved search
   */
  async create(createDto: any, userId: string): Promise<any> {
    return this.prisma.savedSearch.create({
      data: {
        ...createDto,
        userId,
        criteria: createDto.criteria,
        lastRunAt: new Date(),
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
  }

  /**
   * Get all saved searches for a user
   */
  async findByUser(userId: string, includeAlerts: boolean = false): Promise<any[]> {
    return this.prisma.savedSearch.findMany({
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
  }

  /**
   * Find by ID
   */
  async findById(id: string, userId?: string): Promise<any> {
    const where: any = { id };
    if (userId) {
      where.userId = userId;
    }

    return this.prisma.savedSearch.findUnique({
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
  }

  /**
   * Update saved search
   */
  async update(id: string, updateDto: any, userId: string): Promise<any> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error('Saved search not found');
    }

    return this.prisma.savedSearch.update({
      where: { id, userId },
      data: updateDto,
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
  }

  /**
   * Delete saved search
   */
  async delete(id: string, userId: string): Promise<void> {
    await this.prisma.savedSearch.deleteMany({
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

    return this.alertService.findNewMatches(searchId);
  }

  /**
   * Duplicate a saved search
   */
  async duplicate(id: string, userId: string, newName?: string): Promise<any> {
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
