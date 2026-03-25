import {
  Injectable, NotFoundException, ForbiddenException,
  BadRequestException, Inject,
} from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';
import { NotificationsService } from '../notifications/notifications.service';
import { EscrowService } from '../escrow/escrow.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class OrdersService {
  constructor(
    @Inject(DB) private sql: postgres.Sql,
    private notifications: NotificationsService,
    private escrow: EscrowService,
    private email: EmailService,
  ) {}

  async create(clientId: string, dto: { gig_id: string; package_id?: string; requirements?: string; }) {
    const [gig] = await this.sql`SELECT id, freelancer_id, price, delivery_days FROM gigs WHERE id = ${dto.gig_id} AND status = 'active'`;
    if (!gig) throw new NotFoundException('Gig not found or inactive');
    if (gig.freelancer_id === clientId) throw new BadRequestException('Cannot buy your own gig');

    let price = Number(gig.price);
    let deliveryDays = gig.delivery_days;

    if (dto.package_id) {
      const [pkg] = await this.sql`SELECT price, delivery_days FROM gig_packages WHERE id = ${dto.package_id} AND gig_id = ${dto.gig_id}`;
      if (pkg) { price = Number(pkg.price); deliveryDays = pkg.delivery_days; }
    }

    const deadline = new Date(Date.now() + deliveryDays * 24 * 60 * 60 * 1000);

    const [order] = await this.sql`
      INSERT INTO orders (gig_id, package_id, client_id, freelancer_id, price, delivery_days, deadline, requirements, commission_rate)
      VALUES (${dto.gig_id}, ${dto.package_id ?? null}, ${clientId}, ${gig.freelancer_id},
              ${price}, ${deliveryDays}, ${deadline}, ${dto.requirements ?? null}, 10)
      RETURNING *
    `;

    // Create chat room
    await this.sql`
      INSERT INTO chat_rooms (order_id, client_id, freelancer_id)
      VALUES (${order.id}, ${clientId}, ${gig.freelancer_id})
    `;

    await this.notifications.create({
      userId: gig.freelancer_id,
      type: 'order_placed',
      title_en: 'New Order Received!',
      title_ar: 'تم استلام طلب جديد!',
      body_en: 'You have a new order waiting.',
      body_ar: 'لديك طلب جديد ينتظرك.',
      entity_type: 'order',
      entity_id: order.id,
    });

    // Email notification to freelancer
    const [freelancer] = await this.sql`SELECT email FROM users WHERE id = ${gig.freelancer_id}`;
    if (freelancer?.email) {
      await this.email.sendOrderNotification(
        freelancer.email,
        'New Order Received!',
        'You have a new order waiting. Log in to review and start working.',
        order.id,
      );
    }

    return order;
  }

  async findOne(id: string, userId: string) {
    const [order] = await this.sql`
      SELECT o.*, g.title_en AS gig_title, g.title_ar AS gig_title_ar,
             g.gallery_urls, gp.name_en AS package_name,
             cp.full_name_en AS client_name, cp.avatar_url AS client_avatar,
             fp.full_name_en AS freelancer_name, fp.avatar_url AS freelancer_avatar
      FROM orders o
      JOIN gigs g ON g.id = o.gig_id
      JOIN profiles cp ON cp.user_id = o.client_id
      JOIN profiles fp ON fp.user_id = o.freelancer_id
      LEFT JOIN gig_packages gp ON gp.id = o.package_id
      WHERE o.id = ${id}
    `;
    if (!order) throw new NotFoundException('Order not found');
    if (order.client_id !== userId && order.freelancer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const [chatRoom] = await this.sql`SELECT id FROM chat_rooms WHERE order_id = ${id}`;
    return { ...order, chat_room_id: chatRoom?.id };
  }

  async getMyOrders(userId: string, role: string) {
    // Use conditional SQL fragments instead of sql.unsafe() to avoid SQL injection risk
    const roleFilter = role === 'client'
      ? this.sql`o.client_id = ${userId}`
      : this.sql`o.freelancer_id = ${userId}`;

    return this.sql`
      SELECT o.id, o.status, o.price, o.delivery_days, o.deadline, o.created_at,
             g.title_en AS gig_title, g.gallery_urls,
             cp.full_name_en AS client_name, fp.full_name_en AS freelancer_name
      FROM orders o
      JOIN gigs g ON g.id = o.gig_id
      JOIN profiles cp ON cp.user_id = o.client_id
      JOIN profiles fp ON fp.user_id = o.freelancer_id
      WHERE ${roleFilter}
      ORDER BY o.created_at DESC
    `;
  }

  async deliver(orderId: string, freelancerId: string, dto: any) {
    const [order] = await this.sql`SELECT freelancer_id, status FROM orders WHERE id = ${orderId}`;
    if (!order) throw new NotFoundException('Order not found');
    if (order.freelancer_id !== freelancerId) throw new ForbiddenException('Access denied');
    if (!['in_progress', 'revision_requested'].includes(order.status)) {
      throw new BadRequestException('Order cannot be delivered in current status');
    }

    await this.sql`
      UPDATE orders SET
        status = 'delivered',
        delivery_note = ${dto.delivery_note ?? null},
        delivery_urls = ${dto.delivery_urls ?? []},
        delivered_at = NOW()
      WHERE id = ${orderId}
    `;

    const [o] = await this.sql`SELECT client_id FROM orders WHERE id = ${orderId}`;
    await this.notifications.create({
      userId: o.client_id,
      type: 'order_delivered',
      title_en: 'Order Delivered',
      title_ar: 'تم تسليم الطلب',
      body_en: 'The freelancer has delivered your order. Please review and accept.',
      body_ar: 'قام المستقل بتسليم طلبك. يرجى المراجعة والقبول.',
      entity_type: 'order',
      entity_id: orderId,
    });

    return { message: 'Order delivered' };
  }

  async complete(orderId: string, clientId: string) {
    const [order] = await this.sql`SELECT client_id, status FROM orders WHERE id = ${orderId}`;
    if (!order) throw new NotFoundException('Order not found');
    if (order.client_id !== clientId) throw new ForbiddenException('Access denied');
    if (order.status !== 'delivered') throw new BadRequestException('Order is not delivered');

    await this.sql`UPDATE orders SET status = 'completed', completed_at = NOW() WHERE id = ${orderId}`;

    // Release escrow
    await this.escrow.releaseForOrder(orderId);

    // Update gig orders count
    await this.sql`UPDATE gigs SET orders_count = orders_count + 1 WHERE id = (SELECT gig_id FROM orders WHERE id = ${orderId})`;

    const [completedOrder] = await this.sql`SELECT freelancer_id FROM orders WHERE id = ${orderId}`;
    await this.notifications.create({
      userId: completedOrder.freelancer_id,
      type: 'order_completed',
      title_en: 'Order Completed & Payment Released',
      title_ar: 'اكتمل الطلب وتم إصدار الدفعة',
      body_en: 'Your order was marked complete. Payment has been released.',
      body_ar: 'تم إكمال طلبك. تم إصدار الدفعة.',
      entity_type: 'order',
      entity_id: orderId,
    });

    // Email notification to freelancer
    const [freelancerUser] = await this.sql`SELECT email FROM users WHERE id = ${completedOrder.freelancer_id}`;
    if (freelancerUser?.email) {
      await this.email.sendOrderNotification(
        freelancerUser.email,
        'Order Completed & Payment Released',
        'Your order was marked complete. Payment has been released to your wallet.',
        orderId,
      );
    }

    return { message: 'Order completed and payment released' };
  }

  async requestRevision(orderId: string, clientId: string, note: string) {
    const [order] = await this.sql`SELECT client_id, status FROM orders WHERE id = ${orderId}`;
    if (!order) throw new NotFoundException('Order not found');
    if (order.client_id !== clientId) throw new ForbiddenException('Access denied');
    if (order.status !== 'delivered') throw new BadRequestException('Order is not in delivered state');

    await this.sql`UPDATE orders SET status = 'revision_requested' WHERE id = ${orderId}`;

    const [o] = await this.sql`SELECT freelancer_id FROM orders WHERE id = ${orderId}`;
    await this.notifications.create({
      userId: o.freelancer_id,
      type: 'order_revision_requested',
      title_en: 'Revision Requested',
      title_ar: 'تم طلب مراجعة',
      body_en: note,
      body_ar: note,
      entity_type: 'order',
      entity_id: orderId,
    });

    return { message: 'Revision requested' };
  }

  async cancel(orderId: string, userId: string, reason: string) {
    const [order] = await this.sql`SELECT client_id, freelancer_id, status FROM orders WHERE id = ${orderId}`;
    if (!order) throw new NotFoundException('Order not found');
    if (order.client_id !== userId && order.freelancer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }
    if (['completed', 'cancelled'].includes(order.status)) {
      throw new BadRequestException('Order cannot be cancelled');
    }

    await this.sql`
      UPDATE orders SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = ${reason}
      WHERE id = ${orderId}
    `;

    // Refund escrow
    await this.escrow.refundEscrow(orderId);

    return { message: 'Order cancelled' };
  }
}
