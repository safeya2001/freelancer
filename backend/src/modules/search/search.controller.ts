import { Controller, Get, Query, Inject } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

/**
 * Search controller.
 *
 * PostgreSQL cannot infer types for bare NULL parameters,
 * and casting '' to an enum type throws an error.
 * Solution: build optional filter fragments conditionally so parameters
 * are only included when a value is actually provided.
 */
@Controller('search')
export class SearchController {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  @Get('freelancers')
  async searchFreelancers(@Query() q: any) {
    const {
      keyword, city, min_rate, max_rate, min_rating, available,
      page = 1, limit = 12,
    } = q;
    const offset = (Number(page) - 1) * Number(limit);

    const kw = keyword ? `%${keyword}%` : null;

    // Build filter fragments only when values are present
    const cityFilter = city
      ? this.sql`AND vf.city = ${city}::jordan_city`
      : this.sql``;
    const minRateFilter = min_rate
      ? this.sql`AND vf.hourly_rate >= ${Number(min_rate)}`
      : this.sql``;
    const maxRateFilter = max_rate
      ? this.sql`AND vf.hourly_rate <= ${Number(max_rate)}`
      : this.sql``;
    const minRatingFilter = min_rating
      ? this.sql`AND vf.avg_rating >= ${Number(min_rating)}`
      : this.sql``;
    const availableFilter = available
      ? this.sql`AND vf.availability = true`
      : this.sql``;
    const keywordFilter = kw
      ? this.sql`AND (
          vf.full_name_en ILIKE ${kw}
          OR vf.professional_title_en ILIKE ${kw}
          OR vf.skills_en::text ILIKE ${kw}
        )`
      : this.sql``;

    return this.sql`
      SELECT vf.*
      FROM v_freelancer_search vf
      WHERE vf.status = 'active'
        ${keywordFilter}
        ${cityFilter}
        ${minRateFilter}
        ${maxRateFilter}
        ${minRatingFilter}
        ${availableFilter}
      ORDER BY vf.avg_rating DESC, vf.review_count DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;
  }

  @Get('gigs')
  async searchGigs(@Query() q: any) {
    const { keyword, category_id, min_price, max_price, min_rating, city, page = 1, limit = 12 } = q;
    const offset = (Number(page) - 1) * Number(limit);
    const kw = keyword ? `%${keyword}%` : null;

    const keywordFilter = kw
      ? this.sql`AND (
          vg.title_en ILIKE ${kw}
          OR vg.title_ar ILIKE ${kw}
          OR vg.description_en ILIKE ${kw}
        )`
      : this.sql``;
    const categoryFilter = category_id
      ? this.sql`AND vg.category_id = ${category_id}::uuid`
      : this.sql``;
    const minPriceFilter = min_price
      ? this.sql`AND COALESCE(vg.basic_price, vg.price) >= ${Number(min_price)}`
      : this.sql``;
    const maxPriceFilter = max_price
      ? this.sql`AND COALESCE(vg.basic_price, vg.price) <= ${Number(max_price)}`
      : this.sql``;
    const minRatingFilter = min_rating
      ? this.sql`AND vg.avg_rating >= ${Number(min_rating)}`
      : this.sql``;
    const cityFilter = city
      ? this.sql`AND vg.freelancer_city = ${city}::jordan_city`
      : this.sql``;

    return this.sql`
      SELECT vg.*
      FROM v_gig_search vg
      WHERE 1 = 1
        ${keywordFilter}
        ${categoryFilter}
        ${minPriceFilter}
        ${maxPriceFilter}
        ${minRatingFilter}
        ${cityFilter}
      ORDER BY vg.orders_count DESC, vg.avg_rating DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;
  }

  @Get('projects')
  async searchProjects(@Query() q: any) {
    const { keyword, category_id, budget_type, city, page = 1, limit = 12 } = q;
    const offset = (Number(page) - 1) * Number(limit);
    const kw = keyword ? `%${keyword}%` : null;

    const keywordFilter = kw
      ? this.sql`AND (p.title_en ILIKE ${kw} OR p.title_ar ILIKE ${kw})`
      : this.sql``;
    const categoryFilter = category_id
      ? this.sql`AND p.category_id = ${category_id}::uuid`
      : this.sql``;
    const budgetTypeFilter = budget_type
      ? this.sql`AND p.budget_type = ${budget_type}::project_budget_type`
      : this.sql``;
    const cityFilter = city
      ? this.sql`AND p.preferred_city = ${city}::jordan_city`
      : this.sql``;

    return this.sql`
      SELECT p.id, p.title_en, p.title_ar, p.description_en, p.budget_type,
             p.budget_min, p.budget_max, p.deadline, p.preferred_city,
             p.proposals_count, p.created_at,
             c.name_en AS category_name_en, c.name_ar AS category_name_ar,
             pr.full_name_en AS client_name, pr.avatar_url AS client_avatar
      FROM projects p
      JOIN profiles pr ON pr.user_id = p.client_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'open'
        ${keywordFilter}
        ${categoryFilter}
        ${budgetTypeFilter}
        ${cityFilter}
      ORDER BY p.created_at DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `;
  }
}
