import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException, Inject,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProposalsService {
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private notifications: NotificationsService,
  ) {}

  async submit(freelancerId: string, dto: any) {
    const isDev = process.env.NODE_ENV !== 'production';
    const [freelancer] = await this.sql`SELECT role, phone_verified FROM users WHERE id = ${freelancerId}`;
    if (!isDev && freelancer?.role === 'freelancer' && !freelancer?.phone_verified) {
      throw new ForbiddenException('Verify your phone number to submit proposals.');
    }

    const [project] = await this.sql`SELECT id, client_id, status, budget_type FROM projects WHERE id = ${dto.project_id}`;
    if (!project) throw new NotFoundException('Project not found');
    if (project.status !== 'open') throw new BadRequestException('Project is not accepting proposals');

    const [existing] = await this.sql`
      SELECT id FROM proposals WHERE project_id = ${dto.project_id} AND freelancer_id = ${freelancerId}
    `;
    if (existing) throw new ConflictException('You already submitted a proposal for this project');

    const budget = dto.proposed_budget ?? (dto.proposed_hourly_rate && dto.estimated_hours
      ? Number(dto.proposed_hourly_rate) * Number(dto.estimated_hours)
      : null);
    if (budget == null || budget <= 0) throw new BadRequestException('Provide proposed_budget or both proposed_hourly_rate and estimated_hours');

    const [proposal] = await this.sql`
      INSERT INTO proposals (project_id, freelancer_id, cover_letter_en, cover_letter_ar,
                             proposed_budget, delivery_days, attachment_urls,
                             proposed_hourly_rate, estimated_hours)
      VALUES (${dto.project_id}, ${freelancerId}, ${dto.cover_letter_en},
              ${dto.cover_letter_ar ?? null}, ${budget},
              ${dto.delivery_days}, ${dto.attachment_urls ?? []},
              ${dto.proposed_hourly_rate ?? null}, ${dto.estimated_hours ?? null})
      RETURNING *
    `;

    await this.notifications.create({
      userId: project.client_id,
      type: 'proposal_received',
      title_en: 'New Proposal Received',
      title_ar: 'تم استلام عرض جديد',
      body_en: 'A freelancer submitted a proposal for your project.',
      body_ar: 'قدّم مستقل عرضاً لمشروعك.',
      entity_type: 'project',
      entity_id: proposal.project_id,
    });

    return proposal;
  }

  async getProjectProposals(projectId: string, clientId: string) {
    const [project] = await this.sql`SELECT client_id FROM projects WHERE id = ${projectId}`;
    if (!project) throw new NotFoundException('Project not found');
    if (project.client_id !== clientId) throw new ForbiddenException('Access denied');

    return this.sql`
      SELECT pr.*, p.full_name_en AS freelancer_name, p.full_name_ar AS freelancer_name_ar,
             p.avatar_url, p.avg_rating, p.review_count, p.total_jobs_done,
             p.professional_title_en, p.city
      FROM proposals pr
      JOIN profiles p ON p.user_id = pr.freelancer_id
      WHERE pr.project_id = ${projectId}
      ORDER BY pr.created_at DESC
    `;
  }

  async getMyProposals(freelancerId: string) {
    return this.sql`
      SELECT pr.*, p.title_en AS project_title, p.budget_type, p.budget_min, p.budget_max
      FROM proposals pr
      JOIN projects p ON p.id = pr.project_id
      WHERE pr.freelancer_id = ${freelancerId}
      ORDER BY pr.created_at DESC
    `;
  }

  async accept(proposalId: string, clientId: string) {
    const [proposal] = await this.sql`
      SELECT pr.*, p.client_id, p.title_en AS project_title
      FROM proposals pr JOIN projects p ON p.id = pr.project_id
      WHERE pr.id = ${proposalId}
    `;
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.client_id !== clientId) throw new ForbiddenException('Access denied');
    if (proposal.status !== 'pending') throw new BadRequestException('Proposal is not pending');

    // Update proposal status
    await this.sql`UPDATE proposals SET status = 'accepted' WHERE id = ${proposalId}`;

    // Reject all other proposals for this project
    await this.sql`
      UPDATE proposals SET status = 'rejected'
      WHERE project_id = ${proposal.project_id} AND id != ${proposalId}
    `;

    // Mark project as in_progress
    await this.sql`UPDATE projects SET status = 'in_progress' WHERE id = ${proposal.project_id}`;

    // Create contract
    const [contract] = await this.sql`
      INSERT INTO contracts (project_id, proposal_id, client_id, freelancer_id,
                             title_en, total_amount, commission_rate)
      VALUES (${proposal.project_id}, ${proposalId}, ${clientId}, ${proposal.freelancer_id},
              ${proposal.project_title}, ${proposal.proposed_budget}, 10)
      RETURNING *
    `;

    // Create chat room
    await this.sql`
      INSERT INTO chat_rooms (contract_id, client_id, freelancer_id)
      VALUES (${contract.id}, ${clientId}, ${proposal.freelancer_id})
    `;

    await this.notifications.create({
      userId: proposal.freelancer_id,
      type: 'proposal_accepted',
      title_en: 'Proposal Accepted!',
      title_ar: 'تم قبول عرضك!',
      body_en: `Your proposal for "${proposal.project_title}" was accepted.`,
      body_ar: `تم قبول عرضك للمشروع "${proposal.project_title}".`,
      entity_type: 'contract',
      entity_id: contract.id,
    });

    return { proposal, contract };
  }

  async reject(proposalId: string, clientId: string, reason?: string) {
    const [proposal] = await this.sql`
      SELECT pr.*, p.client_id, pr.freelancer_id
      FROM proposals pr JOIN projects p ON p.id = pr.project_id
      WHERE pr.id = ${proposalId}
    `;
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.client_id !== clientId) throw new ForbiddenException('Access denied');

    await this.sql`
      UPDATE proposals SET status = 'rejected', rejection_reason = ${reason ?? null}
      WHERE id = ${proposalId}
    `;

    await this.notifications.create({
      userId: proposal.freelancer_id,
      type: 'proposal_rejected',
      title_en: 'Proposal Not Selected',
      title_ar: 'لم يتم اختيار عرضك',
      body_en: 'Your proposal was not selected for this project.',
      body_ar: 'لم يتم اختيار عرضك لهذا المشروع.',
      entity_type: 'project',
      entity_id: proposal.project_id,
    });

    return { message: 'Proposal rejected' };
  }

  async withdraw(proposalId: string, freelancerId: string) {
    const [proposal] = await this.sql`
      SELECT id, freelancer_id, status FROM proposals WHERE id = ${proposalId}
    `;
    if (!proposal) throw new NotFoundException('Proposal not found');
    if (proposal.freelancer_id !== freelancerId) throw new ForbiddenException('Access denied');
    if (proposal.status !== 'pending') throw new BadRequestException('Cannot withdraw non-pending proposal');

    await this.sql`UPDATE proposals SET status = 'withdrawn' WHERE id = ${proposalId}`;
    return { message: 'Proposal withdrawn' };
  }
}
