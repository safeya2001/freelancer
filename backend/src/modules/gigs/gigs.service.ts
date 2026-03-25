import {
  Injectable, NotFoundException, ForbiddenException, InternalServerErrorException,
  Inject, Logger,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { CacheService } from '../../common/cache/cache.service';

@Injectable()
export class GigsService {
  private readonly logger = new Logger(GigsService.name);
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private cache: CacheService,
  ) {}

  async create(freelancerId: string, dto: any) {
    const slug = `${dto.title_en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}`;

    const [gig] = await this.sql`
      INSERT INTO gigs (
        freelancer_id, category_id, title_en, title_ar, description_en, description_ar,
        slug, price, delivery_days, gallery_urls, requirements_en, requirements_ar
      ) VALUES (
        ${freelancerId}, ${dto.category_id}, ${dto.title_en}, ${dto.title_ar ?? null},
        ${dto.description_en}, ${dto.description_ar ?? null}, ${slug},
        ${dto.price ?? null}, ${dto.delivery_days}, ${dto.gallery_urls ?? []},
        ${dto.requirements_en ?? null}, ${dto.requirements_ar ?? null}
      ) RETURNING *
    `;

    // Insert packages if provided
    if (dto.packages?.length) {
      for (const pkg of dto.packages) {
        await this.sql`
          INSERT INTO gig_packages (gig_id, package_type, name_en, name_ar, description_en, description_ar, price, delivery_days, revisions, features)
          VALUES (${gig.id}, ${pkg.package_type}, ${pkg.name_en}, ${pkg.name_ar ?? null},
                  ${pkg.description_en ?? null}, ${pkg.description_ar ?? null},
                  ${pkg.price}, ${pkg.delivery_days}, ${pkg.revisions ?? 1}, ${JSON.stringify(pkg.features ?? [])})
        `;
      }
    }

    // Insert skills
    if (dto.skill_ids?.length) {
      await this.sql`
        INSERT INTO gig_skills (gig_id, skill_id)
        VALUES ${this.sql(dto.skill_ids.map((sid: string) => ({ gig_id: gig.id, skill_id: sid })))}
      `;
    }

    await this.cache.delByPattern('gigs:list:*');
    return gig;
  }

  async findAll(query: any) {
    const {
      category_id,
      min_price,
      max_price,
      min_rating,
      search,
    } = query;

    // Query params arrive as strings; cast to numbers to avoid NaN in arithmetic
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 12));
    const offset = (page - 1) * limit;

    // Try Redis cache (60-second TTL for gigs list)
    const cacheKey = `gigs:list:${JSON.stringify({ category_id, min_price, max_price, min_rating, search, page, limit })}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      // Build extra WHERE fragments dynamically using postgres.js sql fragments.
      // This avoids the "could not determine data type of parameter $N" error
      // that occurs when PostgreSQL cannot infer the type of a bare NULL parameter.
      const categoryFilter = category_id
        ? this.sql`AND g.category_id = ${category_id}`
        : this.sql``;
      const minPriceFilter = (min_price != null && min_price !== '')
        ? this.sql`AND COALESCE(gp_basic.price, g.price) >= ${Number(min_price)}`
        : this.sql``;
      const maxPriceFilter = (max_price != null && max_price !== '')
        ? this.sql`AND COALESCE(gp_basic.price, g.price) <= ${Number(max_price)}`
        : this.sql``;
      const ratingFilter = (min_rating != null && min_rating !== '')
        ? this.sql`AND g.avg_rating >= ${Number(min_rating)}`
        : this.sql``;
      const searchFilter = search
        ? this.sql`AND (g.title_en ILIKE ${'%' + search + '%'} OR g.title_ar ILIKE ${'%' + search + '%'})`
        : this.sql``;
      const searchCountFilter = search
        ? this.sql`AND (g.title_en ILIKE ${'%' + search + '%'} OR g.title_ar ILIKE ${'%' + search + '%'})`
        : this.sql``;

      const gigs = await this.sql`
        SELECT g.id, g.title_en, g.title_ar, g.description_en, g.price, g.delivery_days,
               g.gallery_urls, g.avg_rating, g.review_count, g.orders_count,
               p.full_name_en AS freelancer_name_en, p.full_name_ar AS freelancer_name_ar,
               p.avatar_url, c.name_en AS category_name_en, c.name_ar AS category_name_ar,
               gp_basic.price AS basic_price, gp_std.price AS standard_price, gp_prem.price AS premium_price
        FROM gigs g
        JOIN users u ON u.id = g.freelancer_id AND u.status = 'active'
        JOIN profiles p ON p.user_id = g.freelancer_id
        JOIN categories c ON c.id = g.category_id
        LEFT JOIN gig_packages gp_basic ON gp_basic.gig_id = g.id AND gp_basic.package_type = 'basic'
        LEFT JOIN gig_packages gp_std   ON gp_std.gig_id = g.id   AND gp_std.package_type = 'standard'
        LEFT JOIN gig_packages gp_prem  ON gp_prem.gig_id = g.id  AND gp_prem.package_type = 'premium'
        WHERE g.status = 'active'
          ${categoryFilter}
          ${minPriceFilter}
          ${maxPriceFilter}
          ${ratingFilter}
          ${searchFilter}
        ORDER BY g.orders_count DESC, g.avg_rating DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const [{ count }] = await this.sql`
        SELECT COUNT(*) FROM gigs g
        JOIN users u ON u.id = g.freelancer_id AND u.status = 'active'
        WHERE g.status = 'active'
          ${category_id ? this.sql`AND g.category_id = ${category_id}` : this.sql``}
          ${searchCountFilter}
      `;

      const result = { data: gigs, total: Number(count), page, limit };
      await this.cache.set(cacheKey, result, 60);
      return result;
    } catch (err) {
      this.logger.error('findAll failed', err);
      throw new InternalServerErrorException(
        'Failed to fetch gigs. Please try again later.',
      );
    }
  }

  async findOne(id: string) {
    const [gig] = await this.sql`
      SELECT g.*, p.full_name_en AS freelancer_name_en, p.full_name_ar AS freelancer_name_ar,
             p.avatar_url, p.avg_rating AS freelancer_rating, p.review_count AS freelancer_reviews,
             p.total_jobs_done, p.city, c.name_en AS category_name_en, c.name_ar AS category_name_ar
      FROM gigs g
      JOIN profiles p ON p.user_id = g.freelancer_id
      JOIN categories c ON c.id = g.category_id
      WHERE g.id = ${id} AND g.status != 'deleted'
    `;
    if (!gig) throw new NotFoundException('Gig not found');

    const packages = await this.sql`SELECT * FROM gig_packages WHERE gig_id = ${id} ORDER BY package_type`;
    const skills = await this.sql`
      SELECT s.id, s.name_en, s.name_ar FROM gig_skills gs JOIN skills s ON s.id = gs.skill_id WHERE gs.gig_id = ${id}
    `;
    const reviews = await this.sql`
      SELECT r.*, p.full_name_en AS reviewer_name, p.avatar_url AS reviewer_avatar
      FROM reviews r
      JOIN orders o ON o.id = r.order_id
      JOIN profiles p ON p.user_id = r.reviewer_id
      WHERE o.gig_id = ${id} AND r.is_public = true
      ORDER BY r.created_at DESC LIMIT 10
    `;

    // increment view count
    await this.sql`UPDATE gigs SET views_count = views_count + 1 WHERE id = ${id}`;

    return { ...gig, packages, skills, reviews };
  }

  async update(id: string, freelancerId: string, dto: any) {
    const [gig] = await this.sql`SELECT id, freelancer_id FROM gigs WHERE id = ${id}`;
    if (!gig) throw new NotFoundException('Gig not found');
    if (gig.freelancer_id !== freelancerId) throw new ForbiddenException('Not your gig');

    await this.sql`
      UPDATE gigs SET
        title_en = COALESCE(${dto.title_en ?? null}, title_en),
        title_ar = COALESCE(${dto.title_ar ?? null}, title_ar),
        description_en = COALESCE(${dto.description_en ?? null}, description_en),
        description_ar = COALESCE(${dto.description_ar ?? null}, description_ar),
        price = COALESCE(${dto.price ?? null}, price),
        delivery_days = COALESCE(${dto.delivery_days ?? null}, delivery_days),
        gallery_urls = COALESCE(${dto.gallery_urls ?? null}, gallery_urls),
        requirements_en = COALESCE(${dto.requirements_en ?? null}, requirements_en),
        status = COALESCE(${dto.status ?? null}, status)
      WHERE id = ${id}
    `;
    await this.cache.delByPattern('gigs:list:*');
    return this.findOne(id);
  }

  async delete(id: string, freelancerId: string) {
    const [gig] = await this.sql`SELECT freelancer_id FROM gigs WHERE id = ${id}`;
    if (!gig) throw new NotFoundException('Gig not found');
    if (gig.freelancer_id !== freelancerId) throw new ForbiddenException('Not your gig');

    await this.sql`UPDATE gigs SET status = 'deleted' WHERE id = ${id}`;
    await this.cache.delByPattern('gigs:list:*');
    return { message: 'Gig deleted' };
  }

  async getMyGigs(freelancerId: string) {
    return this.sql`
      SELECT g.*, c.name_en AS category_name_en
      FROM gigs g JOIN categories c ON c.id = g.category_id
      WHERE g.freelancer_id = ${freelancerId} AND g.status != 'deleted'
      ORDER BY g.created_at DESC
    `;
  }

  // Public gigs for a freelancer's profile page
  async getByFreelancer(freelancerId: string) {
    return this.sql`
      SELECT g.id, g.title_en, g.title_ar, g.gallery_urls, g.price,
             g.avg_rating, g.review_count, g.orders_count, g.status
      FROM gigs g
      WHERE g.freelancer_id = ${freelancerId} AND g.status = 'active'
      ORDER BY g.orders_count DESC
      LIMIT 12
    `;
  }
}
