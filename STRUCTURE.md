# Freelance Platform — Project Structure

```
freelance/
├── docker-compose.yml
├── .env.example
├── nginx/
│   └── nginx.conf
├── scripts/
│   └── init-db.sh
│
├── backend/                          ← NestJS API
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── config/
│       │   ├── database.config.ts
│       │   ├── jwt.config.ts
│       │   ├── stripe.config.ts
│       │   └── redis.config.ts
│       ├── database/
│       │   └── migrations/
│       │       └── 001_initial_schema.sql
│       ├── common/
│       │   ├── decorators/
│       │   │   ├── current-user.decorator.ts
│       │   │   └── roles.decorator.ts
│       │   ├── filters/
│       │   │   └── http-exception.filter.ts
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   └── roles.guard.ts
│       │   ├── interceptors/
│       │   │   └── transform.interceptor.ts
│       │   └── pipes/
│       │       └── validation.pipe.ts
│       └── modules/
│           ├── auth/                 ← JWT, OAuth, OTP
│           │   ├── auth.module.ts
│           │   ├── auth.controller.ts
│           │   ├── auth.service.ts
│           │   ├── strategies/
│           │   │   ├── jwt.strategy.ts
│           │   │   └── google.strategy.ts
│           │   └── dto/
│           │       ├── register.dto.ts
│           │       └── login.dto.ts
│           ├── users/
│           │   ├── users.module.ts
│           │   ├── users.controller.ts
│           │   ├── users.service.ts
│           │   └── entities/user.entity.ts
│           ├── gigs/
│           │   ├── gigs.module.ts
│           │   ├── gigs.controller.ts
│           │   ├── gigs.service.ts
│           │   └── entities/gig.entity.ts
│           ├── projects/
│           │   ├── projects.module.ts
│           │   ├── projects.controller.ts
│           │   ├── projects.service.ts
│           │   └── entities/project.entity.ts
│           ├── proposals/
│           │   ├── proposals.module.ts
│           │   ├── proposals.controller.ts
│           │   └── proposals.service.ts
│           ├── contracts/
│           │   ├── contracts.module.ts
│           │   ├── contracts.controller.ts
│           │   └── contracts.service.ts
│           ├── milestones/
│           │   ├── milestones.module.ts
│           │   ├── milestones.controller.ts
│           │   └── milestones.service.ts
│           ├── orders/
│           │   ├── orders.module.ts
│           │   ├── orders.controller.ts
│           │   └── orders.service.ts
│           ├── chat/                 ← Socket.IO gateway
│           │   ├── chat.module.ts
│           │   ├── chat.gateway.ts
│           │   ├── chat.controller.ts
│           │   └── chat.service.ts
│           ├── payments/             ← Stripe
│           │   ├── payments.module.ts
│           │   ├── payments.controller.ts
│           │   └── payments.service.ts
│           ├── escrow/
│           │   ├── escrow.module.ts
│           │   └── escrow.service.ts
│           ├── withdrawals/
│           │   ├── withdrawals.module.ts
│           │   ├── withdrawals.controller.ts
│           │   └── withdrawals.service.ts
│           ├── admin/
│           │   ├── admin.module.ts
│           │   └── admin.controller.ts
│           ├── notifications/
│           │   ├── notifications.module.ts
│           │   └── notifications.service.ts
│           ├── reviews/
│           │   ├── reviews.module.ts
│           │   ├── reviews.controller.ts
│           │   └── reviews.service.ts
│           ├── disputes/
│           │   ├── disputes.module.ts
│           │   ├── disputes.controller.ts
│           │   └── disputes.service.ts
│           ├── documents/            ← Puppeteer PDF
│           │   ├── documents.module.ts
│           │   ├── documents.controller.ts
│           │   └── documents.service.ts
│           ├── search/
│           │   ├── search.module.ts
│           │   └── search.controller.ts
│           ├── tickets/
│           │   ├── tickets.module.ts
│           │   ├── tickets.controller.ts
│           │   └── tickets.service.ts
│           └── uploads/
│               ├── uploads.module.ts
│               ├── uploads.controller.ts
│               └── uploads.service.ts
│
└── frontend/                         ← Next.js + TypeScript + TailwindCSS
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── next-i18next.config.js
    ├── public/
    │   └── locales/
    │       ├── en/
    │       │   └── common.json
    │       └── ar/
    │           └── common.json
    └── src/
        ├── pages/
        │   ├── _app.tsx
        │   ├── _document.tsx
        │   ├── index.tsx             ← Home
        │   ├── auth/
        │   │   ├── login.tsx
        │   │   └── register.tsx
        │   ├── gigs/
        │   │   ├── index.tsx         ← Browse gigs
        │   │   ├── [id].tsx          ← Gig detail + buy
        │   │   └── create.tsx        ← Create gig (freelancer)
        │   ├── projects/
        │   │   ├── index.tsx         ← Browse projects
        │   │   ├── [id].tsx          ← Project detail + propose
        │   │   └── create.tsx        ← Post project (client)
        │   ├── orders/
        │   │   ├── index.tsx
        │   │   └── [id].tsx
        │   ├── contracts/
        │   │   ├── index.tsx
        │   │   └── [id].tsx
        │   ├── dashboard/
        │   │   └── index.tsx
        │   ├── profile/
        │   │   └── [id].tsx
        │   ├── search/
        │   │   └── index.tsx
        │   └── admin/
        │       ├── index.tsx
        │       ├── users.tsx
        │       ├── withdrawals.tsx
        │       ├── disputes.tsx
        │       └── settings.tsx
        ├── components/
        │   ├── layout/
        │   │   ├── Layout.tsx
        │   │   ├── Navbar.tsx
        │   │   ├── Footer.tsx
        │   │   └── Sidebar.tsx
        │   ├── ui/
        │   │   ├── Button.tsx
        │   │   ├── Input.tsx
        │   │   ├── Modal.tsx
        │   │   ├── Badge.tsx
        │   │   ├── RatingStars.tsx
        │   │   └── LanguageSwitcher.tsx
        │   ├── chat/
        │   │   ├── ChatRoom.tsx
        │   │   └── MessageBubble.tsx
        │   ├── payment/
        │   │   ├── CheckoutButton.tsx
        │   │   └── EscrowStatus.tsx
        │   └── admin/
        │       └── StatsCard.tsx
        ├── contexts/
        │   ├── AuthContext.tsx
        │   └── SocketContext.tsx
        ├── hooks/
        │   ├── useAuth.ts
        │   ├── useSocket.ts
        │   └── useNotifications.ts
        ├── services/
        │   └── api.ts
        ├── types/
        │   └── index.ts
        └── utils/
            ├── currency.ts
            └── date.ts
```

