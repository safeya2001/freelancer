import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('reviews')
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post('order')
  @UseGuards(JwtAuthGuard)
  createForOrder(@CurrentUser() user: any, @Body() dto: any) {
    return this.reviewsService.createForOrder(user.id, dto);
  }

  @Post('contract/:contractId')
  @UseGuards(JwtAuthGuard)
  createForContract(@CurrentUser() user: any, @Param('contractId') contractId: string, @Body() dto: any) {
    return this.reviewsService.createForContract(user.id, contractId, dto);
  }

  @Get('freelancer/:id')
  getFreelancerReviews(@Param('id') id: string) {
    return this.reviewsService.getFreelancerReviews(id);
  }
}
