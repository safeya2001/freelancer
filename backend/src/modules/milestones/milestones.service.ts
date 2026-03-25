import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Inject,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { EscrowService } from '../escrow/escrow.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MilestonesService {
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private escrow: EscrowService,
    private notifications: NotificationsService,
  ) {}

  async submit(milestoneId: string, freelancerId: string, dto: any) {
    const [ms] = await this.sql`
      SELECT m.*, c.freelancer_id, c.client_id, m.title_en
      FROM milestones m JOIN contracts c ON c.id = m.contract_id
      WHERE m.id = ${milestoneId}
    `;
    if (!ms) throw new NotFoundException('Milestone not found');
    if (ms.freelancer_id !== freelancerId) throw new ForbiddenException('Access denied');
    if (!['pending', 'in_progress', 'revision_requested'].includes(ms.status)) {
      throw new BadRequestException('Cannot submit milestone in current status');
    }

    await this.sql`
      UPDATE milestones SET
        status = 'submitted',
        delivery_note_en = ${dto.delivery_note_en ?? null},
        delivery_note_ar = ${dto.delivery_note_ar ?? null},
        delivery_urls = ${dto.delivery_urls ?? []},
        delivered_at = NOW()
      WHERE id = ${milestoneId}
    `;

    await this.notifications.create({
      userId: ms.client_id,
      type: 'milestone_submitted',
      title_en: 'Milestone Delivered',
      title_ar: 'تم تسليم المرحلة',
      body_en: `Freelancer delivered milestone: "${ms.title_en}"`,
      body_ar: `قام المستقل بتسليم المرحلة: "${ms.title_en}"`,
      entity_type: 'milestone',
      entity_id: milestoneId,
    });

    return { message: 'Milestone submitted for review' };
  }

  async approve(milestoneId: string, clientId: string) {
    const [ms] = await this.sql`
      SELECT m.*, c.freelancer_id, c.client_id, c.id AS contract_id
      FROM milestones m JOIN contracts c ON c.id = m.contract_id
      WHERE m.id = ${milestoneId}
    `;
    if (!ms) throw new NotFoundException('Milestone not found');
    if (ms.client_id !== clientId) throw new ForbiddenException('Access denied');
    if (ms.status !== 'submitted') throw new BadRequestException('Milestone is not submitted');

    await this.sql`
      UPDATE milestones SET status = 'approved', approved_at = NOW(), approved_by = ${clientId}
      WHERE id = ${milestoneId}
    `;

    // Release escrow for this milestone
    await this.escrow.releaseForMilestone(milestoneId);

    await this.notifications.create({
      userId: ms.freelancer_id,
      type: 'milestone_approved',
      title_en: 'Milestone Approved!',
      title_ar: 'تمت الموافقة على المرحلة!',
      body_en: 'Your milestone was approved and payment is being released.',
      body_ar: 'تمت الموافقة على مرحلتك وجارٍ إصدار الدفعة.',
      entity_type: 'milestone',
      entity_id: milestoneId,
    });

    return { message: 'Milestone approved and payment released' };
  }

  async requestRevision(milestoneId: string, clientId: string, note: string) {
    const [ms] = await this.sql`
      SELECT m.*, c.freelancer_id, c.client_id
      FROM milestones m JOIN contracts c ON c.id = m.contract_id
      WHERE m.id = ${milestoneId}
    `;
    if (!ms) throw new NotFoundException('Milestone not found');
    if (ms.client_id !== clientId) throw new ForbiddenException('Access denied');
    if (ms.status !== 'submitted') throw new BadRequestException('Milestone is not submitted');

    await this.sql`
      UPDATE milestones SET status = 'revision_requested', revision_note = ${note}
      WHERE id = ${milestoneId}
    `;

    await this.notifications.create({
      userId: ms.freelancer_id,
      type: 'milestone_revision',
      title_en: 'Revision Requested',
      title_ar: 'تم طلب مراجعة',
      body_en: 'The client requested a revision for your milestone.',
      body_ar: 'طلب العميل مراجعة للمرحلة.',
      entity_type: 'milestone',
      entity_id: milestoneId,
    });

    return { message: 'Revision requested' };
  }

  async startMilestone(milestoneId: string, freelancerId: string) {
    const [ms] = await this.sql`
      SELECT m.*, c.freelancer_id FROM milestones m
      JOIN contracts c ON c.id = m.contract_id WHERE m.id = ${milestoneId}
    `;
    if (!ms) throw new NotFoundException('Milestone not found');
    if (ms.freelancer_id !== freelancerId) throw new ForbiddenException('Access denied');
    if (ms.status !== 'pending') throw new BadRequestException('Milestone is not pending');

    await this.sql`UPDATE milestones SET status = 'in_progress' WHERE id = ${milestoneId}`;
    return { message: 'Milestone started' };
  }
}
