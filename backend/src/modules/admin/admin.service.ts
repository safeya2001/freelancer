import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';
import { EmailService } from '../email/email.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private notifications: NotificationsService,
    private email: EmailService,
    private authService: AuthService,
  ) {}

  async getPlatformStats() {
    const [users] = await this.sql`SELECT COUNT(*) FROM users WHERE role IN ('client','freelancer')`;
    const [freelancers] = await this.sql`SELECT COUNT(*) FROM users WHERE role = 'freelancer'`;
    const [clients] = await this.sql`SELECT COUNT(*) FROM users WHERE role = 'client'`;
    const [gigs] = await this.sql`SELECT COUNT(*) FROM gigs WHERE status = 'active'`;
    const [projects] = await this.sql`SELECT COUNT(*) FROM projects WHERE status = 'open'`;
    const [orders] = await this.sql`SELECT COUNT(*) FROM orders WHERE status = 'completed'`;
    const [revenue] = await this.sql`SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE type = 'commission' AND status = 'completed'`;
    const [pendingWithdrawals] = await this.sql`SELECT COUNT(*) FROM withdrawals WHERE status = 'pending'`;
    const [pendingIdentity] = await this.sql`SELECT COUNT(*) FROM profiles WHERE identity_verified = 'pending'`;

    return {
      total_users: Number(users.count),
      total_freelancers: Number(freelancers.count),
      total_clients: Number(clients.count),
      active_gigs: Number(gigs.count),
      open_projects: Number(projects.count),
      completed_orders: Number(orders.count),
      total_commission_jod: Number(revenue.total),
      pending_withdrawals: Number(pendingWithdrawals.count),
      pending_identity_verifications: Number(pendingIdentity.count),
    };
  }

  async getUsers(query: any) {
    const { role, status, search, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;
    const roleFilter = role ? this.sql`AND u.role = ${role}` : this.sql``;
    const statusFilter = status ? this.sql`AND u.status = ${status}` : this.sql``;
    const searchFilter = search
      ? this.sql`AND (u.email ILIKE ${'%' + search + '%'} OR p.full_name_en ILIKE ${'%' + search + '%'})`
      : this.sql``;

    return this.sql`
      SELECT u.id, u.email, u.phone, u.role, u.status, u.created_at,
             u.email_verified, u.phone_verified,
             p.full_name_en, p.full_name_ar, p.city, p.identity_verified,
             p.avg_rating, p.review_count
      FROM users u JOIN profiles p ON p.user_id = u.id
      WHERE 1=1 ${roleFilter} ${statusFilter} ${searchFilter}
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async updateUserStatus(userId: string, status: string, adminId: string) {
    await this.sql`UPDATE users SET status = ${status} WHERE id = ${userId}`;

    // Revoke all active sessions when banning or suspending a user
    if (status === 'banned' || status === 'suspended') {
      await this.authService.revokeAllRefreshTokens(userId).catch((err: Error) =>
        this.logger.warn(`Failed to revoke tokens for user ${userId}: ${err.message}`),
      );
    }

    await this.sql`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
      VALUES (${adminId}, 'update_user_status', 'user', ${userId}, ${JSON.stringify({ status })})
    `;
    return { message: `User status updated to ${status}` };
  }

  async manualVerifyPhone(userId: string, adminId: string) {
    const [user] = await this.sql`SELECT id, phone FROM users WHERE id = ${userId}`;
    if (!user) throw new NotFoundException('User not found');

    await this.sql`
      UPDATE users
      SET phone_verified = true, phone_otp = null, phone_otp_expires = null
      WHERE id = ${userId}
    `;
    await this.sql`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
      VALUES (${adminId}, 'manual_verify_phone', 'user', ${userId}, ${JSON.stringify({ phone: user.phone })})
    `;
    this.logger.log(`Admin ${adminId} manually verified phone for user ${userId}`);
    return { message: 'Phone manually verified by admin' };
  }

  async verifyFreelancerIdentity(userId: string, status: string, adminId: string, reason?: string) {
    await this.sql`
      UPDATE profiles SET
        identity_verified = ${status},
        identity_verified_at = NOW(),
        identity_verified_by = ${adminId}
      WHERE user_id = ${userId}
    `;

    const title = status === 'verified'
      ? { en: 'Identity Verified', ar: 'تم التحقق من الهوية' }
      : { en: 'Identity Verification Failed', ar: 'فشل التحقق من الهوية' };

    await this.notifications.create({
      userId,
      type: status === 'verified' ? 'identity_verified' : 'identity_rejected',
      title_en: title.en,
      title_ar: title.ar,
      body_en: reason || (status === 'verified' ? 'Your identity has been verified.' : 'Your identity verification was rejected.'),
      body_ar: reason || (status === 'verified' ? 'تم التحقق من هويتك.' : 'تم رفض التحقق من هويتك.'),
      entity_type: 'user',
      entity_id: userId,
    });

    await this.sql`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
      VALUES (${adminId}, 'verify_identity', 'user', ${userId}, ${JSON.stringify({ status, reason })})
    `;

    return { message: `Identity ${status}` };
  }

  async getGigs(query: any) {
    const { status, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;
    const statusFilter = status ? this.sql`AND g.status = ${status}` : this.sql``;
    return this.sql`
      SELECT g.*, p.full_name_en AS freelancer_name, u.email AS freelancer_email,
             c.name_en AS category_name
      FROM gigs g
      JOIN users u ON u.id = g.freelancer_id
      JOIN profiles p ON p.user_id = g.freelancer_id
      JOIN categories c ON c.id = g.category_id
      WHERE 1=1 ${statusFilter}
      ORDER BY g.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async updateGigStatus(gigId: string, status: string) {
    await this.sql`UPDATE gigs SET status = ${status} WHERE id = ${gigId}`;
    return { message: 'Gig status updated' };
  }

  async getProjects(query: any) {
    const { status, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;
    const statusFilter = status ? this.sql`AND p.status = ${status}` : this.sql``;
    return this.sql`
      SELECT p.*, pr.full_name_en AS client_name, u.email AS client_email
      FROM projects p
      JOIN users u ON u.id = p.client_id
      JOIN profiles pr ON pr.user_id = p.client_id
      WHERE 1=1 ${statusFilter}
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async cancelProject(projectId: string, adminId: string) {
    const [p] = await this.sql`SELECT id, status, client_id FROM projects WHERE id = ${projectId}`;
    if (!p) throw new NotFoundException('Project not found');
    if (p.status === 'cancelled') throw new BadRequestException('Project is already cancelled');
    await this.sql`
      UPDATE projects SET status = 'cancelled', updated_at = NOW() WHERE id = ${projectId}
    `;
    await this.notifications.create({
      userId: p.client_id,
      type: 'proposal_rejected',
      title_en: 'Project Cancelled',
      title_ar: 'تم إلغاء المشروع',
      body_en: 'Your project has been cancelled by the platform administrator.',
      body_ar: 'تم إلغاء مشروعك من قبل إدارة المنصة.',
      entity_type: 'project',
      entity_id: projectId,
    });
    await this.sql`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id)
      VALUES (${adminId}, 'cancel_project', 'project', ${projectId})
    `;
    return { message: 'Project cancelled' };
  }

  async getContracts(query: any) {
    const { status, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;
    const statusFilter = status ? this.sql`AND c.status = ${status}` : this.sql``;
    const rows = await this.sql`
      SELECT c.*, pc.full_name_en AS client_name, pf.full_name_en AS freelancer_name,
             pr.title_en AS project_title
      FROM contracts c
      JOIN users u ON u.id = c.client_id
      JOIN profiles pc ON pc.user_id = c.client_id
      JOIN profiles pf ON pf.user_id = c.freelancer_id
      LEFT JOIN projects pr ON pr.id = c.project_id
      WHERE 1=1 ${statusFilter}
      ORDER BY c.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return { total: rows.length, contracts: rows };
  }

  async getContractMilestones(contractId: string) {
    return this.sql`
      SELECT m.* FROM milestones m WHERE m.contract_id = ${contractId} ORDER BY m.sort_order ASC
    `;
  }

  async getTransactions(query: any) {
    const { type, status, page = 1, limit = 20 } = query;
    const offset = (page - 1) * limit;
    const typeFilter = type ? this.sql`AND t.type = ${type}` : this.sql``;
    const statusFilter = status ? this.sql`AND t.status = ${status}` : this.sql``;
    const rows = await this.sql`
      SELECT t.*, fu.email AS from_email, tu.email AS to_email
      FROM transactions t
      LEFT JOIN users fu ON fu.id = t.from_user_id
      LEFT JOIN users tu ON tu.id = t.to_user_id
      WHERE 1=1 ${typeFilter} ${statusFilter}
      ORDER BY t.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return { total: rows.length, transactions: rows };
  }

  async getAuditLogs(query: any) {
    const { page = 1, limit = 50 } = query;
    const offset = (page - 1) * limit;
    return this.sql`
      SELECT al.*, p.full_name_en AS admin_name, u.email AS admin_email
      FROM audit_logs al
      JOIN users u ON u.id = al.admin_id
      JOIN profiles p ON p.user_id = al.admin_id
      ORDER BY al.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
  }

  async getSettings() {
    return this.sql`SELECT * FROM platform_settings ORDER BY key`;
  }

  async updateSetting(key: string, value: string, adminId: string) {
    await this.sql`
      INSERT INTO platform_settings (key, value, updated_by)
      VALUES (${key}, ${value}, ${adminId})
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_by = ${adminId}, updated_at = NOW()
    `;
    await this.sql`
      INSERT INTO audit_logs (admin_id, action, entity_type, new_data)
      VALUES (${adminId}, 'update_setting', 'platform_settings', ${JSON.stringify({ key, value })})
    `;
    return { message: 'Setting updated' };
  }

  // ─── KYC QUEUE ───────────────────────────────────────────────
  async getKycQueue() {
    return this.sql`
      SELECT u.id, u.email, u.created_at,
             p.full_name_en, p.full_name_ar, p.avatar_url, p.city,
             p.identity_verified, p.identity_doc_url
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      WHERE p.identity_verified = 'pending' AND u.role = 'freelancer'
      ORDER BY u.created_at ASC
    `;
  }

  // ─── FINANCE OVERVIEW ────────────────────────────────────────
  async getFinanceOverview() {
    const [escrow] = await this.sql`
      SELECT
        COALESCE(SUM(net_amount) FILTER (WHERE status IN ('funded','disputed')), 0) AS total_escrow_held,
        COUNT(*) FILTER (WHERE status IN ('funded','disputed'))                      AS active_escrows
      FROM escrow_accounts
    `;
    const [revenue] = await this.sql`
      SELECT COALESCE(SUM(amount), 0) AS total_commission
      FROM transactions
      WHERE type = 'commission' AND status = 'completed'
    `;
    const [pending] = await this.sql`
      SELECT COALESCE(SUM(amount), 0) AS total_pending, COUNT(*) AS pending_count
      FROM withdrawals WHERE status = 'pending'
    `;
    const withdrawals = await this.sql`
      SELECT w.*, p.full_name_en AS freelancer_name, u.email AS freelancer_email
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      JOIN profiles p ON p.user_id = w.user_id
      ORDER BY w.created_at DESC
      LIMIT 100
    `;
    return {
      total_escrow_held:         Number(escrow.total_escrow_held),
      active_escrows:            Number(escrow.active_escrows),
      total_commission:          Number(revenue.total_commission),
      total_pending_withdrawals: Number(pending.total_pending),
      pending_withdrawal_count:  Number(pending.pending_count),
      withdrawals,
    };
  }

  // ─── DISPUTES ────────────────────────────────────────────────
  async getAllDisputes(query: any) {
    const { status } = query;
    return this.sql`
      SELECT d.*,
             cp.full_name_en AS client_name, cp.avatar_url AS client_avatar,
             fp.full_name_en AS freelancer_name, fp.avatar_url AS freelancer_avatar,
             ap.full_name_en AS admin_name,
             o.price AS order_amount,
             ea.amount AS escrow_amount, ea.id AS escrow_id, ea.status AS escrow_status
      FROM disputes d
      JOIN profiles cp ON cp.user_id = d.client_id
      JOIN profiles fp ON fp.user_id = d.freelancer_id
      LEFT JOIN profiles ap ON ap.user_id = d.assigned_admin
      LEFT JOIN orders o ON o.id = d.order_id
      LEFT JOIN escrow_accounts ea ON (ea.order_id = d.order_id OR ea.milestone_id = d.milestone_id)
      WHERE (${status ?? null} IS NULL OR d.status = ${status ?? null})
      ORDER BY
        CASE d.status WHEN 'open' THEN 0 WHEN 'under_review' THEN 1 ELSE 2 END,
        d.created_at DESC
    `;
  }

  async getDisputeDetail(id: string) {
    const [dispute] = await this.sql`
      SELECT d.*,
             cp.full_name_en AS client_name, cp.avatar_url AS client_avatar,
             fp.full_name_en AS freelancer_name, fp.avatar_url AS freelancer_avatar,
             ea.amount AS escrow_amount, ea.net_amount AS escrow_net, ea.commission AS escrow_commission,
             ea.id AS escrow_id, ea.status AS escrow_status
      FROM disputes d
      JOIN profiles cp ON cp.user_id = d.client_id
      JOIN profiles fp ON fp.user_id = d.freelancer_id
      LEFT JOIN escrow_accounts ea ON (ea.order_id = d.order_id OR ea.milestone_id = d.milestone_id)
      WHERE d.id = ${id}
    `;
    if (!dispute) throw new Error('Dispute not found');

    // Fetch chat messages for the associated order/contract
    let messages: any[] = [];
    if (dispute.order_id) {
      messages = await this.sql`
        SELECT m.*, p.full_name_en AS sender_name, p.avatar_url AS sender_avatar
        FROM chat_messages m
        JOIN chat_rooms cr ON cr.id = m.room_id
        JOIN profiles p ON p.user_id = m.sender_id
        WHERE cr.order_id = ${dispute.order_id}
        ORDER BY m.created_at ASC
        LIMIT 100
      `;
    }

    // Milestones if contract dispute
    let milestones: any[] = [];
    if (dispute.contract_id) {
      milestones = await this.sql`
        SELECT * FROM milestones WHERE contract_id = ${dispute.contract_id}
        ORDER BY sort_order ASC
      `;
    }

    return { ...dispute, messages, milestones };
  }

  async resolveDispute(
    id: string,
    adminId: string,
    dto: { resolution: string; note: string; client_pct?: number; freelancer_pct?: number },
    escrowService: any,
  ) {
    const detail = await this.getDisputeDetail(id) as any;

    // Handle escrow if one is linked to this dispute
    if (detail.escrow_id && detail.escrow_status !== 'released' && detail.escrow_status !== 'refunded') {
      if (dto.resolution === 'partial_split') {
        await escrowService.partialSplit(detail.escrow_id, dto.client_pct ?? 50, dto.freelancer_pct ?? 50);
      } else if (dto.resolution === 'release_to_freelancer') {
        await escrowService.resolveDispute(detail.escrow_id, 'release_to_freelancer');
      } else if (dto.resolution === 'refund_to_client') {
        await escrowService.resolveDispute(detail.escrow_id, 'refund_to_client');
      }
    }

    const newStatus = dto.resolution === 'release_to_freelancer' ? 'resolved_freelancer'
      : dto.resolution === 'refund_to_client' ? 'resolved_client'
      : 'resolved_client'; // partial split counts as resolved

    await this.sql`
      UPDATE disputes SET
        status = ${newStatus},
        resolution_note = ${dto.note ?? null},
        resolved_at = NOW(),
        resolved_by = ${adminId}
      WHERE id = ${id}
    `;

    await this.sql`
      INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, new_data)
      VALUES (${adminId}, 'resolve_dispute', 'dispute', ${id},
              ${JSON.stringify({ resolution: dto.resolution, note: dto.note })})
    `;

    for (const uid of [detail.client_id, detail.freelancer_id]) {
      await this.notifications.create({
        userId: uid,
        type: 'dispute_resolved',
        title_en: 'Dispute Resolved',
        title_ar: 'تم حل النزاع',
        body_en: dto.note || 'Your dispute has been resolved by the platform administrator.',
        body_ar: dto.note || 'تم حل نزاعك من قِبل مدير المنصة.',
        entity_type: 'dispute',
        entity_id: id,
      });
    }

    return { message: 'Dispute resolved' };
  }

  async broadcastNotification(dto: {
    title_en: string;
    title_ar: string;
    body_en: string;
    body_ar: string;
    target: 'all' | 'clients' | 'freelancers';
  }) {
    let users: { id: string; email: string }[] = [];
    if (dto.target === 'all') {
      users = await this.sql`
        SELECT id, email FROM users
        WHERE status = 'active' AND role IN ('client', 'freelancer') AND email IS NOT NULL
      `;
    } else if (dto.target === 'clients') {
      users = await this.sql`
        SELECT id, email FROM users
        WHERE status = 'active' AND role = 'client' AND email IS NOT NULL
      `;
    } else {
      users = await this.sql`
        SELECT id, email FROM users
        WHERE status = 'active' AND role = 'freelancer' AND email IS NOT NULL
      `;
    }

    const type = 'platform_announcement' as const;
    const subject = dto.title_en;
    const bodyHtml = (dto.body_en || '').replace(/\n/g, '<br/>');

    for (const u of users) {
      try {
        await this.notifications.create({
          userId: u.id,
          type,
          title_en: dto.title_en,
          title_ar: dto.title_ar,
          body_en: dto.body_en,
          body_ar: dto.body_ar,
          entity_type: 'announcement',
          entity_id: undefined,
        });
        if (u.email) {
          await this.email.sendAnnouncement(u.email, subject, bodyHtml);
        }
      } catch (err) {
        this.logger.warn(`Broadcast to user ${u.id} failed: ${(err as Error).message}`);
      }
    }

    return { message: `Broadcast sent to ${users.length} user(s)` };
  }

  // ─── CATEGORIES CRUD ─────────────────────────────────────────
  async getCategories() {
    return this.sql`SELECT * FROM categories ORDER BY sort_order, name_en`;
  }

  async createCategory(dto: any) {
    const slug = dto.slug || dto.name_en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const [cat] = await this.sql`
      INSERT INTO categories (name_en, name_ar, slug, icon, sort_order, is_active)
      VALUES (${dto.name_en}, ${dto.name_ar ?? null}, ${slug}, ${dto.icon ?? null}, ${dto.sort_order ?? 99}, ${dto.is_active ?? true})
      RETURNING *
    `;
    return cat;
  }

  async updateCategory(id: string, dto: any) {
    await this.sql`
      UPDATE categories SET
        name_en    = COALESCE(${dto.name_en ?? null}, name_en),
        name_ar    = COALESCE(${dto.name_ar ?? null}, name_ar),
        icon       = COALESCE(${dto.icon ?? null}, icon),
        sort_order = COALESCE(${dto.sort_order ?? null}, sort_order),
        is_active  = COALESCE(${dto.is_active ?? null}, is_active)
      WHERE id = ${id}
    `;
    const [cat] = await this.sql`SELECT * FROM categories WHERE id = ${id}`;
    return cat;
  }

  async deleteCategory(id: string) {
    await this.sql`UPDATE categories SET is_active = false WHERE id = ${id}`;
    return { message: 'Category deactivated' };
  }

  // ─── SKILLS CRUD ─────────────────────────────────────────────
  async getSkills() {
    return this.sql`SELECT * FROM skills ORDER BY name_en`;
  }

  async createSkill(dto: any) {
    const [skill] = await this.sql`
      INSERT INTO skills (name_en, name_ar, is_active)
      VALUES (${dto.name_en}, ${dto.name_ar ?? null}, ${dto.is_active ?? true})
      RETURNING *
    `;
    return skill;
  }

  async updateSkill(id: string, dto: any) {
    await this.sql`
      UPDATE skills SET
        name_en   = COALESCE(${dto.name_en ?? null}, name_en),
        name_ar   = COALESCE(${dto.name_ar ?? null}, name_ar),
        is_active = COALESCE(${dto.is_active ?? null}, is_active)
      WHERE id = ${id}
    `;
    const [skill] = await this.sql`SELECT * FROM skills WHERE id = ${id}`;
    return skill;
  }

  async deleteSkill(id: string) {
    await this.sql`UPDATE skills SET is_active = false WHERE id = ${id}`;
    return { message: 'Skill deactivated' };
  }
}
