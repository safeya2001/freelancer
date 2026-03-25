/**
 * seed-data.js — Populate database with realistic test data
 * Run: docker compose exec backend node scripts/seed-data.js
 */

const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'freelance_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'freelance_db',
});

async function seed() {
  await client.connect();
  console.log('✅ Connected to database');

  // ── Check if already seeded ───────────────────────────────────
  const { rows: existing } = await client.query(
    `SELECT COUNT(*) FROM users WHERE email LIKE '%test.dopawork%'`
  );
  if (parseInt(existing[0].count) > 0) {
    console.log('⚠️  Test data already exists. Skipping.');
    await client.end();
    return;
  }

  const hash = await bcrypt.hash('Test@1234', 12);

  // ── Fetch category IDs ────────────────────────────────────────
  const { rows: cats } = await client.query('SELECT id, name_en FROM categories');
  const catMap = {};
  cats.forEach(c => catMap[c.name_en] = c.id);

  // ── Create Users ──────────────────────────────────────────────
  const clientId1    = uuidv4();
  const clientId2    = uuidv4();
  const freelancerId1 = uuidv4();
  const freelancerId2 = uuidv4();
  const freelancerId3 = uuidv4();

  const users = [
    { id: clientId1,    email: 'ahmed@test.dopawork', role: 'client',     name_en: 'Ahmed Al-Rashid',   name_ar: 'أحمد الراشد',    city: 'amman'   },
    { id: clientId2,    email: 'sara@test.dopawork',  role: 'client',     name_en: 'Sara Khalil',        name_ar: 'سارة خليل',      city: 'irbid'   },
    { id: freelancerId1, email: 'omar@test.dopawork',  role: 'freelancer', name_en: 'Omar Nasser',        name_ar: 'عمر ناصر',       city: 'amman'   },
    { id: freelancerId2, email: 'lina@test.dopawork',  role: 'freelancer', name_en: 'Lina Barakat',       name_ar: 'لينا بركات',     city: 'zarqa'   },
    { id: freelancerId3, email: 'malik@test.dopawork', role: 'freelancer', name_en: 'Malik Al-Zoubi',     name_ar: 'مالك الزعبي',    city: 'amman'   },
  ];

  for (const u of users) {
    await client.query(
      `INSERT INTO users (id, email, password_hash, role, is_verified, preferred_language)
       VALUES ($1, $2, $3, $4, true, 'ar')
       ON CONFLICT (email) DO NOTHING`,
      [u.id, u.email, hash, u.role]
    );

    const isFreelancer = u.role === 'freelancer';
    await client.query(
      `INSERT INTO profiles (user_id, full_name_en, full_name_ar, city, bio_en, bio_ar,
        hourly_rate, availability_status, identity_verified, completed_orders, avg_rating, total_reviews)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verified', $9, $10, $11)
       ON CONFLICT (user_id) DO NOTHING`,
      [
        u.id, u.name_en, u.name_ar, u.city,
        isFreelancer ? `Professional ${u.name_en.split(' ')[0]} with 5+ years of experience delivering high-quality work for clients across Jordan and the MENA region.` : null,
        isFreelancer ? `محترف متخصص مع أكثر من 5 سنوات خبرة في تقديم عمل عالي الجودة للعملاء في الأردن ومنطقة الشرق الأوسط.` : null,
        isFreelancer ? (15 + Math.floor(Math.random() * 35)) : null,
        isFreelancer ? 'available' : null,
        isFreelancer ? Math.floor(10 + Math.random() * 40) : 0,
        isFreelancer ? (4.2 + Math.random() * 0.7).toFixed(1) : 0,
        isFreelancer ? Math.floor(5 + Math.random() * 30) : 0,
      ]
    );

    // Wallet
    await client.query(
      `INSERT INTO wallets (user_id, balance, pending_balance, total_earned, total_withdrawn)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO NOTHING`,
      [u.id,
        isFreelancer ? (50 + Math.random() * 200).toFixed(2) : (100 + Math.random() * 500).toFixed(2),
        isFreelancer ? (10 + Math.random() * 50).toFixed(2) : 0,
        isFreelancer ? (200 + Math.random() * 800).toFixed(2) : 0,
        isFreelancer ? (50 + Math.random() * 200).toFixed(2) : 0,
      ]
    );
  }
  console.log('✅ Users created');

  // ── Freelancer Skills ─────────────────────────────────────────
  const skillSets = {
    [freelancerId1]: { en: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'], ar: ['ريأكت', 'نود.جي اس', 'تايب سكريبت', 'بوستجري'] },
    [freelancerId2]: { en: ['Figma', 'Adobe XD', 'Illustrator', 'Branding'], ar: ['فيغما', 'أدوبي', 'إليستريتور', 'هوية بصرية'] },
    [freelancerId3]: { en: ['Flutter', 'React Native', 'iOS', 'Android'],     ar: ['فلاتر', 'ريأكت نيتيف', 'آي أو إس', 'أندرويد'] },
  };
  for (const [uid, skills] of Object.entries(skillSets)) {
    await client.query(
      `UPDATE profiles SET skills_en=$1, skills_ar=$2 WHERE user_id=$3`,
      [skills.en, skills.ar, uid]
    );
  }

  // ── Gigs ──────────────────────────────────────────────────────
  const gigs = [
    {
      id: uuidv4(), freelancer_id: freelancerId1,
      category_id: catMap['Web Development'],
      title_en: 'Professional Full-Stack Web Development with React & Node.js',
      title_ar: 'تطوير مواقع احترافي بـ React و Node.js',
      desc_en: 'I will build a complete, responsive web application using React, Node.js, and PostgreSQL. Includes authentication, REST API, and deployment.',
      desc_ar: 'سأبني تطبيق ويب متكامل وسريع الاستجابة باستخدام React وNode.js وPostgreSQL. يشمل المصادقة وواجهة API والنشر.',
      basic_price: 150, standard_price: 300, premium_price: 600,
      delivery_days: 7, avg_rating: 4.8, review_count: 14,
    },
    {
      id: uuidv4(), freelancer_id: freelancerId2,
      category_id: catMap['Graphic Design'],
      title_en: 'Complete Brand Identity Design — Logo, Colors & Guidelines',
      title_ar: 'تصميم هوية بصرية متكاملة — شعار وألوان ودليل',
      desc_en: 'Professional brand identity package including logo design, color palette, typography, and brand guidelines PDF.',
      desc_ar: 'حزمة هوية بصرية احترافية تشمل تصميم الشعار ولوحة الألوان والخطوط ودليل العلامة التجارية PDF.',
      basic_price: 80, standard_price: 150, premium_price: 300,
      delivery_days: 5, avg_rating: 4.9, review_count: 22,
    },
    {
      id: uuidv4(), freelancer_id: freelancerId3,
      category_id: catMap['Mobile Apps'],
      title_en: 'Cross-Platform Mobile App Development with Flutter',
      title_ar: 'تطوير تطبيق موبايل متعدد المنصات بـ Flutter',
      desc_en: 'Build a cross-platform mobile app (iOS + Android) using Flutter. Clean UI, smooth animations, and API integration included.',
      desc_ar: 'بناء تطبيق موبايل متعدد المنصات (iOS + Android) باستخدام Flutter. واجهة أنيقة وتكامل API.',
      basic_price: 200, standard_price: 400, premium_price: 800,
      delivery_days: 14, avg_rating: 4.7, review_count: 9,
    },
    {
      id: uuidv4(), freelancer_id: freelancerId1,
      category_id: catMap['Web Development'],
      title_en: 'REST API Development & Third-Party Integration',
      title_ar: 'تطوير REST API وربط خدمات خارجية',
      desc_en: 'Develop secure, scalable REST APIs with NestJS or Express. Includes documentation, testing, and third-party integrations.',
      desc_ar: 'تطوير APIs آمنة وقابلة للتوسع باستخدام NestJS أو Express. يشمل التوثيق والاختبار.',
      basic_price: 100, standard_price: 200, premium_price: 400,
      delivery_days: 5, avg_rating: 4.6, review_count: 7,
    },
    {
      id: uuidv4(), freelancer_id: freelancerId2,
      category_id: catMap['Graphic Design'],
      title_en: 'Social Media Graphics Pack — 10 Custom Designs',
      title_ar: 'تصاميم سوشيال ميديا — 10 تصاميم مخصصة',
      desc_en: 'Professional social media graphics for Instagram, Facebook, and LinkedIn. Includes post designs, stories, and cover photos.',
      desc_ar: 'تصاميم احترافية للسوشيال ميديا لإنستغرام وفيسبوك ولينكدإن. يشمل بوستات وستوريز وصور الغلاف.',
      basic_price: 40, standard_price: 80, premium_price: 150,
      delivery_days: 3, avg_rating: 5.0, review_count: 31,
    },
  ];

  for (const g of gigs) {
    await client.query(
      `INSERT INTO gigs (id, freelancer_id, category_id, title_en, title_ar,
        description_en, description_ar, basic_price, standard_price, premium_price,
        delivery_days, status, avg_rating, review_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$13)
       ON CONFLICT DO NOTHING`,
      [g.id, g.freelancer_id, g.category_id, g.title_en, g.title_ar,
       g.desc_en, g.desc_ar, g.basic_price, g.standard_price, g.premium_price,
       g.delivery_days, g.avg_rating, g.review_count]
    );
  }
  console.log('✅ Gigs created');

  // ── Projects ──────────────────────────────────────────────────
  const projects = [
    {
      id: uuidv4(), client_id: clientId1,
      title_en: 'E-commerce Website for Jordanian Handicrafts',
      title_ar: 'موقع تجارة إلكترونية للحرف اليدوية الأردنية',
      desc_en: 'Looking for an experienced developer to build a bilingual (Arabic/English) e-commerce website for handmade Jordanian products. Must support CliQ and credit card payments.',
      budget_min: 500, budget_max: 1200, budget_type: 'fixed',
      preferred_city: 'amman', status: 'open',
    },
    {
      id: uuidv4(), client_id: clientId2,
      title_en: 'Mobile App for Restaurant Order Management',
      title_ar: 'تطبيق موبايل لإدارة طلبات المطعم',
      desc_en: 'Need a React Native or Flutter app for managing restaurant orders, table reservations, and staff assignments. Arabic UI required.',
      budget_min: 800, budget_max: 2000, budget_type: 'fixed',
      preferred_city: 'irbid', status: 'open',
    },
    {
      id: uuidv4(), client_id: clientId1,
      title_en: 'Monthly Social Media Management & Content Creation',
      title_ar: 'إدارة سوشيال ميديا وإنشاء محتوى شهري',
      desc_en: 'Seeking a creative content creator for monthly social media management. Platforms: Instagram, TikTok, LinkedIn. Arabic and English content.',
      budget_min: 150, budget_max: 300, budget_type: 'fixed',
      preferred_city: 'amman', status: 'open',
    },
    {
      id: uuidv4(), client_id: clientId2,
      title_en: 'Data Entry & CRM Setup for Real Estate Company',
      title_ar: 'إدخال بيانات وإعداد CRM لشركة عقارية',
      desc_en: 'Enter 500+ property listings into our new CRM system and create Arabic/English data entry templates.',
      budget_min: 50, budget_max: 150, budget_type: 'fixed',
      preferred_city: 'amman', status: 'open',
    },
  ];

  for (const p of projects) {
    await client.query(
      `INSERT INTO projects (id, client_id, title_en, title_ar, description_en,
        budget_min, budget_max, budget_type, preferred_city, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT DO NOTHING`,
      [p.id, p.client_id, p.title_en, p.title_ar, p.desc_en,
       p.budget_min, p.budget_max, p.budget_type, p.preferred_city, p.status]
    );
  }
  console.log('✅ Projects created');

  await client.end();

  console.log('');
  console.log('🎉 Test data seeded successfully!');
  console.log('');
  console.log('📋 Test Accounts (password: Test@1234):');
  console.log('   CLIENT     → ahmed@test.dopawork');
  console.log('   CLIENT     → sara@test.dopawork');
  console.log('   FREELANCER → omar@test.dopawork');
  console.log('   FREELANCER → lina@test.dopawork');
  console.log('   FREELANCER → malik@test.dopawork');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
