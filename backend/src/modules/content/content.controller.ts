import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ContentService } from './content.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('content')
export class ContentController {
  constructor(private content: ContentService) {}

  // ─── PUBLIC (no auth) ────────────────────────────────────────
  @Get('banners')
  getBanners(@Query('admin') admin?: string) {
    return this.content.getBanners(admin !== '1');
  }

  @Get('faq')
  getFaq() {
    return this.content.getFaq();
  }

  @Get('pages/:key')
  getPage(@Param('key') key: string) {
    return this.content.getPage(key);
  }

  @Get('platform-stats')
  getPlatformStats() {
    return this.content.platformStats();
  }

  // ─── ADMIN ONLY ──────────────────────────────────────────────
  @Post('banners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  createBanner(@Body() dto: any) {
    return this.content.createBanner(dto);
  }

  @Patch('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  updateBanner(@Param('id') id: string, @Body() dto: any) {
    return this.content.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  deleteBanner(@Param('id') id: string) {
    return this.content.deleteBanner(id);
  }

  @Post('faq')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  createFaq(@Body() dto: any) {
    return this.content.createFaq(dto);
  }

  @Patch('faq/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  updateFaq(@Param('id') id: string, @Body() dto: any) {
    return this.content.updateFaq(id, dto);
  }

  @Delete('faq/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  deleteFaq(@Param('id') id: string) {
    return this.content.deleteFaq(id);
  }

  @Patch('pages/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'admin')
  updatePage(@Param('key') key: string, @Body() body: { content: string }, @CurrentUser() user: any) {
    return this.content.updatePage(key, body.content, user.id);
  }
}
