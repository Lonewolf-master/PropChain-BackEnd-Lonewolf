import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Query } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { SearchCriteriaDto, PaginatedSearchResponse } from './dto/search.dto';
import { CreatePropertyDto, UpdatePropertyDto } from './dto/property.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUserPayload } from '../auth/types/auth-user.type';
import { SavedSearchService } from './saved-search.service';
import {
  CreateSavedSearchDto,
  UpdateSavedSearchDto,
  SavedSearchResponse,
} from './dto/saved-search.dto';
import { SavedSearchAlertService } from './saved-search.service';

@Controller('properties')
export class PropertiesController {
  constructor(
    private propertiesService: PropertiesService,
    private savedSearchService: SavedSearchService,
    private savedSearchAlertService: SavedSearchAlertService,
  ) {}

  // ==================== Search Endpoints ====================

  /**
   * Optimized property search with cursor-based pagination
   * GET /properties/search
   */
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(
    @Query() criteria: SearchCriteriaDto,
    @CurrentUser() _user: AuthUserPayload,
  ): Promise<PaginatedSearchResponse> {
    return this.propertiesService.search(criteria);
  }

  /**
   * Cached property search (uses Redis cache)
   * GET /properties/search/cached
   */
  @Get('search/cached')
  @UseGuards(JwtAuthGuard)
  async cachedSearch(
    @Query() criteria: SearchCriteriaDto,
    @CurrentUser() _user: AuthUserPayload,
  ): Promise<PaginatedSearchResponse> {
    return this.propertiesService.cachedSearch(null, criteria);
  }

  // ==================== Saved Search Endpoints ====================

  /**
   * Get all saved searches for current user
   * GET /properties/saved-searches
   */
  @Get('saved-searches')
  @UseGuards(JwtAuthGuard)
  async getSavedSearches(
    @CurrentUser() user: AuthUserPayload,
    @Query('includeAlerts') includeAlerts?: string,
  ): Promise<SavedSearchResponse[]> {
    return this.savedSearchService.findByUser(user.sub, includeAlerts === 'true');
  }

  /**
   * Get saved search by ID
   * GET /properties/saved-searches/:id
   */
  @Get('saved-searches/:id')
  @UseGuards(JwtAuthGuard)
  async getSavedSearch(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<SavedSearchResponse> {
    return this.savedSearchService.findById(id, user.sub);
  }

  /**
   * Create saved search
   * POST /properties/saved-searches
   */
  @Post('saved-searches')
  @UseGuards(JwtAuthGuard)
  async createSavedSearch(
    @Body() createDto: CreateSavedSearchDto,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<SavedSearchResponse> {
    return this.savedSearchService.create(createDto, user.sub);
  }

  /**
   * Update saved search
   * PUT /properties/saved-searches/:id
   */
  @Put('saved-searches/:id')
  @UseGuards(JwtAuthGuard)
  async updateSavedSearch(
    @Param('id') id: string,
    @Body() updateDto: UpdateSavedSearchDto,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<SavedSearchResponse> {
    return this.savedSearchService.update(id, updateDto, user.sub);
  }

  /**
   * Delete saved search
   * DELETE /properties/saved-searches/:id
   */
  @Delete('saved-searches/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSavedSearch(
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<void> {
    return this.savedSearchService.delete(id, user.sub);
  }

  /**
   * Run saved search (find new matching properties)
   * POST /properties/saved-searches/:id/run
   */
  @Post('saved-searches/:id/run')
  @UseGuards(JwtAuthGuard)
  async runSavedSearch(@Param('id') id: string, @CurrentUser() user: AuthUserPayload) {
    const result = await this.savedSearchService.runSearch(id, user.sub);

    // Create alerts for matches
    if (result.newMatches.length > 0) {
      const propertyIds = result.newMatches.map((p: { id: string }) => p.id);
      await this.savedSearchAlertService.createAlertsForMatches(id, propertyIds);
    }

    return result;
  }

  /**
   * Duplicate saved search
   * POST /properties/saved-searches/:id/duplicate
   */
  @Post('saved-searches/:id/duplicate')
  @UseGuards(JwtAuthGuard)
  async duplicateSavedSearch(
    @Param('id') id: string,
    @Query('name') name?: string,
    @CurrentUser() user: AuthUserPayload,
  ): Promise<SavedSearchResponse> {
    return this.savedSearchService.duplicate(id, user.sub, name);
  }

  // ==================== Alert Endpoints ====================

  /**
   * Get un notified alerts for current user
   * GET /properties/alerts/unread
   */
  @Get('alerts/unread')
  @UseGuards(JwtAuthGuard)
  async getUnreadAlerts(@CurrentUser() user: AuthUserPayload) {
    return this.savedSearchAlertService.getUnnotifiedAlerts(user.sub);
  }

  /**
   * Mark alerts as read
   * POST /properties/alerts/mark-read
   */
  @Post('alerts/mark-read')
  @UseGuards(JwtAuthGuard)
  async markAlertsAsRead(
    @Body('alertIds') alertIds: string[],
    @CurrentUser() _user: AuthUserPayload,
  ): Promise<void> {
    return this.savedSearchAlertService.markAlertsAsNotified(alertIds);
  }

  /**
   * Get search statistics for user
   * GET /properties/search/stats
   */
  @Get('search/stats')
  @UseGuards(JwtAuthGuard)
  async getSearchStats(@CurrentUser() user: AuthUserPayload) {
    return this.savedSearchAlertService.getSearchStats(user.sub);
  }

  // ==================== Existing CRUD Methods ====================

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createPropertyDto: CreatePropertyDto, @CurrentUser() user: AuthUserPayload) {
    return this.propertiesService.create(createPropertyDto, user.sub);
  }

  @Get()
  findAll(
    @Query()
    params?: {
      skip?: number;
      take?: number;
      where?: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
    },
  ) {
    return this.propertiesService.findAll(params);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.propertiesService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updatePropertyDto: UpdatePropertyDto) {
    return this.propertiesService.update(id, updatePropertyDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.propertiesService.remove(id);
  }
}
