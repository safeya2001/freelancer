import {
  Injectable, NotFoundException, ForbiddenException, InternalServerErrorException,
  Inject, Logger,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private cache: CacheService,
    private notifications: NotificationsService,
  ) {}

  async create(clientId: string, dto: any) {
    // ── Resolve category: prefer category_id (UUID), fallback to slug lookup ──
    let categoryId: string | null = dto.category_id ?? null;
    if (!categoryId && dto.category) {
      // Frontend sends slug like 'web_development' — normalise to hyphen form
      const slug = dto.category.replace(/_/g, '-');
      const [cat] = await this.sql`
        SELECT id FROM categories WHERE slug = ${slug} OR slug = ${dto.category} LIMIT 1`;
      categoryId = cat?.id ?? null;
    }

    // ── Resolve preferred_city: accept both field names ───────────────────────
    const preferredCity: string | null = dto.preferred_city ?? dto.city ?? null;

    // ── Resolve skill_ids: accept UUIDs or name strings ──────────────────────
    let skillIds: string[] = dto.skill_ids ?? [];
    if (!skillIds.length && dto.skills_required?.length) {
      const names = dto.skills_required as string[];
      const rows = await this.sql`
        SELECT id FROM skills
        WHERE LOWER(name_en) = ANY(${names.map((n: string) => n.toLowerCase())})
           OR LOWER(name_ar) = ANY(${names.map((n: string) => n.toLowerCase())})`;
      skillIds = rows.map((r: any) => r.id);
    }

    const [project] = await this.sql`
      INSERT INTO projects (
        client_id, category_id, title_en, title_ar, description_en, description_ar,
        budget_type, budget_min, budget_max, hourly_rate_min, hourly_rate_max,
        deadline, preferred_city, attachment_urls
      ) VALUES (
        ${clientId}, ${categoryId}, ${dto.title_en}, ${dto.title_ar ?? null},
        ${dto.description_en}, ${dto.description_ar ?? null},
        ${dto.budget_type ?? 'fixed'}, ${dto.budget_min ?? null}, ${dto.budget_max ?? null},
        ${dto.hourly_rate_min ?? null}, ${dto.hourly_rate_max ?? null},
        ${dto.deadline ?? null}, ${preferredCity}, ${dto.attachment_urls ?? []}
      ) RETURNING *
    `;

    if (skillIds.length) {
      await this.sql`
        INSERT INTO project_skills (project_id, skill_id)
        VALUES ${this.sql(skillIds.map((sid: string) => ({ project_id: project.id, skill_id: sid })))}
        ON CONFLICT DO NOTHING
      `;
    }

    // Fire-and-forget: notify matching freelancers asynchronously
    this.notifyMatchingFreelancers(project, skillIds, categoryId, preferredCity).catch((err) =>
      this.logger.warn(`Project match notification failed: ${err.message}`),
    );

    return project;
  }

  /** Notify up to 50 freelancers whose skills overlap with this project (or same category). */
  private async notifyMatchingFreelancers(
    project: any,
    skillIds: string[],
    categoryId: string | null,
    preferredCity: string | null,
  ) {
    let freelancerIds: string[] = [];

    if (skillIds.length) {
      // Match by skill overlap
      const rows = await this.sql`
        SELECT DISTINCT fs.user_id
        FROM freelancer_skills fs
        JOIN users u ON u.id = fs.user_id AND u.role = 'freelancer' AND u.status = 'active'
        WHERE fs.skill_id = ANY(${skillIds}::uuid[])
          AND fs.user_id != ${project.client_id}
        LIMIT 50
      `;
      freelancerIds = rows.map((r: any) => r.user_id);
    }

    if (!freelancerIds.length && categoryId) {
      // Fallback: match by category via gigs
      const rows = await this.sql`
        SELECT DISTINCT g.freelancer_id AS user_id
        FROM gigs g
        JOIN users u ON u.id = g.freelancer_id AND u.role = 'freelancer' AND u.status = 'active'
        WHERE g.category_id = ${categoryId} AND g.status = 'active'
          AND g.freelancer_id != ${project.client_id}
        LIMIT 50
      `;
      freelancerIds = rows.map((r: any) => r.user_id);
    }

    if (!freelancerIds.length) return;

    const cityNote = preferredCity ? ` (${preferredCity})` : '';
    await Promise.allSettled(
      freelancerIds.map((userId) =>
        this.notifications.create({
          userId,
          type: 'project_match',
          title_en: 'New Project Matching Your Skills',
          title_ar: 'مشروع جديد يتوافق مع مهاراتك',
          body_en: `"${project.title_en}"${cityNote} — submit your proposal now!`,
          body_ar: `"${project.title_ar || project.title_en}"${cityNote} — قدّم عرضك الآن!`,
          entity_type: 'project',
          entity_id: project.id,
        }),
      ),
    );
  }

  async findAll(query: any) {
    const { category_id, budget_type, min_budget, max_budget, city, search } = query;
    const page  = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
    const offset = (page - 1) * limit;

    // Try Redis cache (60-second TTL)
    const cacheKey = `projects:list:${JSON.stringify({ category_id, budget_type, min_budget, max_budget, city, search, page, limit })}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Build conditional fragments to avoid untyped NULL parameter errors
      const categoryFilter = category_id   ? this.sql`AND p.category_id    = ${category_id}`              : this.sql``;
      const budgetTypeFilter = budget_type ? this.sql`AND p.budget_type     = ${budget_type}`              : this.sql``;
      const minBudgetFilter  = (min_budget != null && min_budget !== '') ? this.sql`AND p.budget_min >= ${Number(min_budget)}` : this.sql``;
      const maxBudgetFilter  = (max_budget != null && max_budget !== '') ? this.sql`AND p.budget_max <= ${Number(max_budget)}` : this.sql``;
      const cityFilter       = city        ? this.sql`AND p.preferred_city  = ${city}`                     : this.sql``;
      const searchFilter     = search      ? this.sql`AND (p.title_en ILIKE ${'%' + search + '%'} OR p.title_ar ILIKE ${'%' + search + '%'})` : this.sql``;
      const searchCountFilter = search     ? this.sql`AND (title_en ILIKE ${'%' + search + '%'} OR title_ar ILIKE ${'%' + search + '%'})`     : this.sql``;
      const categoryCountFilter = category_id ? this.sql`AND category_id = ${category_id}` : this.sql``;

      const projects = await this.sql`
        SELECT p.id, p.title_en, p.title_ar, p.description_en, p.budget_type,
               p.budget_min, p.budget_max, p.hourly_rate_min, p.hourly_rate_max,
               p.deadline, p.proposals_count, p.views_count, p.preferred_city,
               p.created_at, c.name_en AS category_name_en, c.name_ar AS category_name_ar,
               pr.full_name_en AS client_name, pr.avatar_url AS client_avatar,
               pr.company_name
        FROM projects p
        JOIN users u ON u.id = p.client_id AND u.status = 'active'
        JOIN profiles pr ON pr.user_id = p.client_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.status = 'open'
          ${categoryFilter}
          ${budgetTypeFilter}
          ${minBudgetFilter}
          ${maxBudgetFilter}
          ${cityFilter}
          ${searchFilter}
        ORDER BY p.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [{ count }] = await this.sql`
        SELECT COUNT(*) FROM projects WHERE status = 'open'
          ${categoryCountFilter}
          ${searchCountFilter}
      `;

      const result = { data: projects, total: Number(count), page, limit };
      await this.cache.set(cacheKey, result, 60);
      return result;
    } catch (err) {
      this.logger.error('findAll failed', err);
      throw new InternalServerErrorException('Failed to fetch projects. Please try again later.');
    }
  }

  async findOne(id: string) {
    const [project] = await this.sql`
      SELECT p.*, pr.full_name_en AS client_name, pr.full_name_ar AS client_name_ar,
             pr.avatar_url AS client_avatar, pr.company_name, pr.city AS client_city,
             pr.avg_rating AS client_rating, pr.total_orders AS client_total_orders,
             pr.total_spent AS client_total_spent,
             u.last_login_at AS client_last_seen,
             c.name_en AS category_name_en, c.name_ar AS category_name_ar
      FROM projects p
      JOIN users u ON u.id = p.client_id
      JOIN profiles pr ON pr.user_id = p.client_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ${id}
    `;
    if (!project) throw new NotFoundException('Project not found');

    const skills = await this.sql`
      SELECT s.id, s.name_en, s.name_ar FROM project_skills ps
      JOIN skills s ON s.id = ps.skill_id WHERE ps.project_id = ${id}
    `;

    await this.sql`UPDATE projects SET views_count = views_count + 1 WHERE id = ${id}`;

    return { ...project, skills };
  }

  async update(id: string, clientId: string, dto: any) {
    const [project] = await this.sql`SELECT client_id, status FROM projects WHERE id = ${id}`;
    if (!project) throw new NotFoundException('Project not found');
    if (project.client_id !== clientId) throw new ForbiddenException('Not your project');
    if (project.status !== 'open') throw new ForbiddenException('Cannot edit non-open project');

    await this.sql`
      UPDATE projects SET
        title_en = COALESCE(${dto.title_en ?? null}, title_en),
        description_en = COALESCE(${dto.description_en ?? null}, description_en),
        budget_min = COALESCE(${dto.budget_min ?? null}, budget_min),
        budget_max = COALESCE(${dto.budget_max ?? null}, budget_max),
        deadline = COALESCE(${dto.deadline ?? null}, deadline),
        status = COALESCE(${dto.status ?? null}, status)
      WHERE id = ${id}
    `;
    return this.findOne(id);
  }

  async close(id: string, clientId: string) {
    const [project] = await this.sql`SELECT client_id FROM projects WHERE id = ${id}`;
    if (!project) throw new NotFoundException('Project not found');
    if (project.client_id !== clientId) throw new ForbiddenException('Not your project');

    await this.sql`UPDATE projects SET status = 'closed' WHERE id = ${id}`;
    return { message: 'Project closed' };
  }

  async getMyProjects(clientId: string) {
    return this.sql`
      SELECT p.*, c.name_en AS category_name_en FROM projects p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.client_id = ${clientId} ORDER BY p.created_at DESC
    `;
  }
}
