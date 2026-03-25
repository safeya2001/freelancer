#!/usr/bin/env node
/**
 * seed-all.js — Full realistic seed for DopaWork platform
 *
 * Usage (inside the running backend container):
 *   docker compose exec backend node scripts/seed-all.js
 *
 * Or from host (requires DB env vars):
 *   DB_HOST=localhost DB_PORT=5432 DB_USER=... DB_PASSWORD=... DB_NAME=... \
 *     node scripts/seed-all.js
 *
 * What it does:
 *   1. Deletes all rows where email LIKE '%@seed.dopa%' (idempotent wipe)
 *   2. Inserts 2 admins + 5 freelancers + 5 clients
 *   3. Creates skills/portfolios, 5 gigs (with packages), 5 projects
 *   4. Proposals → accepted contracts → milestones in various states
 *   5. Gig orders (completed + in-progress)
 *   6. Chat rooms + realistic messages
 *   7. Escrow accounts + transactions
 *   8. Wallet balances, 2 withdrawal requests
 *   9. Reviews, support tickets + replies
 */

'use strict';

const bcrypt   = require('bcrypt');
const postgres = require('postgres');

// ── DB connection ────────────────────────────────────────────────────────────
function connect() {
  if (process.env.DATABASE_URL) {
    return postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 5 });
  }
  const { DB_HOST = 'postgres', DB_PORT = '5432', DB_USER, DB_PASSWORD, DB_NAME = 'freelance_db' } = process.env;
  return postgres({ host: DB_HOST, port: +DB_PORT, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, ssl: false, max: 5 });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const ago  = (days) => new Date(Date.now() - days * 86400_000);
const from = (days) => new Date(Date.now() + days * 86400_000);
const dateStr = (d) => d.toISOString().slice(0, 10);

