import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatService } from './chat.service';
import { Logger } from '@nestjs/common';

interface AuthSocket extends Socket {
  userId: string;
  userRole: string;
}

function getCorsOrigins(): string | string[] | RegExp {
  const prod = process.env.FRONTEND_URL;
  if (process.env.NODE_ENV !== 'production' || !prod) {
    // Allow any localhost port in development (http AND https)
    return /^https?:\/\/localhost(:\d+)?$/;
  }
  return prod;
}

@WebSocketGateway({
  cors: {
    origin: getCorsOrigins(),
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatGateway.name);

  // Map userId → socketId for online detection
  private onlineUsers = new Map<string, string>();

  constructor(
    private chatService: ChatService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // ─── CONNECTION ──────────────────────────────────────────────
  async handleConnection(socket: AuthSocket) {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) { socket.disconnect(); return; }

      const payload = this.jwt.verify(token, {
        secret: this.config.get('JWT_SECRET', 'super-secret'),
      });

      socket.userId = payload.sub;
      socket.userRole = payload.role;
      this.onlineUsers.set(payload.sub, socket.id);

      this.logger.log(`User connected: ${payload.sub}`);

      // Notify others that this user is online
      this.server.emit('user_online', { userId: payload.sub });
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthSocket) {
    if (socket.userId) {
      this.onlineUsers.delete(socket.userId);
      this.server.emit('user_offline', { userId: socket.userId });
      this.logger.log(`User disconnected: ${socket.userId}`);
    }
  }

  // ─── JOIN ROOM ───────────────────────────────────────────────
  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { room_id: string },
  ) {
    try {
      await this.chatService.getRoom(data.room_id, socket.userId);
      socket.join(data.room_id);
      socket.emit('joined_room', { room_id: data.room_id });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  }

  // ─── SEND MESSAGE ────────────────────────────────────────────
  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: {
      room_id: string;
      body?: string;
      file_urls?: string[];
      file_names?: string[];
    },
  ) {
    try {
      if (!data.body && (!data.file_urls || data.file_urls.length === 0)) {
        socket.emit('error', { message: 'Message body or file required' });
        return;
      }

      const msg = await this.chatService.saveMessage(
        data.room_id, socket.userId, data.body ?? '', data.file_urls, data.file_names,
      );

      // Emit to everyone in the room
      this.server.to(data.room_id).emit('new_message', {
        ...msg,
        sender_id: socket.userId,
      });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  }

  // ─── TYPING INDICATOR ────────────────────────────────────────
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { room_id: string },
  ) {
    socket.to(data.room_id).emit('typing', { userId: socket.userId, room_id: data.room_id });
  }

  @SubscribeMessage('stop_typing')
  handleStopTyping(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { room_id: string },
  ) {
    socket.to(data.room_id).emit('stop_typing', { userId: socket.userId, room_id: data.room_id });
  }

  // ─── MARK READ ───────────────────────────────────────────────
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { room_id: string },
  ) {
    await this.chatService.markRead(data.room_id, socket.userId);
    socket.to(data.room_id).emit('messages_read', { userId: socket.userId, room_id: data.room_id });
  }

  // ─── CHECK ONLINE STATUS ─────────────────────────────────────
  @SubscribeMessage('check_online')
  handleCheckOnline(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { userId: string },
  ) {
    const isOnline = this.onlineUsers.has(data.userId);
    socket.emit('online_status', { userId: data.userId, online: isOnline });
  }
}
