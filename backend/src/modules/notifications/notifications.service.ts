import { Injectable, Inject } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

interface CreateNotificationDto {
  userId: string;
  type: string;
  title_en: string;
  title_ar: string;
  body_en?: string;
  body_ar?: string;
  entity_type?: string;
  entity_id?: string;
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  async create(dto: CreateNotificationDto) {
    const [notif] = await this.sql`
      INSERT INTO notifications (user_id, type, title_en, title_ar, body_en, body_ar, entity_type, entity_id)
      VALUES (${dto.userId}, ${dto.type}, ${dto.title_en}, ${dto.title_ar},
              ${dto.body_en ?? null}, ${dto.body_ar ?? null},
              ${dto.entity_type ?? null}, ${dto.entity_id ?? null})
      RETURNING *
    `;
    return notif;
  }

  async getForUser(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const notifications = await this.sql`
      SELECT * FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const [{ count }] = await this.sql`
      SELECT COUNT(*) FROM notifications WHERE user_id = ${userId} AND is_read = false
    `;
    return { notifications, unread_count: Number(count) };
  }

  async markRead(notificationId: string, userId: string) {
    await this.sql`
      UPDATE notifications SET is_read = true, read_at = NOW()
      WHERE id = ${notificationId} AND user_id = ${userId}
    `;
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.sql`
      UPDATE notifications SET is_read = true, read_at = NOW()
      WHERE user_id = ${userId} AND is_read = false
    `;
    return { ok: true };
  }
}
