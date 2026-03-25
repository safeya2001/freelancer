import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('chat')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('rooms')
  @UseGuards(JwtAuthGuard)
  getRooms(@CurrentUser() user: any) {
    return this.chatService.getUserRooms(user.id);
  }

  // ── Get or create proposal-linked room (Interview) ──────────
  @Post('rooms/proposal/:proposalId')
  @UseGuards(JwtAuthGuard)
  getOrCreateProposalRoom(
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: any,
  ) {
    return this.chatService.getOrCreateProposalRoom(proposalId, user.id);
  }

  @Get('rooms/:roomId/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(
    @Param('roomId') roomId: string,
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.chatService.getMessages(roomId, user.id, Number(page), Number(limit));
  }

  @Delete('messages/:messageId')
  @UseGuards(JwtAuthGuard)
  deleteMessage(@Param('messageId') messageId: string, @CurrentUser() user: any) {
    return this.chatService.deleteMessage(messageId, user.id);
  }
}
