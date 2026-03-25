import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('disputes')
export class DisputesController {
  constructor(private disputesService: DisputesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  open(@CurrentUser() user: any, @Body() dto: any) {
    return this.disputesService.open(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'support_admin')
  findAll(@Query() query: any) {
    return this.disputesService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMy(@CurrentUser() user: any) {
    return this.disputesService.findMy(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.disputesService.findOne(id, user.id, user.role);
  }

  @Patch(':id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'super_admin', 'support_admin')
  resolve(@Param('id') id: string, @CurrentUser() admin: any, @Body() dto: any) {
    return this.disputesService.resolve(id, admin.id, dto);
  }
}