## Database Tables (PostgreSQL)

| Table               | Purpose                                    |
|---------------------|--------------------------------------------|
| users               | All accounts (clients, freelancers, admins)|
| profiles            | Extended profile info                      |
| freelancer_skills   | Skills mapped to freelancer                |
| portfolio_items     | Freelancer portfolio                       |
| education           | Freelancer education history               |
| certifications      | Freelancer certifications                  |
| categories          | Service categories (bilingual)             |
| skills              | Skills list (bilingual)                    |
| gigs                | Fiverr-style service listings              |
| gig_packages        | Basic / Standard / Premium packages        |
| gig_skills          | Skills tagged on gigs                      |
| projects            | Upwork-style project postings              |
| project_skills      | Skills required for project                |
| proposals           | Freelancer proposals on projects           |
| contracts           | Accepted proposals → active contracts      |
| milestones          | Contract payment milestones                |
| orders              | Gig purchase orders                        |
| chat_rooms          | One room per order or contract             |
| messages            | Chat messages with file support            |
| escrow_accounts     | Funds held in escrow                       |
| transactions        | Full payment transaction ledger            |
| wallets             | Freelancer balance + pending               |
| withdrawals         | Withdrawal requests                        |
| reviews             | Ratings and reviews                        |
| notifications       | In-app notifications (bilingual)           |
| disputes            | Dispute cases                              |
| support_tickets     | Help desk tickets                          |
| ticket_replies      | Ticket conversation                        |
| documents           | Generated PDFs                             |
| refresh_tokens      | JWT refresh token rotation                 |
| file_uploads        | Upload tracking                            |
| audit_logs          | Admin action audit trail                   |
| platform_settings   | Key-value platform config                  |
