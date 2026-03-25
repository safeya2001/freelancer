import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class ContentService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  // ─── BANNERS (public: active only) ───────────────────────────
  async getBanners(activeOnly = true) {
    const rows = activeOnly
      ? await this.sql`
          SELECT id, title_en, title_ar, image_url, link_url, sort_order
          FROM banners WHERE is_active = TRUE
          ORDER BY sort_order ASC, created_at ASC
        `
      : await this.sql`
          SELECT id, title_en, title_ar, image_url, link_url, sort_order, is_active, created_at
          FROM banners
          ORDER BY sort_order ASC, created_at ASC
        `;
    return rows;
  }

  async createBanner(dto: {
    title_en?: string; title_ar?: string; image_url: string; link_url?: string;
    sort_order?: number; is_active?: boolean;
  }) {
    const [row] = await this.sql`
      INSERT INTO banners (title_en, title_ar, image_url, link_url, sort_order, is_active)
      VALUES (${dto.title_en ?? null}, ${dto.title_ar ?? null}, ${dto.image_url},
              ${dto.link_url ?? null}, ${dto.sort_order ?? 0}, ${dto.is_active ?? true})
      RETURNING *
    `;
    return row;
  }

  async updateBanner(id: string, dto: Partial<{
    title_en: string; title_ar: string; image_url: string; link_url: string;
    sort_order: number; is_active: boolean;
  }>) {
    const [row] = await this.sql`
      UPDATE banners SET
        title_en = COALESCE(${dto.title_en ?? null}, title_en),
        title_ar = COALESCE(${dto.title_ar ?? null}, title_ar),
        image_url = COALESCE(${dto.image_url ?? null}, image_url),
        link_url = COALESCE(${dto.link_url ?? null}, link_url),
        sort_order = COALESCE(${dto.sort_order ?? null}, sort_order),
        is_active = COALESCE(${dto.is_active ?? null}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) throw new NotFoundException('Banner not found');
    return row;
  }

  async deleteBanner(id: string) {
    const result = await this.sql`DELETE FROM banners WHERE id = ${id}`;
    return { deleted: (result as any).count > 0 };
  }

  // ─── FAQ ─────────────────────────────────────────────────────
  async getFaq() {
    return this.sql`
      SELECT id, question_en, question_ar, answer_en, answer_ar, sort_order
      FROM faq
      ORDER BY sort_order ASC, created_at ASC
    `;
  }

  async createFaq(dto: { question_en: string; question_ar?: string; answer_en: string; answer_ar?: string; sort_order?: number }) {
    const [row] = await this.sql`
      INSERT INTO faq (question_en, question_ar, answer_en, answer_ar, sort_order)
      VALUES (${dto.question_en}, ${dto.question_ar ?? null}, ${dto.answer_en},
              ${dto.answer_ar ?? null}, ${dto.sort_order ?? 0})
      RETURNING *
    `;
    return row;
  }

  async updateFaq(id: string, dto: Partial<{ question_en: string; question_ar: string; answer_en: string; answer_ar: string; sort_order: number }>) {
    const [row] = await this.sql`
      UPDATE faq SET
        question_en = COALESCE(${dto.question_en ?? null}, question_en),
        question_ar = COALESCE(${dto.question_ar ?? null}, question_ar),
        answer_en = COALESCE(${dto.answer_en ?? null}, answer_en),
        answer_ar = COALESCE(${dto.answer_ar ?? null}, answer_ar),
        sort_order = COALESCE(${dto.sort_order ?? null}, sort_order)
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) throw new NotFoundException('FAQ not found');
    return row;
  }

  async deleteFaq(id: string) {
    await this.sql`DELETE FROM faq WHERE id = ${id}`;
    return { deleted: true };
  }

  // ─── PUBLIC PLATFORM STATS ───────────────────────────────────
  async platformStats() {
    const [row] = await this.sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'freelancer' AND status = 'active') AS freelancers,
        (SELECT COUNT(*) FROM users WHERE role = 'client'     AND status = 'active') AS clients,
        (SELECT COUNT(*) FROM projects WHERE status IN ('completed', 'in_progress', 'open')) AS projects
    `;
    return {
      freelancers: Number(row.freelancers),
      clients:     Number(row.clients),
      projects:    Number(row.projects),
    };
  }

  // ─── CMS PAGES (terms, privacy, about) ───────────────────────
  async getPage(key: string) {
    const [row] = await this.sql`
      SELECT page_key, content, updated_at FROM cms_pages WHERE page_key = ${key}
    `;
    if (!row) throw new NotFoundException('Page not found');
    return row;
  }

  async getPages(keys: string[]) {
    if (keys.length === 0) return [];
    const rows = await this.sql`
      SELECT page_key, content, updated_at FROM cms_pages
      WHERE page_key = ANY(${keys})
    `;
    return rows;
  }

  async updatePage(key: string, content: string, adminId: string) {
    const [row] = await this.sql`
      INSERT INTO cms_pages (page_key, content, updated_at, updated_by)
      VALUES (${key}, ${content}, NOW(), ${adminId})
      ON CONFLICT (page_key) DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
      RETURNING page_key, content, updated_at
    `;
    return row;
  }
}