async function main() {
  const sql = connect();

  try {
    // ── 0. Hash once ──────────────────────────────────────────────────────────
    console.log('🔑  Hashing passwords…');
    const hash = await bcrypt.hash('Test@1234', 10);

    // ── 1. Wipe previous seed data ────────────────────────────────────────────
    console.log('🗑   Wiping old seed data…');
    // Collect IDs first, then delete dependents before users
    const seedUsers = await sql`
      SELECT id FROM users
      WHERE email LIKE '%@seed.dopa' OR email LIKE '%@seed.dopa.jo'`;
    if (seedUsers.length > 0) {
      const ids = seedUsers.map(u => u.id);
      // Delete in FK-safe order (most dependent → least dependent)
      await sql`DELETE FROM ticket_replies  WHERE sender_id  = ANY(${ids})`;
      await sql`DELETE FROM support_tickets WHERE user_id    = ANY(${ids})`;
      await sql`DELETE FROM notifications   WHERE user_id    = ANY(${ids})`;
      await sql`DELETE FROM audit_logs      WHERE admin_id   = ANY(${ids})`;
      await sql`DELETE FROM withdrawals     WHERE freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM reviews         WHERE reviewer_id = ANY(${ids}) OR reviewee_id = ANY(${ids})`;
      await sql`DELETE FROM messages        WHERE sender_id  = ANY(${ids})`;
      await sql`DELETE FROM chat_rooms      WHERE client_id  = ANY(${ids}) OR freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM transactions    WHERE from_user_id = ANY(${ids}) OR to_user_id = ANY(${ids})`;
      await sql`DELETE FROM escrow_accounts WHERE client_id  = ANY(${ids}) OR freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM milestones      WHERE contract_id IN (SELECT id FROM contracts WHERE client_id = ANY(${ids}) OR freelancer_id = ANY(${ids}))`;
      await sql`DELETE FROM contracts       WHERE client_id  = ANY(${ids}) OR freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM orders          WHERE client_id  = ANY(${ids}) OR freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM proposals       WHERE freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM project_skills  WHERE project_id IN (SELECT id FROM projects WHERE client_id = ANY(${ids}))`;
      await sql`DELETE FROM projects        WHERE client_id  = ANY(${ids})`;
      await sql`DELETE FROM gig_skills      WHERE gig_id     IN (SELECT id FROM gigs WHERE freelancer_id = ANY(${ids}))`;
      await sql`DELETE FROM gig_packages    WHERE gig_id     IN (SELECT id FROM gigs WHERE freelancer_id = ANY(${ids}))`;
      await sql`DELETE FROM gigs            WHERE freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM portfolio_items WHERE user_id    = ANY(${ids})`;
      await sql`DELETE FROM freelancer_skills WHERE user_id  = ANY(${ids})`;
      await sql`DELETE FROM wallets         WHERE user_id    = ANY(${ids})`;
      await sql`DELETE FROM refresh_tokens  WHERE user_id    = ANY(${ids})`;
      await sql`DELETE FROM profiles        WHERE user_id    = ANY(${ids})`;
      await sql`DELETE FROM disputes        WHERE client_id  = ANY(${ids}) OR freelancer_id = ANY(${ids})`;
      await sql`DELETE FROM users           WHERE id         = ANY(${ids})`;
    }

    // ── 2. Fetch lookup tables ────────────────────────────────────────────────
    const cats  = await sql`SELECT id, slug FROM categories`;
    const catId = (slug) => cats.find(c => c.slug === slug)?.id;

    const skills = await sql`SELECT id, slug FROM skills`;
    const skillId = (slug) => skills.find(s => s.slug === slug)?.id;

    // ── 3. Insert users ───────────────────────────────────────────────────────
    console.log('👤  Creating users…');

    // Admins
    const [superAdmin] = await sql`
      INSERT INTO users (email, password_hash, role, status, email_verified, preferred_language)
      VALUES ('superadmin@seed.dopa', ${hash}, 'super_admin', 'active', true, 'ar')
      RETURNING id`;

    const [supportAdmin] = await sql`
      INSERT INTO users (email, password_hash, role, status, email_verified, preferred_language)
      VALUES ('support@seed.dopa', ${hash}, 'support_admin', 'active', true, 'ar')
      RETURNING id`;

    await sql`INSERT INTO profiles (user_id, full_name_en, full_name_ar)
      VALUES (${superAdmin.id}, 'Super Admin', 'المدير الأعلى')`;
    await sql`INSERT INTO profiles (user_id, full_name_en, full_name_ar)
      VALUES (${supportAdmin.id}, 'Support Admin', 'مشرف الدعم')`;

    // Freelancers
    const freelancerData = [
      {
        email: 'omar.nasser@seed.dopa',
        name_en: 'Omar Nasser',       name_ar: 'عمر ناصر',
        title_en: 'Full-Stack Web Developer',
        title_ar: 'مطور ويب متكامل',
        bio_en: 'Passionate full-stack developer with 6 years building modern web applications for Jordanian businesses and regional startups. Expert in React, Node.js and PostgreSQL.',
        bio_ar: 'مطور ويب متكامل متحمس مع 6 سنوات في بناء تطبيقات الويب الحديثة. خبير في React وNode.js وPostgreSQL.',
        city: 'amman', hourly_rate: 25.000, identity_verified: 'verified',
        skills: ['react', 'nodejs', 'postgresql'],
      },
      {
        email: 'lina.barakat@seed.dopa',
        name_en: 'Lina Barakat',      name_ar: 'لينا بركات',
        title_en: 'Brand & Graphic Designer',
        title_ar: 'مصممة جرافيك وهوية بصرية',
        bio_en: 'Creative graphic designer specializing in brand identity, logo design and social media visuals. 4 years of experience working with SMEs across Jordan.',
        bio_ar: 'مصممة جرافيك مبدعة متخصصة في الهوية البصرية وتصميم الشعارات ومحتوى السوشيال ميديا. 4 سنوات خبرة مع الشركات الأردنية.',
        city: 'zarqa', hourly_rate: 18.000, identity_verified: 'verified',
        skills: ['figma', 'photoshop', 'logo-design'],
      },
      {
        email: 'kareem.zoubi@seed.dopa',
        name_en: 'Kareem Al-Zoubi',   name_ar: 'كريم الزعبي',
        title_en: 'Arabic–English Translator & Content Writer',
        title_ar: 'مترجم ومحرر محتوى عربي–إنجليزي',
        bio_en: 'Certified translator with a degree in English Literature from University of Jordan. Specialises in legal, medical and marketing translation.',
        bio_ar: 'مترجم معتمد حاصل على درجة الأدب الإنجليزي من الجامعة الأردنية. متخصص في الترجمة القانونية والطبية والتسويقية.',
        city: 'amman', hourly_rate: 15.000, identity_verified: 'pending',
        skills: ['arabic-typing', 'english-writing'],
      },
      {
        email: 'rania.haddad@seed.dopa',
        name_en: 'Rania Haddad',      name_ar: 'رانيا حداد',
        title_en: 'Digital Marketing Specialist',
        title_ar: 'متخصصة تسويق رقمي',
        bio_en: 'Results-driven digital marketer helping Jordanian SMEs grow online. Expert in SEO, Google Ads, Facebook campaigns and analytics.',
        bio_ar: 'متخصصة تسويق رقمي تساعد الشركات الأردنية على النمو. خبرة في SEO وإعلانات جوجل وحملات فيسبوك والتحليلات.',
        city: 'amman', hourly_rate: 20.000, identity_verified: 'unverified',
        skills: ['seo', 'social-media'],
      },
      {
        email: 'tariq.mansour@seed.dopa',
        name_en: 'Tariq Mansour',     name_ar: 'طارق منصور',
        title_en: 'Video Editor & Motion Graphics',
        title_ar: 'مونتير فيديو وموشن جرافيكس',
        bio_en: 'Professional video editor with 5 years creating engaging content for YouTube channels, ads and corporate videos. Skilled in Premiere Pro and After Effects.',
        bio_ar: 'مونتير فيديو محترف مع 5 سنوات في إنتاج محتوى مميز لقنوات يوتيوب والإعلانات والفيديوهات المؤسسية.',
        city: 'irbid', hourly_rate: 22.000, identity_verified: 'verified',
        skills: ['premiere'],
      },
    ];

    const freelancers = [];
    for (const f of freelancerData) {
      const [u] = await sql`
        INSERT INTO users (email, password_hash, role, status, email_verified, preferred_language)
        VALUES (${f.email}, ${hash}, 'freelancer', 'active', true, 'ar')
        RETURNING id`;

      await sql`
        INSERT INTO profiles (user_id, full_name_en, full_name_ar,
          professional_title_en, professional_title_ar,
          bio_en, bio_ar, city, hourly_rate, availability,
          identity_verified, total_jobs_done, avg_rating, review_count)
        VALUES (
          ${u.id}, ${f.name_en}, ${f.name_ar},
          ${f.title_en}, ${f.title_ar},
          ${f.bio_en}, ${f.bio_ar}, ${f.city}, ${f.hourly_rate}, true,
          ${f.identity_verified}, ${Math.floor(Math.random() * 30) + 5},
          ${(4.2 + Math.random() * 0.7).toFixed(2)},
          ${Math.floor(Math.random() * 25) + 3}
        )`;

      // Skills
      for (const slug of f.skills) {
        const sid = skillId(slug);
        if (sid) await sql`
          INSERT INTO freelancer_skills (user_id, skill_id, level)
          VALUES (${u.id}, ${sid}, 'expert') ON CONFLICT DO NOTHING`;
      }

      // Portfolio item
      await sql`
        INSERT INTO portfolio_items (user_id, title_en, title_ar, description_en, description_ar)
        VALUES (
          ${u.id},
          ${'Portfolio: ' + f.title_en},
          ${'محفظة: ' + f.title_ar},
          ${'Sample work showcasing expertise in ' + f.title_en},
          ${'نماذج عمل تعكس الخبرة في ' + f.title_ar}
        )`;

      freelancers.push({ id: u.id, ...f });
    }

    // Clients
    const clientData = [
      { email: 'ahmed.rashid@seed.dopa',  name_en: 'Ahmed Al-Rashid',  name_ar: 'أحمد الراشد',   company: 'Al-Rashid Trading Co.', city: 'amman'  },
      { email: 'sara.khalil@seed.dopa',   name_en: 'Sara Khalil',      name_ar: 'سارة خليل',     company: 'Khalil Restaurant Group', city: 'irbid'  },
      { email: 'nour.saleh@seed.dopa',    name_en: 'Nour Saleh',       name_ar: 'نور صالح',      company: 'Saleh Real Estate',     city: 'zarqa'  },
      { email: 'faris.haddad@seed.dopa',  name_en: 'Faris Haddad',     name_ar: 'فارس حداد',     company: 'Haddad Tech Solutions', city: 'amman'  },
      { email: 'maya.qasem@seed.dopa',    name_en: 'Maya Qasem',       name_ar: 'مايا قاسم',     company: 'Qasem Media Agency',    city: 'amman'  },
    ];

    const clients = [];
    for (const c of clientData) {
      const [u] = await sql`
        INSERT INTO users (email, password_hash, role, status, email_verified, preferred_language)
        VALUES (${c.email}, ${hash}, 'client', 'active', true, 'ar')
        RETURNING id`;

      await sql`
        INSERT INTO profiles (user_id, full_name_en, full_name_ar, city, company_name)
        VALUES (${u.id}, ${c.name_en}, ${c.name_ar}, ${c.city}, ${c.company})`;

      clients.push({ id: u.id, ...c });
    }
    console.log('✅  Users done');

    // ── 4. Gigs ───────────────────────────────────────────────────────────────
    console.log('🛒  Creating gigs…');

    const gigDefs = [
      {
        freelancer: freelancers[0], // Omar — web dev
        cat: 'web-development',
        title_en: 'Professional Full-Stack Web App — React & Node.js',
        title_ar: 'تطوير تطبيق ويب متكامل — React و Node.js',
        desc_en: 'I will build a complete, responsive web application with authentication, REST API, admin dashboard, and deployment on your server. Built with React (TypeScript), NestJS, and PostgreSQL.',
        desc_ar: 'سأبني تطبيق ويب متكامل يشمل المصادقة وواجهة API ولوحة تحكم ونشر على خادمك. مبني بـ React وNestJS وPostgreSQL.',
        reqs_en: 'Please provide: your design mockups or Figma link, required pages list, and existing branding.',
        price: 150.000, delivery_days: 7,
        packages: [
          { type: 'basic',    price: 150.000, days: 7,  revisions: 2, name_en: 'Starter',    name_ar: 'مبتدئ',    desc_en: '3-page site + auth + API' },
          { type: 'standard', price: 350.000, days: 12, revisions: 3, name_en: 'Business',   name_ar: 'أعمال',   desc_en: 'Full app + admin panel'   },
          { type: 'premium',  price: 700.000, days: 21, revisions: 5, name_en: 'Enterprise', name_ar: 'مؤسسات', desc_en: 'Full app + CI/CD + SEO'   },
        ],
      },
      {
        freelancer: freelancers[1], // Lina — design
        cat: 'graphic-design',
        title_en: 'Complete Brand Identity — Logo, Colors & Guidelines',
        title_ar: 'هوية بصرية متكاملة — شعار وألوان ودليل',
        desc_en: 'Professional brand identity package: primary logo, alternate versions, color palette, typography selection, and a 10-page brand guidelines PDF. Delivered in AI, PDF, and PNG formats.',
        desc_ar: 'حزمة هوية بصرية احترافية: شعار رئيسي ونسخ بديلة ولوحة ألوان وخطوط ودليل علامة تجارية 10 صفحات بصيغ AI وPDF وPNG.',
        reqs_en: 'Tell me about your business, target audience, and any color/style preferences.',
        price: 80.000, delivery_days: 5,
        packages: [
          { type: 'basic',    price: 80.000,  days: 5,  revisions: 2, name_en: 'Logo Only',    name_ar: 'شعار فقط',         desc_en: 'Primary logo + 2 variants' },
          { type: 'standard', price: 180.000, days: 8,  revisions: 3, name_en: 'Brand Kit',    name_ar: 'حزمة الهوية',      desc_en: 'Logo + colors + fonts'     },
          { type: 'premium',  price: 320.000, days: 14, revisions: 5, name_en: 'Full Identity', name_ar: 'هوية كاملة',      desc_en: 'Full brand guidelines PDF' },
        ],
      },
      {
        freelancer: freelancers[2], // Kareem — translation
        cat: 'translation',
        title_en: 'Professional Arabic ↔ English Translation (1000 words)',
        title_ar: 'ترجمة احترافية عربي ↔ إنجليزي (1000 كلمة)',
        desc_en: 'Accurate, fluent translation between Arabic and English by a certified translator. Specialties: legal, medical, marketing, and technical content.',
        desc_ar: 'ترجمة دقيقة وطليقة بين العربية والإنجليزية من مترجم معتمد. تخصصات: قانوني وطبي وتسويقي وتقني.',
        reqs_en: 'Provide the source text and specify the target domain (legal, medical, general, etc.).',
        price: 20.000, delivery_days: 2,
        packages: [
          { type: 'basic',    price: 20.000, days: 2, revisions: 1, name_en: 'Standard',     name_ar: 'عادي',    desc_en: '1000 words'              },
          { type: 'standard', price: 45.000, days: 3, revisions: 2, name_en: 'Professional', name_ar: 'احترافي', desc_en: '2500 words + proofreading' },
          { type: 'premium',  price: 80.000, days: 5, revisions: 3, name_en: 'Certified',    name_ar: 'معتمد',   desc_en: '5000 words + stamp'       },
        ],
      },
      {
        freelancer: freelancers[3], // Rania — marketing
        cat: 'marketing',
        title_en: 'Google & Facebook Ads Campaign Setup & Management',
        title_ar: 'إعداد وإدارة حملات إعلانية على جوجل وفيسبوك',
        desc_en: 'I will create, launch, and manage your digital advertising campaigns on Google Ads and Facebook/Instagram. Includes audience targeting, A/B testing, and monthly performance report.',
        desc_ar: 'سأنشئ وأطلق وأدير حملاتك الإعلانية على جوجل وفيسبوك/إنستغرام. يشمل استهداف الجمهور واختبار A/B وتقرير أداء شهري.',
        reqs_en: 'Provide your website URL, monthly budget, and campaign objectives.',
        price: 60.000, delivery_days: 3,
        packages: [
          { type: 'basic',    price: 60.000,  days: 3, revisions: 1, name_en: 'Setup Only',  name_ar: 'إعداد فقط',    desc_en: '1 campaign setup'          },
          { type: 'standard', price: 120.000, days: 5, revisions: 2, name_en: 'Full Launch', name_ar: 'إطلاق كامل',   desc_en: '2 platforms + analytics'   },
          { type: 'premium',  price: 250.000, days: 7, revisions: 3, name_en: 'Management',  name_ar: 'إدارة متكاملة', desc_en: '1-month full management'   },
        ],
      },
      {
        freelancer: freelancers[4], // Tariq — video
        cat: 'video-editing',
        title_en: 'Professional Video Editing — YouTube, Reels & Ads',
        title_ar: 'مونتاج فيديو احترافي — يوتيوب وريلز وإعلانات',
        desc_en: 'Expert video editing with color grading, motion graphics, captions, and music sync. Delivering polished content for social media, YouTube and corporate presentations.',
        desc_ar: 'مونتاج فيديو احترافي مع تدرج اللون والحركة والتعليقات ومزامنة الموسيقى. محتوى متقن للسوشيال ميديا ويوتيوب والعروض التقديمية.',
        reqs_en: 'Upload your raw footage and describe the desired style/mood.',
        price: 35.000, delivery_days: 3,
        packages: [
          { type: 'basic',    price: 35.000,  days: 3,  revisions: 2, name_en: 'Short Clip',   name_ar: 'مقطع قصير',  desc_en: 'Up to 3 min, basic edit'    },
          { type: 'standard', price: 80.000,  days: 5,  revisions: 3, name_en: 'Full Video',   name_ar: 'فيديو كامل', desc_en: 'Up to 10 min + motion'      },
          { type: 'premium',  price: 150.000, days: 10, revisions: 5, name_en: 'Series Pack',  name_ar: 'حزمة سيريز', desc_en: '4 videos + thumbnail design' },
        ],
      },
    ];

    const gigs = [];
    for (const g of gigDefs) {
      const [gig] = await sql`
        INSERT INTO gigs (freelancer_id, category_id, title_en, title_ar,
          description_en, description_ar, requirements_en,
          price, delivery_days, status,
          views_count, orders_count, avg_rating, review_count)
        VALUES (
          ${g.freelancer.id}, ${catId(g.cat)},
          ${g.title_en}, ${g.title_ar},
          ${g.desc_en}, ${g.desc_ar}, ${g.reqs_en},
          ${g.price}, ${g.delivery_days}, 'active',
          ${Math.floor(Math.random() * 300) + 50},
          ${Math.floor(Math.random() * 20) + 2},
          ${(4.3 + Math.random() * 0.65).toFixed(2)},
          ${Math.floor(Math.random() * 20) + 3}
        ) RETURNING id`;

      const pkgIds = [];
      for (const p of g.packages) {
        const [pkg] = await sql`
          INSERT INTO gig_packages (gig_id, package_type, name_en, name_ar,
            description_en, price, delivery_days, revisions)
          VALUES (${gig.id}, ${p.type}, ${p.name_en}, ${p.name_ar},
            ${p.desc_en}, ${p.price}, ${p.days}, ${p.revisions})
          RETURNING id`;
        pkgIds.push({ type: p.type, id: pkg.id, price: p.price });
      }

      gigs.push({ id: gig.id, freelancer: g.freelancer, packages: pkgIds });
    }
    console.log('✅  Gigs done');

    // ── 5. Projects ───────────────────────────────────────────────────────────
    console.log('📋  Creating projects…');

    const projectDefs = [
      {
        client: clients[0],
        cat: 'web-development',
        title_en: 'E-Commerce Website for Jordanian Handicrafts Store',
        title_ar: 'موقع تجارة إلكترونية لمتجر الحرف اليدوية الأردنية',
        desc_en: 'Looking for an experienced full-stack developer to build a bilingual (Arabic/English) e-commerce website for our handmade products store. The site must support CliQ and credit card payments, product management, and order tracking. Mobile-first responsive design required.',
        desc_ar: 'نبحث عن مطور متكامل لبناء موقع تجارة إلكترونية ثنائي اللغة لمتجر المنتجات اليدوية. يجب أن يدعم الموقع دفع CliQ وبطاقات الائتمان وإدارة المنتجات وتتبع الطلبات.',
        budget_type: 'fixed', budget_min: 500.000, budget_max: 1200.000,
        preferred_city: 'amman', status: 'open',
        deadline: dateStr(from(30)),
        skills: ['react', 'nodejs', 'postgresql'],
      },
      {
        client: clients[1],
        cat: 'mobile-apps',
        title_en: 'Restaurant Order Management Mobile App (iOS + Android)',
        title_ar: 'تطبيق موبايل لإدارة طلبات المطعم (iOS + Android)',
        desc_en: 'Need a Flutter developer to build a mobile app for our restaurant chain. Features: table orders, kitchen display, staff management, real-time notifications, Arabic UI. Must work offline.',
        desc_ar: 'نحتاج مطور Flutter لبناء تطبيق موبايل لسلسلة مطاعمنا. الميزات: طلبات الطاولة وشاشة المطبخ وإدارة الموظفين والإشعارات الفورية. واجهة عربية مع دعم العمل بدون إنترنت.',
        budget_type: 'fixed', budget_min: 800.000, budget_max: 2000.000,
        preferred_city: 'irbid', status: 'in_progress',
        deadline: dateStr(from(45)),
        skills: ['flutter'],
      },
      {
        client: clients[2],
        cat: 'translation',
        title_en: 'Legal Document Translation — Arabic to English (Property Contracts)',
        title_ar: 'ترجمة وثائق قانونية — من العربية إلى الإنجليزية (عقود عقارية)',
        desc_en: 'We need a certified translator to translate 15 property sale contracts from Arabic to English. Approximately 3000 words each. Legal accuracy and formal tone required.',
        desc_ar: 'نحتاج مترجماً معتمداً لترجمة 15 عقد بيع عقاري من العربية إلى الإنجليزية. حوالي 3000 كلمة لكل عقد. الدقة القانونية والأسلوب الرسمي مطلوبان.',
        budget_type: 'hourly', hourly_rate_min: 12.000, hourly_rate_max: 20.000,
        preferred_city: 'zarqa', status: 'open',
        deadline: dateStr(from(14)),
        skills: ['arabic-typing', 'english-writing'],
      },
      {
        client: clients[3],
        cat: 'marketing',
        title_en: '3-Month Digital Marketing Campaign for Tech Startup',
        title_ar: 'حملة تسويق رقمي لمدة 3 أشهر لشركة تقنية ناشئة',
        desc_en: 'Seeking a digital marketing specialist for a 3-month campaign covering Google Ads, LinkedIn, and Instagram. Target audience: B2B tech buyers in Jordan. Budget: 5000 JOD ad spend managed monthly.',
        desc_ar: 'نبحث عن متخصص تسويق رقمي لحملة مدتها 3 أشهر تغطي جوجل ولينكدإن وإنستغرام. الجمهور المستهدف: مشترو B2B التقني في الأردن.',
        budget_type: 'fixed', budget_min: 300.000, budget_max: 600.000,
        preferred_city: 'amman', status: 'completed',
        deadline: dateStr(ago(10)),
        skills: ['seo', 'social-media'],
      },
      {
        client: clients[4],
        cat: 'video-editing',
        title_en: 'Monthly YouTube & Instagram Content Editing (8 Videos)',
        title_ar: 'مونتاج محتوى شهري ليوتيوب وإنستغرام (8 فيديوهات)',
        desc_en: 'Looking for a video editor to handle 8 videos per month: 4 YouTube long-form (10–20 min) and 4 Instagram Reels (30–60 sec). Motion graphics, subtitles, and thumbnail design included.',
        desc_ar: 'نبحث عن مونتير فيديو لمعالجة 8 فيديوهات شهرياً: 4 فيديو طويل ليوتيوب و4 ريلز لإنستغرام. موشن جرافيكس وترجمات وتصميم مصغرات.',
        budget_type: 'fixed', budget_min: 200.000, budget_max: 400.000,
        preferred_city: 'amman', status: 'open',
        deadline: dateStr(from(21)),
        skills: ['premiere'],
      },
    ];

    const projects = [];
    for (const p of projectDefs) {
      const isHourly = p.budget_type === 'hourly';
      const [proj] = await sql`
        INSERT INTO projects (client_id, category_id,
          title_en, title_ar, description_en, description_ar,
          budget_type,
          budget_min, budget_max,
          hourly_rate_min, hourly_rate_max,
          deadline, preferred_city, status)
        VALUES (
          ${p.client.id}, ${catId(p.cat)},
          ${p.title_en}, ${p.title_ar},
          ${p.desc_en}, ${p.desc_ar},
          ${p.budget_type},
          ${isHourly ? null : p.budget_min}, ${isHourly ? null : p.budget_max},
          ${isHourly ? p.hourly_rate_min : null}, ${isHourly ? p.hourly_rate_max : null},
          ${p.deadline}, ${p.preferred_city}, ${p.status}
        ) RETURNING id`;

      // project_skills
      for (const slug of (p.skills || [])) {
        const sid = skillId(slug);
        if (sid) await sql`
          INSERT INTO project_skills (project_id, skill_id) VALUES (${proj.id}, ${sid})
          ON CONFLICT DO NOTHING`;
      }

      projects.push({ id: proj.id, client: p.client, status: p.status });
    }
    console.log('✅  Projects done');

    // ── 6. Proposals ─────────────────────────────────────────────────────────
    console.log('📝  Creating proposals…');

    // Project 0 (open) — 3 proposals from different freelancers
    const prop0defs = [
      { fl: freelancers[0], budget: 950.000, days: 25,
        en: 'I have built several similar e-commerce platforms for Jordanian businesses. My stack (React + NestJS + PostgreSQL) is perfect for your requirements. I can integrate CliQ payments and deliver a fully bilingual admin dashboard.',
        ar: 'قمت ببناء منصات تجارة إلكترونية مماثلة لشركات أردنية. تقنياتي (React + NestJS + PostgreSQL) مثالية لمتطلباتك. يمكنني دمج مدفوعات CliQ وتسليم لوحة تحكم ثنائية اللغة.' },
      { fl: freelancers[1], budget: 1100.000, days: 30,
        en: 'I offer a complete web and design package — I will handle both development and UI/UX design ensuring a polished, conversion-optimized storefront.',
        ar: 'أقدم حزمة تطوير وتصميم متكاملة — سأتولى التطوير وتصميم UI/UX لضمان واجهة أنيقة ومحسّنة للتحويل.' },
      { fl: freelancers[3], budget: 850.000, days: 28,
        en: 'While my primary expertise is marketing, I work with a trusted developer and can deliver the full project including an SEO-optimized architecture.',
        ar: 'خبرتي الأساسية في التسويق، لكنني أعمل مع مطور موثوق ويمكنني تسليم المشروع كاملاً مع بنية محسّنة لمحركات البحث.' },
    ];
    const proposals0 = [];
    for (const pd of prop0defs) {
      const [pr] = await sql`
        INSERT INTO proposals (project_id, freelancer_id, cover_letter_en, cover_letter_ar,
          proposed_budget, delivery_days, status)
        VALUES (${projects[0].id}, ${pd.fl.id}, ${pd.en}, ${pd.ar},
          ${pd.budget}, ${pd.days}, 'pending')
        RETURNING id`;
      proposals0.push({ id: pr.id, fl: pd.fl, budget: pd.budget });
    }

    // Project 2 (open, hourly) — 2 proposals
    const prop2defs = [
      { fl: freelancers[2], hourly: 15.000, hours: 45, days: 14,
        en: 'As a certified translator specialising in legal documents, I have translated over 200 property contracts. My rate is 15 JOD/hour and I estimate approximately 45 hours for 15 contracts.',
        ar: 'بصفتي مترجماً معتمداً متخصصاً في الوثائق القانونية، قمت بترجمة أكثر من 200 عقد عقاري. معدلي 15 دينار/ساعة وأقدر المشروع بحوالي 45 ساعة لـ 15 عقداً.' },
      { fl: freelancers[4], hourly: 18.000, hours: 50, days: 18,
        en: 'I can handle the translation with my background in legal texts. 18 JOD/hour, estimated 50 hours.',
        ar: 'أستطيع التعامل مع الترجمة بخلفيتي في النصوص القانونية. 18 دينار/ساعة، تقدير 50 ساعة.' },
    ];
    const proposals2 = [];
    for (const pd of prop2defs) {
      const [pr] = await sql`
        INSERT INTO proposals (project_id, freelancer_id, cover_letter_en, cover_letter_ar,
          proposed_budget, delivery_days, status,
          proposed_hourly_rate, estimated_hours)
        VALUES (${projects[2].id}, ${pd.fl.id}, ${pd.en}, ${pd.ar},
          ${pd.hourly * pd.hours}, ${pd.days}, 'pending',
          ${pd.hourly}, ${pd.hours})
        RETURNING id`;
      proposals2.push({ id: pr.id, fl: pd.fl, budget: pd.hourly * pd.hours });
    }

    // Project 4 (open) — 2 proposals
    const prop4defs = [
      { fl: freelancers[4], budget: 280.000, days: 21,
        en: 'Video editing is my core service. I can handle all 8 videos monthly with consistent quality — motion graphics, subtitles in both Arabic and English, and custom thumbnails.',
        ar: 'المونتاج هو خدمتي الأساسية. يمكنني معالجة الـ 8 فيديوهات شهرياً بجودة متسقة — موشن جرافيكس وترجمات بالعربية والإنجليزية ومصغرات مخصصة.' },
      { fl: freelancers[1], budget: 320.000, days: 25,
        en: 'I offer video editing + thumbnail design as a combined package for a cohesive visual identity across all your video content.',
        ar: 'أقدم مونتاج الفيديو مع تصميم المصغرات كحزمة متكاملة للحفاظ على هوية بصرية متسقة عبر كل محتواك.' },
    ];
    const proposals4 = [];
    for (const pd of prop4defs) {
      const [pr] = await sql`
        INSERT INTO proposals (project_id, freelancer_id, cover_letter_en, cover_letter_ar,
          proposed_budget, delivery_days, status)
        VALUES (${projects[4].id}, ${pd.fl.id}, ${pd.en}, ${pd.ar},
          ${pd.budget}, ${pd.days}, 'pending')
        RETURNING id`;
      proposals4.push({ id: pr.id, fl: pd.fl, budget: pd.budget });
    }

    // Mark project[1] (in_progress) as having an accepted proposal
    const [acceptedProposal1] = await sql`
      INSERT INTO proposals (project_id, freelancer_id, cover_letter_en, cover_letter_ar,
        proposed_budget, delivery_days, status)
      VALUES (
        ${projects[1].id}, ${freelancers[0].id},
        'I specialize in Flutter and have delivered 8 similar restaurant apps. Let''s build something great.',
        'أتخصص في Flutter وقدّمت 8 تطبيقات مطاعم مماثلة. لنبني شيئاً رائعاً.',
        1500.000, 35, 'accepted')
      RETURNING id`;

    // Mark project[3] (completed) as having an accepted proposal
    const [acceptedProposal3] = await sql`
      INSERT INTO proposals (project_id, freelancer_id, cover_letter_en, cover_letter_ar,
        proposed_budget, delivery_days, status)
      VALUES (
        ${projects[3].id}, ${freelancers[3].id},
        'Digital marketing expert here. I ran a successful 3-month campaign for a similar tech company and achieved 340% ROI.',
        'متخصصة تسويق رقمي. قدت حملة ناجحة مدتها 3 أشهر لشركة تقنية مماثلة وحققت 340% عائد على الاستثمار.',
        480.000, 90, 'accepted')
      RETURNING id`;

    console.log('✅  Proposals done');

    // ── 7. Contracts ──────────────────────────────────────────────────────────
    console.log('📄  Creating contracts…');

    // Contract 1: project[1] in_progress — Flutter restaurant app
    const [contract1] = await sql`
      INSERT INTO contracts (project_id, proposal_id, client_id, freelancer_id,
        title_en, title_ar, description_en,
        total_amount, commission_rate,
        start_date, end_date, status)
      VALUES (
        ${projects[1].id}, ${acceptedProposal1.id},
        ${clients[1].id}, ${freelancers[0].id},
        'Restaurant Mobile App Development',
        'تطوير تطبيق موبايل للمطعم',
        'Full-stack Flutter mobile app for restaurant order management with real-time features.',
        1500.000, 10,
        ${dateStr(ago(15))}, ${dateStr(from(20))}, 'active'
      ) RETURNING id`;

    // Contract 2: project[3] completed — marketing campaign
    const [contract2] = await sql`
      INSERT INTO contracts (project_id, proposal_id, client_id, freelancer_id,
        title_en, title_ar, description_en,
        total_amount, commission_rate,
        start_date, end_date, status)
      VALUES (
        ${projects[3].id}, ${acceptedProposal3.id},
        ${clients[3].id}, ${freelancers[3].id},
        '3-Month Digital Marketing Campaign',
        'حملة تسويق رقمي لمدة 3 أشهر',
        'Full digital marketing management covering Google Ads, LinkedIn, and Instagram.',
        480.000, 10,
        ${dateStr(ago(100))}, ${dateStr(ago(10))}, 'completed'
      ) RETURNING id`;

    // Contract 3: standalone (gig order based, active)
    const [contract3] = await sql`
      INSERT INTO contracts (client_id, freelancer_id,
        title_en, title_ar, description_en,
        total_amount, commission_rate,
        start_date, end_date, status)
      VALUES (
        ${clients[2].id}, ${freelancers[1].id},
        'Brand Identity Design for Saleh Real Estate',
        'تصميم هوية بصرية لشركة صالح العقارية',
        'Complete brand identity package including logo, colors, typography and brand guidelines.',
        320.000, 10,
        ${dateStr(ago(8))}, ${dateStr(from(6))}, 'active'
      ) RETURNING id`;

    console.log('✅  Contracts done');

    // ── 8. Milestones ─────────────────────────────────────────────────────────
    console.log('🏁  Creating milestones…');

    // Contract 1 milestones (active Flutter app)
    const m1defs = [
      { en: 'UI/UX Design & Prototyping',    ar: 'تصميم الواجهة والنموذج الأولي', amt: 300.000, days: 5,  status: 'approved',            sort: 1 },
      { en: 'Core App Development (Backend)', ar: 'تطوير الواجهة الخلفية الأساسية', amt: 500.000, days: 12, status: 'submitted',            sort: 2 },
      { en: 'Frontend + API Integration',    ar: 'الواجهة الأمامية وتكامل API',    amt: 400.000, days: 10, status: 'revision_requested',   sort: 3 },
      { en: 'Testing & Deployment',          ar: 'الاختبار والنشر',               amt: 300.000, days: 8,  status: 'pending',              sort: 4 },
    ];

    const milestones1 = [];
    for (const md of m1defs) {
      const [m] = await sql`
        INSERT INTO milestones (contract_id, title_en, title_ar, amount, sort_order, status,
          delivery_note_en, delivered_at, approved_at, approved_by, revision_note)
        VALUES (
          ${contract1.id}, ${md.en}, ${md.ar}, ${md.amt}, ${md.sort}, ${md.status},
          ${md.status !== 'pending' ? 'Deliverables attached — please review.' : null},
          ${md.status !== 'pending' ? ago(md.sort * 3) : null},
          ${md.status === 'approved' ? ago(md.sort * 3 - 1) : null},
          ${md.status === 'approved' ? clients[1].id : null},
          ${md.status === 'revision_requested' ? 'The kitchen display screen needs colour contrast fixes for readability. Also add offline queue sync.' : null}
        ) RETURNING id`;
      milestones1.push({ id: m.id, ...md });
    }

    // Contract 2 milestones (completed campaign)
    const m2defs = [
      { en: 'Campaign Strategy & Setup',    ar: 'استراتيجية الحملة والإعداد',  amt: 160.000, sort: 1, status: 'approved' },
      { en: 'Month 1 Management & Report',  ar: 'إدارة الشهر الأول وتقريره',    amt: 160.000, sort: 2, status: 'approved' },
      { en: 'Months 2–3 + Final Report',    ar: 'الشهران 2–3 والتقرير النهائي', amt: 160.000, sort: 3, status: 'approved' },
    ];
    const milestones2 = [];
    for (const md of m2defs) {
      const [m] = await sql`
        INSERT INTO milestones (contract_id, title_en, title_ar, amount, sort_order, status,
          delivery_note_en, delivered_at, approved_at, approved_by)
        VALUES (
          ${contract2.id}, ${md.en}, ${md.ar}, ${md.amt}, ${md.sort}, 'approved',
          'All deliverables have been completed and approved.',
          ${ago(90 - md.sort * 25)}, ${ago(88 - md.sort * 25)},
          ${clients[3].id}
        ) RETURNING id`;
      milestones2.push({ id: m.id, ...md });
    }

    // Contract 3 milestones (active brand design)
    const m3defs = [
      { en: 'Logo Design (3 Concepts)', ar: 'تصميم الشعار (3 مفاهيم)', amt: 80.000,  sort: 1, status: 'approved' },
      { en: 'Brand Colors & Typography', ar: 'ألوان العلامة والخطوط',    amt: 120.000, sort: 2, status: 'in_progress' },
      { en: 'Brand Guidelines PDF',     ar: 'دليل العلامة التجارية PDF', amt: 120.000, sort: 3, status: 'pending' },
    ];
    const milestones3 = [];
    for (const md of m3defs) {
      const [m] = await sql`
        INSERT INTO milestones (contract_id, title_en, title_ar, amount, sort_order, status,
          approved_at, approved_by)
        VALUES (
          ${contract3.id}, ${md.en}, ${md.ar}, ${md.amt}, ${md.sort}, ${md.status},
          ${md.status === 'approved' ? ago(5) : null},
          ${md.status === 'approved' ? clients[2].id : null}
        ) RETURNING id`;
      milestones3.push({ id: m.id, ...md });
    }
    console.log('✅  Milestones done');

    // ── 9. Orders (gig purchases) ─────────────────────────────────────────────
    console.log('🛍   Creating orders…');

    // Completed order: client[0] buys web dev gig (standard package)
    const webStdPkg = gigs[0].packages.find(p => p.type === 'standard');
    const [order1] = await sql`
      INSERT INTO orders (gig_id, package_id, client_id, freelancer_id,
        price, commission_rate, delivery_days, deadline,
        requirements, delivery_note, delivery_urls,
        status, started_at, delivered_at, completed_at)
      VALUES (
        ${gigs[0].id}, ${webStdPkg.id}, ${clients[0].id}, ${freelancers[0].id},
        ${webStdPkg.price}, 10, 12, ${ago(-20)},
        'Building a portfolio website for my handicrafts brand. Needs Arabic RTL support, contact form, and product gallery.',
        'Delivered the complete portfolio site. Includes bilingual support, contact form with email notifications, and an image gallery with lazy loading. Staging URL included.',
        ARRAY['https://cdn.dopawork.jo/uploads/delivery/portfolio-v2.zip'],
        'completed', ${ago(30)}, ${ago(18)}, ${ago(15)}
      ) RETURNING id`;

    // In-progress order: client[3] buys marketing gig (premium)
    const mktPremPkg = gigs[3].packages.find(p => p.type === 'premium');
    const [order2] = await sql`
      INSERT INTO orders (gig_id, package_id, client_id, freelancer_id,
        price, commission_rate, delivery_days, deadline,
        requirements, status, started_at)
      VALUES (
        ${gigs[3].id}, ${mktPremPkg.id}, ${clients[3].id}, ${freelancers[3].id},
        ${mktPremPkg.price}, 10, 7, ${from(3)},
        'We need a Google Ads + Facebook campaign targeting IT professionals in Amman. Monthly budget: 2000 JOD. Focus on SaaS product demo sign-ups.',
        'in_progress', ${ago(4)}
      ) RETURNING id`;

    // Delivered (awaiting approval): client[4] buys video editing gig (standard)
    const vidStdPkg = gigs[4].packages.find(p => p.type === 'standard');
    const [order3] = await sql`
      INSERT INTO orders (gig_id, package_id, client_id, freelancer_id,
        price, commission_rate, delivery_days, deadline,
        requirements, delivery_note, delivery_urls,
        status, started_at, delivered_at)
      VALUES (
        ${gigs[4].id}, ${vidStdPkg.id}, ${clients[4].id}, ${freelancers[4].id},
        ${vidStdPkg.price}, 10, 5, ${from(1)},
        'Product launch video for our new mobile app. Needs background music, Arabic captions, and our logo intro. Raw footage attached.',
        'Video is complete. Added your logo intro, Arabic + English SRT captions, background music (royalty-free), and color grading. Two versions included: full HD and compressed for web.',
        ARRAY['https://cdn.dopawork.jo/uploads/delivery/launch-video-v1.mp4'],
        'delivered', ${ago(5)}, ${ago(1)}
      ) RETURNING id`;

    console.log('✅  Orders done');

    // ── 10. Chat rooms + messages ─────────────────────────────────────────────
    console.log('💬  Creating chat rooms & messages…');

    // Room for contract1
    const [room1] = await sql`
      INSERT INTO chat_rooms (contract_id, client_id, freelancer_id)
      VALUES (${contract1.id}, ${clients[1].id}, ${freelancers[0].id})
      RETURNING id`;

    const msgs1 = [
      { sender: clients[1].id,    body: 'مرحباً عمر! أنا سعيد بالبدء في المشروع. هل يمكنك مشاركتي خطة العمل التفصيلية؟', ts: ago(14) },
      { sender: freelancers[0].id, body: 'أهلاً سارة! بالطبع. سأرسل لكِ خطة مفصلة تشمل المراحل والمواعيد خلال ساعة.', ts: ago(14) },
      { sender: freelancers[0].id, body: 'إليكِ خطة العمل:\n• المرحلة 1 (5 أيام): تصميم UI/UX والنموذج الأولي\n• المرحلة 2 (12 يوم): تطوير الباك-إند\n• المرحلة 3 (10 أيام): الفرونت-إند وربط API\n• المرحلة 4 (8 أيام): الاختبار والنشر', ts: ago(14) },
      { sender: clients[1].id,    body: 'ممتاز! هل ستستخدم Firebase للإشعارات الفورية؟', ts: ago(13) },
      { sender: freelancers[0].id, body: 'نعم، Firebase Cloud Messaging للإشعارات. وسأستخدم Supabase Realtime للتحديثات الفورية في الطلبات.', ts: ago(13) },
      { sender: clients[1].id,    body: 'Great, I reviewed Milestone 1 — the UI designs look professional. I have approved them. Please proceed to the backend development.', ts: ago(10) },
      { sender: freelancers[0].id, body: 'Thank you Sara! Starting backend today. I will set up the API structure and share a Postman collection for your team to test endpoints.', ts: ago(10) },
      { sender: freelancers[0].id, body: 'Milestone 2 is now submitted. Backend API is complete with 24 endpoints covering orders, tables, staff and kitchen display. Postman collection attached.', ts: ago(4) },
      { sender: clients[1].id,    body: 'I am reviewing it now. The kitchen display needs better colour contrast — our kitchen lighting is very bright. Also can we add an offline queue?', ts: ago(3) },
      { sender: freelancers[0].id, body: 'Understood. I will fix the contrast ratio to WCAG AA standard and implement a local SQLite queue for offline order sync. Give me 2 days.', ts: ago(3) },
    ];
    for (const m of msgs1) {
      await sql`
        INSERT INTO messages (room_id, sender_id, body, created_at)
        VALUES (${room1.id}, ${m.sender}, ${m.body}, ${m.ts})`;
    }

    // Room for contract3
    const [room3] = await sql`
      INSERT INTO chat_rooms (contract_id, client_id, freelancer_id)
      VALUES (${contract3.id}, ${clients[2].id}, ${freelancers[1].id})
      RETURNING id`;

    const msgs3 = [
      { sender: clients[2].id,    body: 'أهلاً لينا، شكراً على قبول العقد. شركتنا في مجال العقارات الفاخرة وأريد هوية بصرية تعكس الثقة والجودة.', ts: ago(8) },
      { sender: freelancers[1].id, body: 'أهلاً نور! سعيدة بالعمل معكِ. هل يمكنكِ مشاركتي أي ألوان أو أنماط تفضلينها؟ وما هي قيم الشركة الرئيسية؟', ts: ago(8) },
      { sender: clients[2].id,    body: 'نفضل الألوان الهادئة — بيج وذهبي ورمادي فاتح. قيمنا: الأمانة، الجودة، والخبرة المحلية.', ts: ago(7) },
      { sender: freelancers[1].id, body: 'ممتاز! سأصمم 3 مفاهيم للشعار بأسبوع. سأستخدم خط أنيق يجمع بين الإنجليزية والعربية.', ts: ago(7) },
      { sender: freelancers[1].id, body: 'رفعت 3 مفاهيم للشعار في المرحلة الأولى. يُرجى مراجعتها واخباري أيها يناسبكِ أكثر.', ts: ago(5) },
      { sender: clients[2].id,    body: 'المفهوم الثاني رائع! أحب البساطة والنخيل المدمج في التصميم. هل يمكن تغيير اللون الذهبي إلى نبيتي أكثر؟', ts: ago(4) },
      { sender: freelancers[1].id, body: 'بالتأكيد! سأعدّل الدرجة وأرسل لكِ ملف Figma للمراجعة النهائية قبل البدء بالمرحلة الثانية.', ts: ago(3) },
    ];
    for (const m of msgs3) {
      await sql`
        INSERT INTO messages (room_id, sender_id, body, created_at)
        VALUES (${room3.id}, ${m.sender}, ${m.body}, ${m.ts})`;
    }

    // Room for order1 (completed)
    const [room_o1] = await sql`
      INSERT INTO chat_rooms (order_id, client_id, freelancer_id)
      VALUES (${order1.id}, ${clients[0].id}, ${freelancers[0].id})
      RETURNING id`;

    await sql`INSERT INTO messages (room_id, sender_id, body, created_at)
      VALUES (${room_o1.id}, ${clients[0].id},
        'The website looks amazing Omar! The Arabic RTL is perfect. I am approving the order now.',
        ${ago(16)})`;
    await sql`INSERT INTO messages (room_id, sender_id, body, created_at)
      VALUES (${room_o1.id}, ${freelancers[0].id},
        'Thank you Ahmed! Please let me know if you need any adjustments. The admin login credentials are in the README file inside the zip.',
        ${ago(15)})`;

    console.log('✅  Messages done');

    // ── 11. Escrow + Transactions ─────────────────────────────────────────────
    console.log('💰  Creating escrow & transactions…');

    // Escrow for milestone1[0] (approved) — released
    const [esc1] = await sql`
      INSERT INTO escrow_accounts (milestone_id, contract_id, client_id, freelancer_id,
        amount, commission, net_amount, status, funded_at, released_at)
      VALUES (
        ${milestones1[0].id}, ${contract1.id},
        ${clients[1].id}, ${freelancers[0].id},
        300.000, 30.000, 270.000, 'released',
        ${ago(14)}, ${ago(10)}
      ) RETURNING id`;

    await sql`INSERT INTO transactions (escrow_id, contract_id, milestone_id,
        from_user_id, to_user_id, type, amount, status, payment_method,
        description_en, description_ar)
      VALUES (${esc1.id}, ${contract1.id}, ${milestones1[0].id},
        ${clients[1].id}, ${freelancers[0].id}, 'deposit', 300.000, 'completed', 'cliq',
        'Escrow funded for Milestone 1: UI/UX Design',
        'تمويل الضمان للمرحلة 1: تصميم الواجهة')`;

    await sql`INSERT INTO transactions (escrow_id, contract_id, milestone_id,
        from_user_id, to_user_id, type, amount, status, payment_method,
        description_en, description_ar)
      VALUES (${esc1.id}, ${contract1.id}, ${milestones1[0].id},
        NULL, ${freelancers[0].id}, 'release', 270.000, 'completed', 'cliq',
        'Payment released to freelancer for Milestone 1',
        'الإفراج عن الدفعة للمستقل عن المرحلة 1')`;

    await sql`INSERT INTO transactions (escrow_id, contract_id, milestone_id,
        from_user_id, to_user_id, type, amount, status, payment_method,
        description_en, description_ar)
      VALUES (${esc1.id}, ${contract1.id}, ${milestones1[0].id},
        ${clients[1].id}, NULL, 'commission', 30.000, 'completed', 'cliq',
        'Platform commission for Milestone 1',
        'عمولة المنصة عن المرحلة 1')`;

    // Escrow for milestone1[1] (submitted) — funded
    const [esc2] = await sql`
      INSERT INTO escrow_accounts (milestone_id, contract_id, client_id, freelancer_id,
        amount, commission, net_amount, status, funded_at)
      VALUES (
        ${milestones1[1].id}, ${contract1.id},
        ${clients[1].id}, ${freelancers[0].id},
        500.000, 50.000, 450.000, 'funded', ${ago(12)}
      ) RETURNING id`;

    await sql`INSERT INTO transactions (escrow_id, contract_id, milestone_id,
        from_user_id, to_user_id, type, amount, status, payment_method,
        description_en, description_ar)
      VALUES (${esc2.id}, ${contract1.id}, ${milestones1[1].id},
        ${clients[1].id}, ${freelancers[0].id}, 'deposit', 500.000, 'completed', 'bank_transfer',
        'Escrow funded for Milestone 2: Backend Development',
        'تمويل الضمان للمرحلة 2: التطوير الخلفي')`;

    // Escrow for completed order (order1) — released
    const [esc3] = await sql`
      INSERT INTO escrow_accounts (order_id, client_id, freelancer_id,
        amount, commission, net_amount, status, funded_at, released_at)
      VALUES (
        ${order1.id}, ${clients[0].id}, ${freelancers[0].id},
        350.000, 35.000, 315.000, 'released',
        ${ago(30)}, ${ago(15)}
      ) RETURNING id`;

    await sql`INSERT INTO transactions (escrow_id, order_id,
        from_user_id, to_user_id, type, amount, status, payment_method,
        description_en, description_ar)
      VALUES (${esc3.id}, ${order1.id},
        ${clients[0].id}, ${freelancers[0].id}, 'deposit', 350.000, 'completed', 'stripe',
        'Escrow funded for Gig Order: Portfolio Website',
        'تمويل الضمان لطلب الخدمة: موقع المحفظة')`;

    await sql`INSERT INTO transactions (escrow_id, order_id,
        from_user_id, to_user_id, type, amount, status, payment_method,
        description_en, description_ar)
      VALUES (${esc3.id}, ${order1.id},
        NULL, ${freelancers[0].id}, 'release', 315.000, 'completed', 'stripe',
        'Payment released for completed gig order',
        'الإفراج عن الدفعة لطلب الخدمة المكتمل')`;

    // All contract2 milestone escrows (all released — completed contract)
    for (let i = 0; i < milestones2.length; i++) {
      const ms = milestones2[i];
      const [e] = await sql`
        INSERT INTO escrow_accounts (milestone_id, contract_id, client_id, freelancer_id,
          amount, commission, net_amount, status, funded_at, released_at)
        VALUES (
          ${ms.id}, ${contract2.id},
          ${clients[3].id}, ${freelancers[3].id},
          ${ms.amt}, ${ms.amt * 0.1}, ${ms.amt * 0.9}, 'released',
          ${ago(100 - i * 25)}, ${ago(88 - i * 25)}
        ) RETURNING id`;

      await sql`INSERT INTO transactions (escrow_id, contract_id, milestone_id,
          from_user_id, to_user_id, type, amount, status, payment_method,
          description_en, description_ar)
        VALUES (${e.id}, ${contract2.id}, ${ms.id},
          ${clients[3].id}, ${freelancers[3].id}, 'deposit', ${ms.amt}, 'completed', 'cliq',
          ${'Escrow funded: ' + ms.en}, ${'تمويل الضمان: ' + ms.ar})`;

      await sql`INSERT INTO transactions (escrow_id, contract_id, milestone_id,
          from_user_id, to_user_id, type, amount, status, payment_method,
          description_en, description_ar)
        VALUES (${e.id}, ${contract2.id}, ${ms.id},
          NULL, ${freelancers[3].id}, 'release', ${ms.amt * 0.9}, 'completed', 'cliq',
          ${'Payment released: ' + ms.en}, ${'إفراج عن الدفعة: ' + ms.ar})`;
    }
    console.log('✅  Escrow & transactions done');

    // ── 12. Wallets ───────────────────────────────────────────────────────────
    console.log('👛  Updating wallets…');

    // Freelancers (wallets created by trigger on INSERT INTO users)
    const walletData = [
      { id: freelancers[0].id, balance: 612.000, pending: 450.000, earned: 1850.000, withdrawn: 1200.000 },
      { id: freelancers[1].id, balance: 88.000,  pending: 120.000, earned:  580.000, withdrawn:  350.000 },
      { id: freelancers[2].id, balance: 145.000, pending: 0,       earned:  220.000, withdrawn:   75.000 },
      { id: freelancers[3].id, balance: 432.000, pending: 0,       earned:  912.000, withdrawn:  480.000 },
      { id: freelancers[4].id, balance: 65.000,  pending: 80.000,  earned:  310.000, withdrawn:  200.000 },
    ];
    for (const w of walletData) {
      await sql`
        INSERT INTO wallets (user_id, balance, pending_balance, total_earned, total_withdrawn)
        VALUES (${w.id}, ${w.balance}, ${w.pending}, ${w.earned}, ${w.withdrawn})
        ON CONFLICT (user_id) DO UPDATE SET
          balance = ${w.balance}, pending_balance = ${w.pending},
          total_earned = ${w.earned}, total_withdrawn = ${w.withdrawn}`;
    }
    // Client wallets (no trigger creates them — insert manually for balance tracking)
    for (const c of clients) {
      await sql`
        INSERT INTO wallets (user_id, balance, pending_balance)
        VALUES (${c.id}, ${(Math.random() * 500 + 200).toFixed(3)}, 0)
        ON CONFLICT (user_id) DO NOTHING`;
    }
    console.log('✅  Wallets done');

    // ── 13. Withdrawals ───────────────────────────────────────────────────────
    console.log('🏧  Creating withdrawals…');

    await sql`
      INSERT INTO withdrawals (freelancer_id, amount, method,
        bank_name, bank_account, bank_iban,
        status, notes)
      VALUES (
        ${freelancers[0].id}, 300.000, 'bank_transfer',
        'Arab Bank Jordan', '0123456789', 'JO94ABJO0010000001234567891234',
        'pending',
        'Monthly withdrawal — March 2026'
      )`;

    await sql`
      INSERT INTO withdrawals (freelancer_id, amount, method,
        cliq_alias, status,
        processed_by, processed_at, reference_number, notes)
      VALUES (
        ${freelancers[3].id}, 200.000, 'cliq',
        'rania.haddad', 'completed',
        ${superAdmin.id}, ${ago(12)},
        'WD-2026-0312-004',
        'Approved and transferred via CliQ'
      )`;

    await sql`
      INSERT INTO withdrawals (freelancer_id, amount, method,
        mobile_number, status)
      VALUES (
        ${freelancers[4].id}, 80.000, 'zain_cash',
        '+962799001234', 'pending'
      )`;

    console.log('✅  Withdrawals done');

    // ── 14. Reviews ───────────────────────────────────────────────────────────
    console.log('⭐  Creating reviews…');

    // Review for completed order1: client[0] reviews freelancer[0]
    await sql`
      INSERT INTO reviews (order_id, reviewer_id, reviewee_id,
        overall_rating, communication, quality, timeliness,
        comment_en, comment_ar)
      VALUES (
        ${order1.id}, ${clients[0].id}, ${freelancers[0].id},
        5, 5, 5, 4,
        'Omar delivered an exceptional portfolio website. The Arabic RTL support is flawless and the admin panel is very intuitive. Would definitely hire again for future projects.',
        'أنجز عمر موقع محفظة رائعاً. دعم RTL للعربية ممتاز ولوحة التحكم سهلة الاستخدام. سأوظفه بالتأكيد في مشاريع مستقبلية.'
      )`;

    // Review for completed contract2: client[3] reviews freelancer[3]
    await sql`
      INSERT INTO reviews (contract_id, reviewer_id, reviewee_id,
        overall_rating, communication, quality, timeliness,
        comment_en, comment_ar)
      VALUES (
        ${contract2.id}, ${clients[3].id}, ${freelancers[3].id},
        5, 5, 5, 5,
        'Rania is a true digital marketing expert. Our lead generation increased by 180% during her campaign. Her reports were detailed and actionable. Highly recommended.',
        'رانيا خبيرة تسويق رقمي حقيقية. ارتفع توليد العملاء المحتملين لدينا بنسبة 180% خلال حملتها. تقاريرها مفصلة وعملية. موصى بها بشدة.'
      )`;

    // Reverse review: freelancer[3] reviews client[3]
    await sql`
      INSERT INTO reviews (contract_id, reviewer_id, reviewee_id,
        overall_rating, communication, quality, timeliness,
        comment_en, comment_ar)
      VALUES (
        ${contract2.id}, ${freelancers[3].id}, ${clients[3].id},
        5, 5, null, null,
        'Faris was a pleasure to work with. Clear briefs, prompt feedback, and timely payments. An ideal client.',
        'كان فارس من أفضل العملاء. توجيهات واضحة وردود سريعة ومدفوعات في الوقت المحدد.'
      )`;

    console.log('✅  Reviews done');

    // ── 15. Support tickets ───────────────────────────────────────────────────
    console.log('🎫  Creating support tickets…');

    const ticket1BodyEn = `Hello, I noticed that my CliQ account was charged twice for Order #${order1.id.slice(0, 8)}. The amount of 350 JOD was deducted two times on March 5th. Please investigate and refund the duplicate charge.`;
    const [ticket1] = await sql`
      INSERT INTO support_tickets (user_id, assigned_to,
        subject_en, subject_ar, body_en, body_ar,
        status, priority)
      VALUES (
        ${clients[0].id}, ${supportAdmin.id},
        ${'Payment charged twice for the same order'},
        ${'تم خصم الدفعة مرتين لنفس الطلب'},
        ${ticket1BodyEn},
        ${'مرحباً، لاحظت أن حسابي على CliQ تم خصمه مرتين للطلب. مبلغ 350 دينار تم خصمه مرتين في 5 مارس. يُرجى التحقيق وإعادة الخصم المكرر.'},
        ${'in_progress'}, ${'high'}
      ) RETURNING id`;

    await sql`
      INSERT INTO ticket_replies (ticket_id, sender_id, body, is_internal)
      VALUES (
        ${ticket1.id}, ${supportAdmin.id},
        'Thank you for reaching out Ahmed. I have escalated this to our finance team and we will review your transaction history within 24 hours. You will receive a notification once resolved.',
        false
      )`;

    await sql`
      INSERT INTO ticket_replies (ticket_id, sender_id, body, is_internal)
      VALUES (
        ${ticket1.id}, ${supportAdmin.id},
        'INTERNAL NOTE: Checked transaction logs — this appears to be a CliQ gateway duplicate. Need to coordinate with finance admin for manual refund of 350 JOD.',
        true
      )`;

    const [ticket2] = await sql`
      INSERT INTO support_tickets (user_id,
        subject_en, subject_ar, body_en, body_ar,
        status, priority)
      VALUES (
        ${freelancers[2].id},
        ${'KYC document uploaded but still showing as Pending'},
        ${'تم رفع وثيقة التحقق لكن الحالة لا تزال معلقة'},
        ${'I uploaded my national ID card for identity verification 5 days ago but my profile still shows Pending status. I cannot apply for projects requiring verified freelancers. Please verify my identity.'},
        ${'قمت برفع بطاقة الهوية الوطنية للتحقق من الهوية قبل 5 أيام لكن ملفي الشخصي لا يزال يظهر حالة قيد الانتظار. لا أستطيع التقديم على مشاريع تتطلب مستقلين موثقين.'},
        ${'open'}, ${'medium'}
      ) RETURNING id`;

    await sql`
      INSERT INTO support_tickets (user_id,
        subject_en, subject_ar, body_en, body_ar,
        status, priority)
      VALUES (
        ${clients[4].id},
        ${'How do I request a revision on a delivered order?'},
        ${'كيف أطلب مراجعة على طلب تم تسليمه؟'},
        ${'The video editor delivered my order but I need some changes to the subtitles and colour grading. I cannot find the revision button. Can you guide me?'},
        ${'قام محرر الفيديو بتسليم طلبي لكنني أحتاج تغييرات في الترجمات وتدرج الألوان. لا أجد زر طلب المراجعة. هل يمكنكم إرشادي؟'},
        ${'resolved'}, ${'low'}
      )`;

    console.log('✅  Tickets done');

    // ── 16. Notifications ─────────────────────────────────────────────────────
    console.log('🔔  Creating notifications…');

    const notifs = [
      { user: clients[1].id,    type: 'milestone_submitted',   en: 'Milestone Submitted for Review',    ar: 'تم تقديم المرحلة للمراجعة',   body_en: 'Omar has submitted Milestone 2: Core App Development for your review.', body_ar: 'قدّم عمر المرحلة 2: التطوير الخلفي للمراجعة.' },
      { user: freelancers[0].id, type: 'milestone_approved',    en: 'Milestone 1 Approved!',              ar: 'تمت الموافقة على المرحلة 1!',  body_en: 'Sara has approved Milestone 1 and payment of 270 JOD has been released.', body_ar: 'وافقت سارة على المرحلة 1 وتم الإفراج عن 270 دينار.' },
      { user: freelancers[0].id, type: 'milestone_revision',    en: 'Revision Requested on Milestone 3', ar: 'طلب مراجعة على المرحلة 3',     body_en: 'Sara requested changes: improve contrast and add offline queue sync.', body_ar: 'طلبت سارة تعديلات: تحسين التباين وإضافة مزامنة الطابور الغير متصل.' },
      { user: clients[4].id,    type: 'order_delivered',        en: 'Order Delivered — Review Pending',  ar: 'تم تسليم الطلب — بانتظار مراجعتك', body_en: 'Tariq has delivered your video editing order. Review and approve within 7 days.', body_ar: 'سلّم طارق طلب مونتاج الفيديو. راجع واوافق خلال 7 أيام.' },
      { user: freelancers[3].id, type: 'payment_released',      en: 'Payment Released — 144 JOD',        ar: 'تم الإفراج عن الدفعة — 144 دينار', body_en: 'Payment of 144 JOD for Milestone 2 has been released to your wallet.', body_ar: 'تم الإفراج عن دفعة 144 دينار للمرحلة 2 إلى محفظتك.' },
      { user: freelancers[2].id, type: 'proposal_received',     en: 'Your Proposal is Under Review',     ar: 'عرضك قيد المراجعة',             body_en: 'Your proposal for the Legal Translation project is being reviewed by the client.', body_ar: 'عرضك لمشروع الترجمة القانونية قيد المراجعة من قِبل العميل.' },
      { user: clients[0].id,    type: 'review_received',        en: 'New Review on Your Account',        ar: 'تقييم جديد على حسابك',          body_en: 'Ahmed left you a 5-star review on the Portfolio Website project.', body_ar: 'ترك أحمد تقييماً 5 نجوم على مشروع موقع المحفظة.' },
    ];
    for (const n of notifs) {
      await sql`
        INSERT INTO notifications (user_id, type, title_en, title_ar, body_en, body_ar, is_read)
        VALUES (${n.user}, ${n.type}, ${n.en}, ${n.ar}, ${n.body_en}, ${n.body_ar}, false)`;
    }
    console.log('✅  Notifications done');

    // ── Done ──────────────────────────────────────────────────────────────────
    console.log('');
    console.log('🎉  Seed complete!');
    console.log('');
    console.log('─────────────────────────────────────────────────────────');
    console.log('  TEST ACCOUNTS  (all passwords: Test@1234)');
    console.log('─────────────────────────────────────────────────────────');
    console.log('  SUPER ADMIN   superadmin@seed.dopa');
    console.log('  SUPPORT ADMIN support@seed.dopa');
    console.log('');
    console.log('  FREELANCERS:');
    console.log('  omar.nasser@seed.dopa      Web Dev (verified)');
    console.log('  lina.barakat@seed.dopa     Design  (verified)');
    console.log('  kareem.zoubi@seed.dopa     Translation (KYC pending)');
    console.log('  rania.haddad@seed.dopa     Marketing (unverified)');
    console.log('  tariq.mansour@seed.dopa    Video Editing (verified)');
    console.log('');
    console.log('  CLIENTS:');
    console.log('  ahmed.rashid@seed.dopa     Al-Rashid Trading Co.  (Amman)');
    console.log('  sara.khalil@seed.dopa      Khalil Restaurant Group (Irbid)');
    console.log('  nour.saleh@seed.dopa       Saleh Real Estate       (Zarqa)');
    console.log('  faris.haddad@seed.dopa     Haddad Tech Solutions  (Amman)');
    console.log('  maya.qasem@seed.dopa       Qasem Media Agency     (Amman)');
    console.log('─────────────────────────────────────────────────────────');
    console.log('');
    console.log('  What is seeded:');
    console.log('  ✓ 5 gigs with 3-tier packages each');
    console.log('  ✓ 5 projects (open/in_progress/completed)');
    console.log('  ✓ 7 proposals (pending + accepted)');
    console.log('  ✓ 3 contracts with 10 milestones');
    console.log('    — approved, submitted, revision_requested, pending');
    console.log('  ✓ 3 gig orders (completed, in_progress, delivered)');
    console.log('  ✓ Chat rooms with realistic bilingual messages');
    console.log('  ✓ Escrow accounts + transaction history');
    console.log('  ✓ Wallet balances for all users');
    console.log('  ✓ 3 withdrawal requests (pending, completed, pending)');
    console.log('  ✓ 3 reviews (client→freelancer, x2, freelancer→client)');
    console.log('  ✓ 3 support tickets with replies');
    console.log('  ✓ 7 notifications');
    console.log('');

  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
