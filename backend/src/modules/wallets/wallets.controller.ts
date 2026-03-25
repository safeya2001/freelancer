import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('wallets')
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyWallet(@CurrentUser() user: any) {
    return this.walletsService.getMyWallet(user.id);
  }

  @Get('me/transactions')
  @UseGuards(JwtAuthGuard)
  getMyTransactions(
    @CurrentUser() user: any,
    @Query('limit')  limit  = '50',
    @Query('offset') offset = '0',
  ) {
    return this.walletsService.getMyTransactions(user.id, +limit, +offset);
  }

  @Get('me/escrows')
  @UseGuards(JwtAuthGuard)
  getMyEscrows(@CurrentUser() user: any) {
    return this.walletsService.getMyEscrows(user.id);
  }

  // ─── ADMIN ───────────────────────────────────────────────────
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'finance_admin')
  getAllWallets() {
    return this.walletsService.getAllWallets();
  }

  @Get('admin/revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'finance_admin')
  getPlatformRevenue() {
    return this.walletsService.getPlatformRevenue();
  }
}
