import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { GigsModule } from './modules/gigs/gigs.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ProposalsModule } from './modules/proposals/proposals.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { MilestonesModule } from './modules/milestones/milestones.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ChatModule } from './modules/chat/chat.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { SearchModule } from './modules/search/search.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { WalletsModule } from './modules/wallets/wallets.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './modules/email/email.module';
import { SmsModule } from './modules/sms/sms.module';
import { AppCacheModule } from './common/cache/cache.module';
import { StorageModule } from './modules/storage/storage.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ContentModule } from './modules/content/content.module';
import { CsrfGuard } from './common/guards/csrf.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    // Infrastructure (global)
    DatabaseModule,
    EmailModule,
    SmsModule,
    AppCacheModule,
    StorageModule,
    // Feature modules
    AuthModule,
    UsersModule,
    GigsModule,
    ProjectsModule,
    ProposalsModule,
    ContractsModule,
    MilestonesModule,
    OrdersModule,
    ChatModule,
    PaymentsModule,
    EscrowModule,
    WithdrawalsModule,
    AdminModule,
    NotificationsModule,
    ReviewsModule,
    DisputesModule,
    DocumentsModule,
    SearchModule,
    TicketsModule,
    UploadsModule,
    WalletsModule,
    ReportsModule,
    ContentModule,
    HealthModule,
  ],
  providers: [
    // Apply CSRF protection globally to all state-mutating endpoints
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
  ],
})
export class AppModule {}
