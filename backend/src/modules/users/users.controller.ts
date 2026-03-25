import {
  Controller, Get, Patch, Post, Delete, Body, Param,
  UseGuards, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me/profile')
  @UseGuards(JwtAuthGuard)
  getMyProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.id);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string) {
    return this.usersService.getProfile(id);
  }

  @Patch('me/profile')
  @UseGuards(JwtAuthGuard)
  updateProfile(@CurrentUser() user: any, @Body() dto: any) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  updateAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    const avatarUrl = `/uploads/${file.filename}`;
    return this.usersService.updateAvatar(user.id, avatarUrl);
  }

  @Patch('me/skills')
  @UseGuards(JwtAuthGuard)
  updateSkills(@CurrentUser() user: any, @Body() body: { skills: { skill_id: string; level: string }[] }) {
    return this.usersService.updateSkills(user.id, body.skills);
  }

  @Post('me/portfolio')
  @UseGuards(JwtAuthGuard)
  addPortfolio(@CurrentUser() user: any, @Body() body: any) {
    return this.usersService.addPortfolioItem(user.id, body);
  }

  @Delete('me/portfolio/:itemId')
  @UseGuards(JwtAuthGuard)
  deletePortfolio(@CurrentUser() user: any, @Param('itemId') itemId: string) {
    return this.usersService.deletePortfolioItem(user.id, itemId);
  }

  @Post('me/identity')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('document'))
  uploadIdentity(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    const fileUrl = `/uploads/${file.filename}`;
    return this.usersService.uploadIdentityDoc(user.id, fileUrl);
  }

  @Get('me/wallet')
  @UseGuards(JwtAuthGuard)
  getWallet(@CurrentUser() user: any) {
    return this.usersService.getWallet(user.id);
  }

  @Get('categories')
  getCategories() {
    return this.usersService.getCategories();
  }

  @Get('skills/list')
  getSkills() {
    return this.usersService.getSkillsList();
  }
}
