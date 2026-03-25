import {
  Injectable, NotFoundException, ForbiddenException,
  ConflictException, BadRequestException, Inject,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private notifications: NotificationsService,
  ) {}

  async createForOrder(reviewerId: string, dto: any) {
    const [order] = await this.sql`
      SELECT * FROM orders WHERE id = ${dto.order_id} AND status = 'completed'
    `;
    if (!order) throw new NotFoundException('Order not found or not completed');
    if (order.client_id !== reviewerId && order.freelancer_id !== reviewerId) {
      throw new ForbiddenException('You are not part of this order');
    }

    const revieweeId = order.client_id === reviewerId ? order.freelancer_id : order.client_id;

    const [existing] = await this.sql`
      SELECT id FROM reviews WHERE order_id = ${dto.order_id} AND reviewer_id = ${reviewerId}
    `;
    if (existing) throw new ConflictException('You already reviewed this order');

    const [review] = await this.sql`
      INSERT INTO reviews (order_id, reviewer_id, reviewee_id, overall_rating,
                           communication, quality, timeliness, comment_en, comment_ar)
      VALUES (${dto.order_id}, ${reviewerId}, ${revieweeId}, ${dto.overall_rating},
              ${dto.communication ?? null}, ${dto.quality ?? null}, ${dto.timeliness ?? null},
              ${dto.comment_en ?? null}, ${dto.comment_ar ?? null})
      RETURNING *
    `;

    // Update denormalized avg_rating + review_count on the reviewee's profile
    await this.sql`
      UPDATE profiles
      SET avg_rating   = (SELECT ROUND(AVG(overall_rating)::numeric, 2) FROM reviews WHERE reviewee_id = ${revieweeId} AND is_public = true),
          review_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = ${revieweeId} AND is_public = true)
      WHERE user_id = ${revieweeId}
    `;

    // Also update avg_rating on the gig if it's an order review for a freelancer
    if (review.order_id) {
      await this.sql`
        UPDATE gigs
        SET avg_rating   = (SELECT ROUND(AVG(r.overall_rating)::numeric, 2) FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.gig_id = gigs.id AND r.is_public = true),
            review_count = (SELECT COUNT(*) FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.gig_id = gigs.id AND r.is_public = true)
        WHERE id = (SELECT gig_id FROM orders WHERE id = ${review.order_id})
      `;
    }

    await this.notifications.create({
      userId: revieweeId,
      type: 'review_received',
      title_en: 'New Review Received',
      title_ar: 'تم استلام تقييم جديد',
      body_en: `You received a ${dto.overall_rating}-star review.`,
      body_ar: `استلمت تقييم ${dto.overall_rating} نجوم.`,
      entity_type: 'review',
      entity_id: review.id,
    });

    return review;
  }

  async createForContract(reviewerId: string, contractId: string, dto: any) {
    const [contract] = await this.sql`
      SELECT * FROM contracts WHERE id = ${contractId}
    `;
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== reviewerId && contract.freelancer_id !== reviewerId) {
      throw new ForbiddenException('You are not part of this contract');
    }

    const revieweeId = contract.client_id === reviewerId ? contract.freelancer_id : contract.client_id;

    const [existing] = await this.sql`
      SELECT id FROM reviews WHERE contract_id = ${contractId} AND reviewer_id = ${reviewerId}
    `;
    if (existing) throw new ConflictException('You already reviewed this contract');

    const [review] = await this.sql`
      INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, overall_rating,
                           comment_en, comment_ar)
      VALUES (${contractId}, ${reviewerId}, ${revieweeId}, ${dto.rating ?? dto.overall_rating},
              ${dto.comment_en ?? null}, ${dto.comment_ar ?? null})
      RETURNING *
    `;

    // Update denormalized avg_rating + review_count on the reviewee's profile
    await this.sql`
      UPDATE profiles
      SET avg_rating   = (SELECT ROUND(AVG(overall_rating)::numeric, 2) FROM reviews WHERE reviewee_id = ${revieweeId} AND is_public = true),
          review_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = ${revieweeId} AND is_public = true)
      WHERE user_id = ${revieweeId}
    `;

    await this.notifications.create({
      userId: revieweeId,
      type: 'review_received',
      title_en: 'New Review Received',
      title_ar: 'تم استلام تقييم جديد',
      body_en: `You received a ${dto.rating ?? dto.overall_rating}-star review.`,
      body_ar: `استلمت تقييم ${dto.rating ?? dto.overall_rating} نجوم.`,
      entity_type: 'review',
      entity_id: review.id,
    });

    return review;
  }

  async getFreelancerReviews(freelancerId: string) {
    return this.sql`
      SELECT r.*, p.full_name_en AS reviewer_name, p.avatar_url AS reviewer_avatar,
             g.title_en AS gig_title
      FROM reviews r
      JOIN profiles p ON p.user_id = r.reviewer_id
      LEFT JOIN orders o ON o.id = r.order_id
      LEFT JOIN gigs g ON g.id = o.gig_id
      WHERE r.reviewee_id = ${freelancerId} AND r.is_public = true
      ORDER BY r.created_at DESC
    `;
  }
}
