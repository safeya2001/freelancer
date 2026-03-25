import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class TicketsService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  async create(userId: string, dto: any) {
    const [ticket] = await this.sql`
      INSERT INTO support_tickets (user_id, subject_en, subject_ar, body_en, body_ar, attachment_urls, priority)
      VALUES (${userId}, ${dto.subject_en}, ${dto.subject_ar ?? null},
              ${dto.body_en}, ${dto.body_ar ?? null},
              ${dto.attachment_urls ?? []}, ${dto.priority ?? 'medium'})
      RETURNING *
    `;
    return ticket;
  }

  async getMyTickets(userId: string) {
    return this.sql`
      SELECT * FROM support_tickets WHERE user_id = ${userId} ORDER BY created_at DESC
    `;
  }

  async findOne(id: string, userId: string, userRole: string) {
    const [ticket] = await this.sql`SELECT * FROM support_tickets WHERE id = ${id}`;
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isAdmin = ['admin', 'super_admin', 'support_admin'].includes(userRole);
    if (ticket.user_id !== userId && !isAdmin) throw new ForbiddenException('Access denied');

    const replies = await this.sql`
      SELECT r.*, p.full_name_en AS sender_name, p.avatar_url AS sender_avatar, u.role AS sender_role
      FROM ticket_replies r
      JOIN users u ON u.id = r.sender_id
      JOIN profiles p ON p.user_id = r.sender_id
      WHERE r.ticket_id = ${id} AND (r.is_internal = false OR ${isAdmin} = true)
      ORDER BY r.created_at ASC
    `;

    return { ...ticket, replies };
  }

  async reply(ticketId: string, senderId: string, userRole: string, dto: any) {
    const [ticket] = await this.sql`SELECT * FROM support_tickets WHERE id = ${ticketId}`;
    if (!ticket) throw new NotFoundException('Ticket not found');

    const isAdmin = ['admin', 'super_admin', 'support_admin'].includes(userRole);
    if (ticket.user_id !== senderId && !isAdmin) throw new ForbiddenException('Access denied');

    const [reply] = await this.sql`
      INSERT INTO ticket_replies (ticket_id, sender_id, body, attachment_urls, is_internal)
      VALUES (${ticketId}, ${senderId}, ${dto.body}, ${dto.attachment_urls ?? []}, ${dto.is_internal ?? false})
      RETURNING *
    `;

    // Update ticket status if admin replied
    if (isAdmin && ticket.status === 'open') {
      await this.sql`UPDATE support_tickets SET status = 'in_progress' WHERE id = ${ticketId}`;
    }

    return reply;
  }

  // Admin methods
  async getAllTickets(query: any) {
    const { status, priority, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;
    return this.sql`
      SELECT t.*, p.full_name_en AS user_name, u.email AS user_email
      FROM support_tickets t
      JOIN users u ON u.id = t.user_id
      JOIN profiles p ON p.user_id = t.user_id
      WHERE (${status ?? null} IS NULL OR t.status = ${status ?? null})
        AND (${priority ?? null} IS NULL OR t.priority = ${priority ?? null})
      ORDER BY
        CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async updateStatus(ticketId: string, status: string) {
    await this.sql`
      UPDATE support_tickets SET status = ${status},
        resolved_at = CASE WHEN ${status} = 'resolved' THEN NOW() ELSE resolved_at END
      WHERE id = ${ticketId}
    `;
    return { message: 'Ticket status updated' };
  }
}
