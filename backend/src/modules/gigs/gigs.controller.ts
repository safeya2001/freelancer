import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { GigsService } from './gigs.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateGigDto, UpdateGigDto, GigQueryDto } from './dto/create-gig.dto';

@Controller('gigs')
export class GigsController {
  constructor(private gigsService: GigsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  create(@CurrentUser() user: any, @Body() dto: CreateGigDto) {
    return this.gigsService.create(user.id, dto);
  }

  @Get()
  findAll(@Query() query: GigQueryDto) {
    return this.gigsService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  getMyGigs(@CurrentUser() user: any) {
    return this.gigsService.getMyGigs(user.id);
  }

  @Get('freelancer/:userId')
  getByFreelancer(@Param('userId') userId: string) {
    return this.gigsService.getByFreelancer(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gigsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateGigDto) {
    return this.gigsService.update(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('freelancer')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.gigsService.delete(id, user.id);
  }
}
