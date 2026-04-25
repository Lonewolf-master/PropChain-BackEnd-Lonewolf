import { Controller, Get } from '@nestjs/common';
import { EmailReportService } from './email-report.service';

@Controller('emails')
export class EmailController {
  constructor(private readonly reportService: EmailReportService) {}

  @Get('reports')
  async getReports() {
    return this.reportService.getMetrics();
  }
}
