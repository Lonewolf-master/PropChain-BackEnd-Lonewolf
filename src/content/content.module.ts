import { Module } from '@nestjs/common';
import { ContentService } from './content.service';
import { ContentController } from './content.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [ContentService, PrismaService],
  controllers: [ContentController],
})
export class ContentModule {}