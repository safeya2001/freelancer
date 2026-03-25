import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class ChatService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  async getRoom(roomId: string, userId: string) {
    const [room] = await this.sql`
      SELECT * FROM chat_rooms WHERE id = ${roomId}
    `;
    if (!room) throw new NotFoundException('Chat room not found');
    if (room.client_id !== userId && room.freelancer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return room;
  }

  async getMessages(roomId: string, userId: string, page = 1, limit = 50) {
    await this.getRoom(roomId, userId);
    const offset = (page - 1) * limit;

    return this.sql`
      SELECT m.id, m.body, m.file_urls, m.file_names, m.read_by, m.created_at,
             m.sender_id, p.full_name_en AS sender_name, p.avatar_url AS sender_avatar
      FROM messages m
      JOIN profiles p ON p.user_id = m.sender_id
      WHERE m.room_id = ${roomId} AND m.is_deleted = false
      ORDER BY m.created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async saveMessage(roomId: string, senderId: string, body: string, fileUrls?: string[], fileNames?: string[]) {
    const [msg] = await this.sql`
      INSERT INTO messages (room_id, sender_id, body, file_urls, file_names, read_by)
      VALUES (${roomId}, ${senderId}, ${body ?? null}, ${fileUrls ?? []}, ${fileNames ?? []}, ARRAY[${senderId}]::uuid[])
      RETURNING *
    `;
    return msg;
  }

  async markRead(roomId: string, userId: string) {
    await this.sql`
      UPDATE messages SET
        read_by = ARRAY(SELECT DISTINCT unnest(read_by || ARRAY[${userId}]::uuid[]))
      WHERE room_id = ${roomId} AND NOT (${userId}::uuid = ANY(read_by))
    `;
    return { ok: true };
  }

  async deleteMessage(messageId: string, userId: string) {
    const [msg] = await this.sql`SELECT sender_id FROM messages WHERE id = ${messageId}`;
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.sender_id !== userId) throw new ForbiddenException('Cannot delete another user\'s message');
    await this.sql`UPDATE messages SET is_deleted = true, body = null WHERE id = ${messageId}`;
    return { ok: true };
  }

  // ─── Get or create a proposal-linked room (Interview phase) ──
  async getOrCreateProposalRoom(proposalId: string, requestingUserId: string) {
    // Fetch proposal with project + freelancer info
    const [proposal] = await this.sql`
      SELECT p.id, p.freelancer_id, p.project_id,
             proj.client_id, proj.title_en AS project_title
      FROM proposals p
      JOIN projects proj ON proj.id = p.project_id
      WHERE p.id = ${proposalId}
    `;
    if (!proposal) throw new NotFoundException('Proposal not found');

    // Only the client or freelancer of this proposal may open the chat
    if (proposal.client_id !== requestingUserId && proposal.freelancer_id !== requestingUserId) {
      throw new ForbiddenException('Access denied');
    }

    // Return existing room if already created
    const [existing] = await this.sql`
      SELECT id FROM chat_rooms WHERE proposal_id = ${proposalId}
    `;
    if (existing) return { room_id: existing.id, project_title: proposal.project_title };

    // Create new room
    const [room] = await this.sql`
      INSERT INTO chat_rooms (proposal_id, client_id, freelancer_id)
      VALUES (${proposalId}, ${proposal.client_id}, ${proposal.freelancer_id})
      RETURNING id
    `;
    return { room_id: room.id, project_title: proposal.project_title };
  }

  // ─── List user's rooms with context grouping info ─────────────
  async getUserRooms(userId: string) {
    return this.sql`
      SELECT
        cr.id,
        cr.order_id,
        cr.contract_id,
        cr.proposal_id,
        cr.created_at,
        cp.full_name_en  AS client_name,
        cp.avatar_url    AS client_avatar,
        fp.full_name_en  AS freelancer_name,
        fp.avatar_url    AS freelancer_avatar,

        -- Context type: interview | contract | order
        CASE
          WHEN cr.proposal_id IS NOT NULL THEN 'interview'
          WHEN cr.contract_id IS NOT NULL THEN 'contract'
          WHEN cr.order_id    IS NOT NULL THEN 'order'
        END AS context_type,

        -- Human-readable context title (project name or gig title)
        COALESCE(
          (SELECT proj.title_en
           FROM proposals prop
           JOIN projects proj ON proj.id = prop.project_id
           WHERE prop.id = cr.proposal_id),
          (SELECT proj.title_en
           FROM contracts c
           JOIN projects proj ON proj.id = c.project_id
           WHERE c.id = cr.contract_id),
          (SELECT g.title_en
           FROM orders o
           JOIN gigs g ON g.id = o.gig_id
           WHERE o.id = cr.order_id)
        ) AS context_title,

        -- Last message preview
        (SELECT body
         FROM messages
         WHERE room_id = cr.id AND is_deleted = false
         ORDER BY created_at DESC LIMIT 1) AS last_message,

        (SELECT created_at
         FROM messages
         WHERE room_id = cr.id
         ORDER BY created_at DESC LIMIT 1) AS last_message_at,

        -- Unread count for this user
        (SELECT COUNT(*)
         FROM messages
         WHERE room_id = cr.id
           AND NOT (${userId}::uuid = ANY(read_by))
           AND sender_id != ${userId}) AS unread_count

      FROM chat_rooms cr
      JOIN profiles cp ON cp.user_id = cr.client_id
      JOIN profiles fp ON fp.user_id = cr.freelancer_id
      WHERE cr.client_id = ${userId} OR cr.freelancer_id = ${userId}
      ORDER BY last_message_at DESC NULLS LAST
    `;
  }
}
