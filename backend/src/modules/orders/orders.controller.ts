import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto, DeliverOrderDto, RevisionOrderDto, CancelOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyOrders(@CurrentUser() user: any) {
    return this.ordersService.getMyOrders(user.id, user.role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.findOne(id, user.id);
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard)
  deliver(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: DeliverOrderDto) {
    return this.ordersService.deliver(id, user.id, dto);
  }

  @Patch(':id/complete')
  @UseGuards(JwtAuthGuard)
  complete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.complete(id, user.id);
  }

  @Patch(':id/revision')
  @UseGuards(JwtAuthGuard)
  revision(@Param('id') id: string, @CurrentUser() user: any, @Body() body: RevisionOrderDto) {
    return this.ordersService.requestRevision(id, user.id, body.note);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @CurrentUser() user: any, @Body() body: CancelOrderDto) {
    return this.ordersService.cancel(id, user.id, body.reason);
  }
}
