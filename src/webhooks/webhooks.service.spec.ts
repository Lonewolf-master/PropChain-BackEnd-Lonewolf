import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { WebhookEventType, WebhookDeliveryStatus } from '@prisma/client';

const mockPrisma = {
  webhook: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  webhookDelivery: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
};

describe('WebhooksService', () => {
  let service: WebhooksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a webhook with a generated secret', async () => {
      const dto = { url: 'https://example.com/hook', eventTypes: [WebhookEventType.PROPERTY_CREATED] };
      mockPrisma.webhook.create.mockResolvedValue({ id: '1', ...dto, secret: 'abc', isActive: true });
      const result = await service.create('user-1', dto as any);
      expect(mockPrisma.webhook.create).toHaveBeenCalledTimes(1);
      const callArgs = mockPrisma.webhook.create.mock.calls[0][0];
      expect(callArgs.data.secret).toBeDefined();
      expect(callArgs.data.secret).toHaveLength(64);
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all webhooks for a user', async () => {
      mockPrisma.webhook.findMany.mockResolvedValue([{ id: '1' }, { id: '2' }]);
      const result = await service.findAll('user-1');
      expect(result).toHaveLength(2);
      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a webhook if found', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue({ id: '1' });
      const result = await service.findOne('1', 'user-1');
      expect(result).toEqual({ id: '1' });
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue(null);
      await expect(service.findOne('bad-id', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.webhook.update.mockResolvedValue({ id: '1', isActive: false });
      const result = await service.update('1', 'user-1', { isActive: false });
      expect(mockPrisma.webhook.update).toHaveBeenCalledTimes(1);
      expect(result.isActive).toBe(false);
    });
  });

  describe('remove', () => {
    it('should delete a webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue({ id: '1' });
      mockPrisma.webhook.delete.mockResolvedValue({ id: '1' });
      const result = await service.remove('1', 'user-1');
      expect(result).toEqual({ message: 'Webhook deleted successfully' });
    });
  });

  describe('trigger', () => {
    it('should create a delivery for each matching active webhook', async () => {
      mockPrisma.webhook.findMany.mockResolvedValue([
        { id: 'wh-1', url: 'https://example.com', secret: 'sec', eventTypes: [WebhookEventType.PROPERTY_CREATED] },
      ]);
      mockPrisma.webhookDelivery.create.mockResolvedValue({ id: 'del-1' });
      mockPrisma.webhookDelivery.update.mockResolvedValue({});

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      await service.trigger(WebhookEventType.PROPERTY_CREATED, { event: 'PROPERTY_CREATED', data: {} });
      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDeliveries', () => {
    it('should return deliveries for a webhook', async () => {
      mockPrisma.webhook.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockPrisma.webhookDelivery.findMany.mockResolvedValue([{ id: 'del-1', status: WebhookDeliveryStatus.SUCCESS }]);
      const result = await service.getDeliveries('wh-1', 'user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('retryFailedDeliveries', () => {
    it('should retry due failed deliveries', async () => {
      mockPrisma.webhookDelivery.findMany.mockResolvedValue([
        {
          id: 'del-1',
          attempts: 1,
          payload: { event: 'PROPERTY_CREATED' },
          webhook: { id: 'wh-1', url: 'https://example.com', secret: 'sec' },
        },
      ]);
      mockPrisma.webhookDelivery.update.mockResolvedValue({});

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      await service.retryFailedDeliveries();
      expect(mockPrisma.webhookDelivery.update).toHaveBeenCalled();
    });
  });
});