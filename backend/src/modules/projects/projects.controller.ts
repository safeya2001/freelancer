import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProjectDto, UpdateProjectDto, ProjectQueryDto } from './dto/create-project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  create(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get()
  findAll(@Query() query: ProjectQueryDto) {
    return this.projectsService.findAll(query);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  getMyProjects(@CurrentUser() user: any) {
    return this.projectsService.getMyProjects(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, user.id, dto);
  }

  @Delete(':id/close')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('client')
  close(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectsService.close(id, user.id);
  }
}
