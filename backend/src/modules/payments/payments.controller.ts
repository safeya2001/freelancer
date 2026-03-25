import {
  Controller, Post, Get, Body, Param, Req, Headers,
  RawBodyRequest, UseGuards, HttpCode,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InitiateLocalPaymentDto } from './dto/initiate-local.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ─── LOCAL / COD ──────────────────────────────────────────────
  @Post('initiate-local')
  @UseGuards(JwtAuthGuard)
  initiateLocal(@CurrentUser() user: any, @Body() dto: InitiateLocalPaymentDto) {
    return this.paymentsService.initiateLocalPayment(user.id, {
      order_id:        dto.order_id,
      milestone_id:    dto.milestone_id,
      payment_method:  dto.payment_method,
      user_reference:  (dto as any).user_reference,
      proof_image_url: (dto as any).proof_image_url,
    });
  }

  @Get('admin/pending-deposits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'finance_admin')
  adminPendingDeposits() {
    return this.paymentsService.adminGetPendingDeposits();
  }

  @Post('admin/confirm/:txId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin', 'finance_admin')
  adminConfirm(@Param('txId') txId: string, @CurrentUser() user: any) {
    return this.paymentsService.adminConfirmPayment(txId, user.id);
  }

  @Get('my-pending')
  @UseGuards(JwtAuthGuard)
  getMyPending(@CurrentUser() user: any) {
    return this.paymentsService.getMyPending(user.id);
  }

  // ─── CHECKOUT ────────────────────────────────────────────────
  @Post('checkout/order')
  @UseGuards(JwtAuthGuard)
  createGigCheckout(
    @CurrentUser() user: any,
    @Body() dto: { order_id: string },
  ) {
    return this.paymentsService.createGigCheckout(user.id, dto);
  }

  @Post('checkout/milestone')
  @UseGuards(JwtAuthGuard)
  createMilestoneCheckout(
    @CurrentUser() user: any,
    @Body() dto: { milestone_id: string },
  ) {
    return this.paymentsService.createMilestoneCheckout(user.id, dto);
  }

  // ─── STRIPE WEBHOOK ──────────────────────────────────────────
  // NO JWT — Stripe calls this directly with raw body for sig verification
  @Post('webhook')
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<any>,
    @Headers('stripe-signature') sig: string,
  ) {
    return this.paymentsService.handleWebhook(req.rawBody, sig);
  }

  // ─── ADMIN: ISSUE REFUND ─────────────────────────────────────
  @Post('refund/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'finance_admin')
  issueRefund(@Param('orderId') orderId: string) {
    return this.paymentsService.issueStripeRefund(orderId);
  }

  // ─── TRANSACTIONS ────────────────────────────────────────────
  @Get('transactions')
  @UseGuards(JwtAuthGuard)
  getMyTransactions(@CurrentUser() user: any) {
    return this.paymentsService.getMyTransactions(user.id);
  }

  @Get('transactions/:id')
  @UseGuards(JwtAuthGuard)
  getTransaction(@Param('id') id: string, @CurrentUser() user: any) {
    return this.paymentsService.getTransactionById(id, user.id);
  }
}
