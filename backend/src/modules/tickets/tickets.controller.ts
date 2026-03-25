import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: any, @Body() dto: any) {
    return this.ticketsService.create(user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyTickets(@CurrentUser() user: any) {
    return this.ticketsService.getMyTickets(user.id);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'support_admin')
  getAllTickets(@Query() query: any) {
    return this.ticketsService.getAllTickets(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ticketsService.findOne(id, user.id, user.role);
  }

  @Post(':id/reply')
  @UseGuards(JwtAuthGuard)
  reply(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.ticketsService.reply(id, user.id, user.role, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'support_admin')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.ticketsService.updateStatus(id, body.status);
  }
}
