import { Controller, Get, Post, Patch, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProposalDto, RejectProposalDto } from './dto/create-proposal.dto';

@Controller('proposals')
export class ProposalsController {
  constructor(private proposalsService: ProposalsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  submit(@CurrentUser() user: any, @Body() dto: CreateProposalDto) {
    return this.proposalsService.submit(user.id, dto);
  }

  @Get('project/:projectId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  getProjectProposals(@Param('projectId') projectId: string, @CurrentUser() user: any) {
    return this.proposalsService.getProjectProposals(projectId, user.id);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  getMyProposals(@CurrentUser() user: any) {
    return this.proposalsService.getMyProposals(user.id);
  }

  @Patch(':id/accept')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proposalsService.accept(id, user.id);
  }

  @Patch(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  reject(@Param('id') id: string, @CurrentUser() user: any, @Body() body: RejectProposalDto) {
    return this.proposalsService.reject(id, user.id, body.reason);
  }

  @Patch(':id/withdraw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  withdraw(@Param('id') id: string, @CurrentUser() user: any) {
    return this.proposalsService.withdraw(id, user.id);
  }
}
