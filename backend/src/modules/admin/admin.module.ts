import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { DocumentsModule } from '../documents/documents.module';
import { ReportsModule } from '../reports/reports.module';
import { EmailModule } from '../email/email.module';
import { AuthModule } from '../auth/auth.module';
import { EscrowModule } from '../escrow/escrow.module';

@Module({
  imports: [NotificationsModule, PaymentsModule, DocumentsModule, ReportsModule, EmailModule, AuthModule, EscrowModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
