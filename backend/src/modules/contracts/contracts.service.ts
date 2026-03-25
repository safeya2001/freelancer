import { Injectable, NotFoundException, ForbiddenException, Inject } from '@nestjs/common';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class ContractsService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  async findOne(id: string, userId: string) {
    const [contract] = await this.sql`
      SELECT c.*,
             cp.full_name_en AS client_name, cp.avatar_url AS client_avatar,
             fp.full_name_en AS freelancer_name, fp.avatar_url AS freelancer_avatar
      FROM contracts c
      JOIN profiles cp ON cp.user_id = c.client_id
      JOIN profiles fp ON fp.user_id = c.freelancer_id
      WHERE c.id = ${id}
    `;
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== userId && contract.freelancer_id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const milestones = await this.sql`
      SELECT * FROM milestones WHERE contract_id = ${id} ORDER BY sort_order
    `;
    const [chatRoom] = await this.sql`SELECT id FROM chat_rooms WHERE contract_id = ${id}`;

    return { ...contract, milestones, chat_room_id: chatRoom?.id };
  }

  async getMyContracts(userId: string, role: string) {
    const field = role === 'client' ? 'client_id' : 'freelancer_id';
    return this.sql`
      SELECT c.*, cp.full_name_en AS client_name, fp.full_name_en AS freelancer_name,
             (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id AND m.status = 'approved') AS approved_milestones,
             (SELECT COUNT(*) FROM milestones m WHERE m.contract_id = c.id) AS total_milestones
      FROM contracts c
      JOIN profiles cp ON cp.user_id = c.client_id
      JOIN profiles fp ON fp.user_id = c.freelancer_id
      WHERE c.${this.sql(field)} = ${userId}
      ORDER BY c.created_at DESC
    `;
  }

  async addMilestone(contractId: string, clientId: string, dto: any) {
    const [contract] = await this.sql`SELECT client_id, status FROM contracts WHERE id = ${contractId}`;
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== clientId) throw new ForbiddenException('Access denied');
    if (contract.status !== 'active') throw new ForbiddenException('Contract is not active');

    const [ms] = await this.sql`
      INSERT INTO milestones (contract_id, title_en, title_ar, description_en, amount, due_date, sort_order)
      VALUES (${contractId}, ${dto.title_en}, ${dto.title_ar ?? null},
              ${dto.description_en ?? null}, ${dto.amount}, ${dto.due_date ?? null},
              COALESCE((SELECT MAX(sort_order)+1 FROM milestones WHERE contract_id = ${contractId}), 0))
      RETURNING *
    `;
    return ms;
  }

  async complete(id: string, clientId: string) {
    const [contract] = await this.sql`SELECT client_id, freelancer_id, total_amount FROM contracts WHERE id = ${id}`;
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.client_id !== clientId) throw new ForbiddenException('Access denied');

    await this.sql`UPDATE contracts SET status = 'completed' WHERE id = ${id}`;
    await this.sql`UPDATE projects SET status = 'completed' WHERE id = (SELECT project_id FROM contracts WHERE id = ${id})`;

    return { message: 'Contract completed' };
  }
}
