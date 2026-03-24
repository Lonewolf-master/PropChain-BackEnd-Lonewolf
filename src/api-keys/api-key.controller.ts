import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiKeyService, RotationStatus, RotationResult } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';
import { ApiKeyResponseDto, CreateApiKeyResponseDto } from './dto/api-key-response.dto';
import { PaginationQueryDto, PaginatedResponseDto } from '../common/pagination';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('API Keys')
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new API key',
    description: 'Generate a new API key for external service integration. The full key is only shown once.',
  })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully',
    type: CreateApiKeyResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid scopes provided' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createApiKeyDto: CreateApiKeyDto): Promise<CreateApiKeyResponseDto> {
    return this.apiKeyService.create(createApiKeyDto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all API keys',
    description: 'Retrieve all API keys with pagination support and partial key display',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys retrieved successfully',
    schema: {
      properties: {
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/ApiKeyResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            pages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query() paginationQuery: PaginationQueryDto,
  ): Promise<ApiKeyResponseDto[] | PaginatedResponseDto<ApiKeyResponseDto>> {
    return this.apiKeyService.findAll(paginationQuery);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get API key details',
    description: 'Retrieve details of a specific API key by ID',
  })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'API key details retrieved successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(@Param('id') id: string): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update API key',
    description: 'Update API key settings (name, scopes, rate limit)',
  })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'API key updated successfully',
    type: ApiKeyResponseDto,
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async update(@Param('id') id: string, @Body() updateApiKeyDto: UpdateApiKeyDto): Promise<ApiKeyResponseDto> {
    return this.apiKeyService.update(id, updateApiKeyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke API key',
    description: 'Revoke (soft delete) an API key, making it inactive',
  })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({ status: 204, description: 'API key revoked successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revoke(@Param('id') id: string): Promise<void> {
    return this.apiKeyService.revoke(id);
  }

  // ==================== ROTATION ENDPOINTS ====================

  @Post(':id/rotate')
  @ApiOperation({
    summary: 'Rotate API key',
    description: 'Generate a new API key and deactivate the old one. The new key is shown only once.',
  })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'API key rotated successfully',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 400, description: 'Cannot rotate a revoked API key' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async rotateKey(@Param('id') id: string): Promise<RotationResult> {
    return this.apiKeyService.rotateKey(id);
  }

  @Get(':id/rotation-status')
  @ApiOperation({
    summary: 'Get rotation status',
    description: 'Check if an API key requires rotation and when it was last rotated',
  })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({
    status: 200,
    description: 'Rotation status retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRotationStatus(@Param('id') id: string): Promise<RotationStatus> {
    return this.apiKeyService.getRotationStatus(id);
  }

  @Get('rotation/required')
  @ApiOperation({
    summary: 'Get keys requiring rotation',
    description: 'List all API keys that have passed their rotation due date',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys requiring rotation',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getKeysRequiringRotation(): Promise<RotationStatus[]> {
    return this.apiKeyService.getKeysRequiringRotation();
  }

  @Get('rotation/approaching')
  @ApiOperation({
    summary: 'Get keys approaching rotation',
    description: 'List all API keys that will require rotation within the warning period',
  })
  @ApiResponse({
    status: 200,
    description: 'List of API keys approaching rotation',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getKeysApproachingRotation(): Promise<RotationStatus[]> {
    return this.apiKeyService.getKeysApproachingRotation();
  }

  // ==================== ANALYTICS ENDPOINTS ====================

  @Get(':id/analytics')
  @ApiOperation({
    summary: 'Get API key usage analytics',
    description: 'Retrieve detailed usage analytics for a specific API key',
  })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiQuery({ name: 'startDate', description: 'Start date (ISO 8601)', example: '2026-01-01T00:00:00Z' })
  @ApiQuery({ name: 'endDate', description: 'End date (ISO 8601)', example: '2026-01-31T23:59:59Z' })
  @ApiResponse({
    status: 200,
    description: 'Usage analytics retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsageAnalytics(
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.apiKeyService.getUsageAnalytics(id, new Date(startDate), new Date(endDate));
  }
}
