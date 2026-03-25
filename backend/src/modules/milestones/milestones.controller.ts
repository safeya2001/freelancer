import { Controller, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('milestones')
export class MilestonesController {
  constructor(private milestonesService: MilestonesService) {}

  @Patch(':id/start')
  @UseGuards(JwtAuthGuard)
  start(@Param('id') id: string, @CurrentUser() user: any) {
    return this.milestonesService.startMilestone(id, user.id);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard)
  submit(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.milestonesService.submit(id, user.id, dto);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard)
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.milestonesService.approve(id, user.id);
  }

  @Patch(':id/revision')
  @UseGuards(JwtAuthGuard)
  requestRevision(@Param('id') id: string, @CurrentUser() user: any, @Body() body: { note: string }) {
    return this.milestonesService.requestRevision(id, user.id, body.note);
  }
}
