import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Res, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { AdminService } from './admin.service';
import { PaymentsService } from '../payments/payments.service';
import { DocumentsService } from '../documents/documents.service';
import { ReportsService } from '../reports/reports.service';
import { EscrowService } from '../escrow/escrow.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'super_admin', 'finance_admin', 'support_admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private paymentsService: PaymentsService,
    private documentsService: DocumentsService,
    private reportsService: ReportsService,
    private escrowService: EscrowService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getPlatformStats();
  }

  @Get('users')
  getUsers(@Query() query: any) {
    return this.adminService.getUsers(query);
  }

  @Patch('users/:id/status')
  @Roles('admin', 'super_admin')
  updateUserStatus(@Param('id') id: string, @Body() body: { status: string }, @CurrentUser() admin: any) {
    return this.adminService.updateUserStatus(id, body.status, admin.id);
  }

  @Patch('users/:id/verify-identity')
  @Roles('admin', 'super_admin')
  verifyIdentity(@Param('id') id: string, @Body() body: { status: string; reason?: string }, @CurrentUser() admin: any) {
    return this.adminService.verifyFreelancerIdentity(id, body.status, admin.id, body.reason);
  }

  @Patch('users/:id/verify-phone')
  @Roles('admin', 'super_admin', 'support_admin')
  manualVerifyPhone(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.adminService.manualVerifyPhone(id, admin.id);
  }

  @Get('gigs')
  getGigs(@Query() query: any) {
    return this.adminService.getGigs(query);
  }

  @Patch('gigs/:id/status')
  @Roles('admin', 'super_admin')
  updateGigStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.adminService.updateGigStatus(id, body.status);
  }

  @Get('projects')
  getProjects(@Query() query: any) {
    return this.adminService.getProjects(query);
  }

  @Patch('projects/:id/cancel')
  @Roles('admin', 'super_admin')
  cancelProject(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.adminService.cancelProject(id, admin.id);
  }

  @Get('contracts')
  getContracts(@Query() query: any) {
    return this.adminService.getContracts(query);
  }

  @Get('contracts/:id/milestones')
  getContractMilestones(@Param('id') id: string) {
    return this.adminService.getContractMilestones(id);
  }

  @Get('transactions')
  getTransactions(@Query() query: any) {
    return this.adminService.getTransactions(query);
  }

  @Patch('transactions/:id/confirm')
  @Roles('super_admin', 'finance_admin')
  confirmPayment(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.paymentsService.adminConfirmPayment(id, admin.id);
  }

  // ─── KYC QUEUE ───────────────────────────────────────────────
  @Get('kyc')
  getKycQueue() {
    return this.adminService.getKycQueue();
  }

  // ─── FINANCE OVERVIEW ────────────────────────────────────────
  @Get('finance/overview')
  @Roles('super_admin', 'finance_admin', 'admin')
  getFinanceOverview() {
    return this.adminService.getFinanceOverview();
  }

  // ─── DISPUTES ────────────────────────────────────────────────
  @Get('disputes')
  getAllDisputes(@Query() query: any) {
    return this.adminService.getAllDisputes(query);
  }

  @Get('disputes/:id')
  getDisputeDetail(@Param('id') id: string) {
    return this.adminService.getDisputeDetail(id);
  }

  @Patch('disputes/:id/resolve')
  @Roles('admin', 'super_admin', 'support_admin')
  resolveDispute(
    @Param('id') id: string,
    @CurrentUser() admin: any,
    @Body() body: {
      resolution: 'release_to_freelancer' | 'refund_to_client' | 'partial_split';
      note: string;
      client_pct?: number;
      freelancer_pct?: number;
    },
  ) {
    return this.adminService.resolveDispute(id, admin.id, body, this.escrowService);
  }

  @Post('notifications/broadcast')
  @Roles('super_admin', 'admin')
  broadcastNotification(@Body() body: { title_en: string; title_ar: string; body_en: string; body_ar: string; target: 'all' | 'clients' | 'freelancers' }) {
    return this.adminService.broadcastNotification(body);
  }

  @Get('reports/payments')
  @Roles('super_admin', 'finance_admin')
  async getPaymentsReport(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('format') format: 'pdf' | 'excel' = 'pdf',
    @Res() res: Response,
  ) {
    if (!from || !to) {
      throw new BadRequestException('Query from and to are required (YYYY-MM-DD)');
    }
    const buffer = await this.reportsService.getPaymentReport(from, to, format);
    const contentType = format === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf';
    const ext = format === 'excel' ? 'xlsx' : 'pdf';
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="payments-report-${from}-${to}.${ext}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('documents/payment-proof/:transactionId')
  @Roles('super_admin', 'finance_admin', 'admin')
  async getAdminPaymentProof(
    @Param('transactionId') transactionId: string,
    @CurrentUser() admin: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.documentsService.generatePaymentProofForAdmin(transactionId, admin.id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="payment-proof-${transactionId.slice(0, 8)}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }

  @Get('audit-logs')
  @Roles('super_admin')
  getAuditLogs(@Query() query: any) {
    return this.adminService.getAuditLogs(query);
  }

  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings/:key')
  @Roles('super_admin')
  updateSetting(@Param('key') key: string, @Body() body: { value: string }, @CurrentUser() admin: any) {
    return this.adminService.updateSetting(key, body.value, admin.id);
  }

  // ─── CATEGORIES CRUD ─────────────────────────────────────────
  @Get('categories')
  getCategories() {
    return this.adminService.getCategories();
  }

  @Post('categories')
  @Roles('super_admin', 'admin')
  createCategory(@Body() body: any) {
    return this.adminService.createCategory(body);
  }

  @Patch('categories/:id')
  @Roles('super_admin', 'admin')
  updateCategory(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @Roles('super_admin')
  deleteCategory(@Param('id') id: string) {
    return this.adminService.deleteCategory(id);
  }

  // ─── SKILLS CRUD ─────────────────────────────────────────────
  @Get('skills')
  getSkills() {
    return this.adminService.getSkills();
  }

  @Post('skills')
  @Roles('super_admin', 'admin')
  createSkill(@Body() body: any) {
    return this.adminService.createSkill(body);
  }

  @Patch('skills/:id')
  @Roles('super_admin', 'admin')
  updateSkill(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateSkill(id, body);
  }

  @Delete('skills/:id')
  @Roles('super_admin')
  deleteSkill(@Param('id') id: string) {
    return this.adminService.deleteSkill(id);
  }
}
