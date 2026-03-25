import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalRequestDto } from './dto/withdrawal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('withdrawals')
export class WithdrawalsController {
  constructor(private withdrawalsService: WithdrawalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  request(@CurrentUser() user: any, @Body() dto: WithdrawalRequestDto) {
    return this.withdrawalsService.request(user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  getMyWithdrawals(@CurrentUser() user: any) {
    return this.withdrawalsService.getMyWithdrawals(user.id);
  }

  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'finance_admin')
  getPending() {
    return this.withdrawalsService.getPending();
  }

  @Patch('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'finance_admin')
  approve(
    @Param('id') id: string,
    @CurrentUser() admin: any,
    @Body() body: { reference?: string; notes?: string },
  ) {
    return this.withdrawalsService.approve(id, admin.id, body.reference, body.notes);
  }

  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'finance_admin')
  reject(@Param('id') id: string, @CurrentUser() admin: any, @Body() body: { reason: string }) {
    return this.withdrawalsService.reject(id, admin.id, body.reason);
  }

  @Patch('admin/:id/process')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'finance_admin')
  markProcessed(
    @Param('id') id: string,
    @CurrentUser() admin: any,
    @Body() body: { reference_number?: string; notes?: string; transfer_confirmation_url?: string },
  ) {
    return this.withdrawalsService.markProcessed(id, admin.id, {
      reference_number: body.reference_number,
      notes: body.notes,
      transfer_confirmation_url: body.transfer_confirmation_url,
    });
  }
}
