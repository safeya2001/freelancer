import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class DisputesService {
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private notifications: NotificationsService,
    private email: EmailService,
  ) {}

  async open(userId: string, dto: any) {
    // Determine client/freelancer from order or contract
    let clientId: string, freelancerId: string;

    if (dto.order_id) {
      const [o] = await this.sql`SELECT client_id, freelancer_id FROM orders WHERE id = ${dto.order_id}`;
      if (!o) throw new NotFoundException('Order not found');
      clientId = o.client_id;
      freelancerId = o.freelancer_id;
    } else if (dto.contract_id) {
      const [c] = await this.sql`SELECT client_id, freelancer_id FROM contracts WHERE id = ${dto.contract_id}`;
      if (!c) throw new NotFoundException('Contract not found');
      clientId = c.client_id;
      freelancerId = c.freelancer_id;
    } else {
      throw new ForbiddenException('Must provide order_id or contract_id');
    }

    if (userId !== clientId && userId !== freelancerId) {
      throw new ForbiddenException('Access denied');
    }

    const [dispute] = await this.sql`
      INSERT INTO disputes (opened_by, client_id, freelancer_id, order_id, contract_id,
                            milestone_id, title_en, description_en, attachment_urls)
      VALUES (${userId}, ${clientId}, ${freelancerId},
              ${dto.order_id ?? null}, ${dto.contract_id ?? null}, ${dto.milestone_id ?? null},
              ${dto.title_en}, ${dto.description_en}, ${dto.attachment_urls ?? []})
      RETURNING *
    `;

    const otherUserId = userId === clientId ? freelancerId : clientId;
    await this.notifications.create({
      userId: otherUserId,
      type: 'dispute_opened',
      title_en: 'A Dispute Was Opened',
      title_ar: 'تم فتح نزاع',
      body_en: `A dispute has been opened: "${dto.title_en}"`,
      body_ar: `تم فتح نزاع: "${dto.title_en}"`,
      entity_type: 'dispute',
      entity_id: dispute.id,
    });

    // Email both parties
    const userIds = [userId, otherUserId];
    for (const uid of userIds) {
      const [u] = await this.sql`SELECT email FROM users WHERE id = ${uid}`;
      if (u?.email) {
        await this.email.sendDisputeNotification(
          u.email,
          'A Dispute Has Been Opened',
          `A dispute titled "${dto.title_en}" has been opened. Our team will review it shortly.`,
          dispute.id,
        );
      }
    }

    return dispute;
  }

  async findAll(query: any) {
    const { status } = query;
    return this.sql`
      SELECT d.*, cp.full_name_en AS client_name, fp.full_name_en AS freelancer_name,
             ap.full_name_en AS admin_name
      FROM disputes d
      JOIN profiles cp ON cp.user_id = d.client_id
      JOIN profiles fp ON fp.user_id = d.freelancer_id
      LEFT JOIN profiles ap ON ap.user_id = d.assigned_admin
      WHERE (${status ?? null} IS NULL OR d.status = ${status ?? null})
      ORDER BY d.created_at DESC
    `;
  }

  async findOne(id: string, userId: string, userRole: string) {
    const [dispute] = await this.sql`
      SELECT d.*, cp.full_name_en AS client_name, fp.full_name_en AS freelancer_name
      FROM disputes d
      JOIN profiles cp ON cp.user_id = d.client_id
      JOIN profiles fp ON fp.user_id = d.freelancer_id
      WHERE d.id = ${id}
    `;
    if (!dispute) throw new NotFoundException('Dispute not found');

    const isParty = dispute.client_id === userId || dispute.freelancer_id === userId;
    const isAdmin = ['admin', 'super_admin', 'support_admin'].includes(userRole);
    if (!isParty && !isAdmin) throw new ForbiddenException('Access denied');

    return dispute;
  }

  async findMy(userId: string) {
    return this.sql`
      SELECT d.*, cp.full_name_en AS client_name, fp.full_name_en AS freelancer_name
      FROM disputes d
      JOIN profiles cp ON cp.user_id = d.client_id
      JOIN profiles fp ON fp.user_id = d.freelancer_id
      WHERE d.client_id = ${userId} OR d.freelancer_id = ${userId}
      ORDER BY d.created_at DESC
    `;
  }

  async resolve(id: string, adminId: string, dto: { status: string; resolution_note: string }) {
    const [dispute] = await this.sql`SELECT * FROM disputes WHERE id = ${id}`;
    if (!dispute) throw new NotFoundException('Dispute not found');

    await this.sql`
      UPDATE disputes SET
        status = ${dto.status},
        resolution_note = ${dto.resolution_note},
        resolved_at = NOW(),
        resolved_by = ${adminId}
      WHERE id = ${id}
    `;

    // Notify both parties
    for (const uid of [dispute.client_id, dispute.freelancer_id]) {
      await this.notifications.create({
        userId: uid,
        type: 'dispute_resolved',
        title_en: 'Dispute Resolved',
        title_ar: 'تم حل النزاع',
        body_en: dispute.resolution_note,
        body_ar: dispute.resolution_note,
        entity_type: 'dispute',
        entity_id: id,
      });
    }

    return { message: 'Dispute resolved' };
  }
}
