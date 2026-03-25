import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('contracts')
export class ContractsController {
  constructor(private contractsService: ContractsService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyContracts(@CurrentUser() user: any) {
    return this.contractsService.getMyContracts(user.id, user.role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contractsService.findOne(id, user.id);
  }

  @Post(':id/milestones')
  @UseGuards(JwtAuthGuard)
  addMilestone(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.contractsService.addMilestone(id, user.id, dto);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard)
  complete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.contractsService.complete(id, user.id);
  }
}
