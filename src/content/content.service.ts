import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  // Pages
  updatePage(slug: string, data: { title: string; content: string }) {
    return this.prisma.page.upsert({
      where: { slug },
      update: data,
      create: { slug, ...data },
    });
  }

  getPage(slug: string) {
    return this.prisma.page.findUnique({ where: { slug } });
  }

  createBanner(data: { imageUrl: string; link?: string }) {
    return this.prisma.banner.create({ data });
  }

  getBanners() {
    return this.prisma.banner.findMany();
  }

  createFAQ(data: { question: string; answer: string }) {
    return this.prisma.fAQ.create({ data });
  }

  getFAQs() {
    return this.prisma.fAQ.findMany();
  }

  updateLegal(type: string, content: string) {
    return this.prisma.legal.upsert({
      where: { type },
      update: { content },
      create: { type, content },
    });
  }

  getLegal(type: string) {
    return this.prisma.legal.findUnique({ where: { type } });
  }
}