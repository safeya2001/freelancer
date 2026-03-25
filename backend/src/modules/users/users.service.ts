import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  async getProfile(userId: string) {
    const [profile] = await this.sql`
      SELECT u.id, u.email, u.phone, u.role, u.status, u.preferred_language,
             u.email_verified, u.phone_verified, u.created_at,
             p.full_name_en, p.full_name_ar, p.professional_title_en,
             p.professional_title_ar, p.bio_en, p.bio_ar, p.avatar_url,
             p.city, p.company_name, p.hourly_rate, p.availability,
             p.identity_verified, p.avg_rating, p.review_count,
             p.total_earned, p.total_spent, p.total_jobs_done
      FROM users u
      JOIN profiles p ON p.user_id = u.id
      WHERE u.id = ${userId}
    `;
    if (!profile) throw new NotFoundException('User not found');

    const skills = await this.sql`
      SELECT s.id, s.name_en, s.name_ar, fs.level
      FROM freelancer_skills fs
      JOIN skills s ON s.id = fs.skill_id
      WHERE fs.user_id = ${userId}
    `;

    const portfolio = await this.sql`
      SELECT * FROM portfolio_items WHERE user_id = ${userId} ORDER BY sort_order
    `;

    const education = await this.sql`
      SELECT * FROM education WHERE user_id = ${userId} ORDER BY start_year DESC
    `;

    const certifications = await this.sql`
      SELECT * FROM certifications WHERE user_id = ${userId} ORDER BY issue_date DESC
    `;

    return { ...profile, skills, portfolio, education, certifications };
  }

  async updateProfile(userId: string, dto: any) {
    const {
      full_name_en, full_name_ar, professional_title_en, professional_title_ar,
      bio_en, bio_ar, city, company_name, hourly_rate, availability,
      preferred_language,
    } = dto;

    await this.sql`
      UPDATE profiles SET
        full_name_en = COALESCE(${full_name_en ?? null}, full_name_en),
        full_name_ar = COALESCE(${full_name_ar ?? null}, full_name_ar),
        professional_title_en = COALESCE(${professional_title_en ?? null}, professional_title_en),
        professional_title_ar = COALESCE(${professional_title_ar ?? null}, professional_title_ar),
        bio_en = COALESCE(${bio_en ?? null}, bio_en),
        bio_ar = COALESCE(${bio_ar ?? null}, bio_ar),
        city = COALESCE(${city ?? null}, city),
        company_name = COALESCE(${company_name ?? null}, company_name),
        hourly_rate = COALESCE(${hourly_rate ?? null}, hourly_rate),
        availability = COALESCE(${availability ?? null}, availability)
      WHERE user_id = ${userId}
    `;

    if (preferred_language) {
      await this.sql`UPDATE users SET preferred_language = ${preferred_language} WHERE id = ${userId}`;
    }

    return this.getProfile(userId);
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    await this.sql`UPDATE profiles SET avatar_url = ${avatarUrl} WHERE user_id = ${userId}`;
    return { avatar_url: avatarUrl };
  }

  async updateSkills(userId: string, skills: { skill_id: string; level: string }[]) {
    await this.sql`DELETE FROM freelancer_skills WHERE user_id = ${userId}`;
    if (skills.length > 0) {
      await this.sql`
        INSERT INTO freelancer_skills (user_id, skill_id, level)
        VALUES ${this.sql(skills.map((s) => ({ user_id: userId, skill_id: s.skill_id, level: s.level })))}
      `;
    }
    return { message: 'Skills updated' };
  }

  async addPortfolioItem(userId: string, item: any) {
    const [created] = await this.sql`
      INSERT INTO portfolio_items (user_id, title_en, title_ar, description_en, description_ar, project_url, image_urls, pdf_url)
      VALUES (
        ${userId}, ${item.title_en}, ${item.title_ar ?? null},
        ${item.description_en ?? null}, ${item.description_ar ?? null},
        ${item.project_url ?? null}, ${item.image_urls ?? []}, ${item.pdf_url ?? null}
      )
      RETURNING *
    `;
    return created;
  }

  async deletePortfolioItem(userId: string, itemId: string) {
    await this.sql`DELETE FROM portfolio_items WHERE id = ${itemId} AND user_id = ${userId}`;
    return { message: 'Deleted' };
  }

  async uploadIdentityDoc(userId: string, fileUrl: string) {
    await this.sql`
      UPDATE profiles SET identity_doc_url = ${fileUrl}, identity_verified = 'pending'
      WHERE user_id = ${userId}
    `;
    return { message: 'Identity document submitted for review' };
  }

  async getWallet(userId: string) {
    const [wallet] = await this.sql`SELECT * FROM wallets WHERE user_id = ${userId}`;
    return wallet || { balance: 0, pending_balance: 0, total_earned: 0, total_withdrawn: 0 };
  }

  async getCategories() {
    return this.sql`SELECT * FROM categories WHERE is_active = true ORDER BY sort_order`;
  }

  async getSkillsList() {
    return this.sql`SELECT * FROM skills WHERE is_active = true ORDER BY name_en`;
  }
}
