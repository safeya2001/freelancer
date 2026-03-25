DO $$
DECLARE
  hash TEXT := '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';
  cid1 UUID := gen_random_uuid();
  cid2 UUID := gen_random_uuid();
  fid1 UUID := gen_random_uuid();
  fid2 UUID := gen_random_uuid();
  fid3 UUID := gen_random_uuid();
  cat_web UUID; cat_design UUID; cat_mobile UUID;
BEGIN
  SELECT id INTO cat_web    FROM categories WHERE name_en = 'Web Development' LIMIT 1;
  SELECT id INTO cat_design FROM categories WHERE name_en = 'Graphic Design'  LIMIT 1;
  SELECT id INTO cat_mobile FROM categories WHERE name_en = 'Mobile Apps'     LIMIT 1;

  INSERT INTO users (id, email, password_hash, role, status, email_verified, preferred_language) VALUES
    (cid1, 'ahmed@test.dopawork', hash, 'client',     'active', true, 'ar'),
    (cid2, 'sara@test.dopawork',  hash, 'client',     'active', true, 'ar'),
    (fid1, 'omar@test.dopawork',  hash, 'freelancer', 'active', true, 'ar'),
    (fid2, 'lina@test.dopawork',  hash, 'freelancer', 'active', true, 'ar'),
    (fid3, 'malik@test.dopawork', hash, 'freelancer', 'active', true, 'ar')
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO profiles (user_id, full_name_en, full_name_ar, city, bio_en, bio_ar, hourly_rate, availability, identity_verified, completed_orders, avg_rating, review_count) VALUES
    (cid1, 'Ahmed Al-Rashid', 'احمد الراشد',  'amman', NULL, NULL, NULL, true, 'unverified', 0, 0, 0),
    (cid2, 'Sara Khalil',     'سارة خليل',    'irbid', NULL, NULL, NULL, true, 'unverified', 0, 0, 0),
    (fid1, 'Omar Nasser',     'عمر ناصر',     'amman', 'Full-stack developer with 6 years experience in React and Node.js', 'مطور Full-Stack بخبرة 6 سنوات', 25, true, 'verified', 38, 4.8, 21),
    (fid2, 'Lina Barakat',    'لينا بركات',   'zarqa', 'Creative graphic designer specialized in brand identity', 'مصممة جرافيك متخصصة في الهوية البصرية', 20, true, 'verified', 52, 4.9, 34),
    (fid3, 'Malik Al-Zoubi',  'مالك الزعبي',  'amman', 'Mobile app developer specializing in Flutter and React Native', 'مطور تطبيقات موبايل متخصص في Flutter', 30, true, 'verified', 27, 4.7, 15)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO wallets (user_id, balance, pending_balance) VALUES
    (cid1, 500.000, 0), (cid2, 350.000, 0),
    (fid1, 180.500, 45.000), (fid2, 230.000, 60.000), (fid3, 120.000, 30.000)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO gigs (freelancer_id, category_id, title_en, title_ar, description_en, description_ar, price, delivery_days, status, avg_rating, review_count) VALUES
    (fid1, cat_web,    'Professional Full-Stack Web App with React and Node.js', 'تطوير تطبيق ويب متكامل بـ React و Node.js', 'Complete responsive web application with auth, REST API, and deployment.', 'تطبيق ويب متكامل يشمل المصادقة وواجهة API والنشر.', 150, 7, 'active', 4.8, 14),
    (fid2, cat_design, 'Complete Brand Identity Logo Colors and Style Guide',    'هوية بصرية متكاملة شعار وألوان ودليل أسلوب', 'Logo, color palette, typography, business card, and brand guidelines PDF.', 'شعار ولوحة ألوان وخطوط وكرت أعمال ودليل العلامة التجارية.', 80, 5, 'active', 4.9, 22),
    (fid3, cat_mobile, 'Cross-Platform Mobile App Development with Flutter',     'تطوير تطبيق موبايل متعدد المنصات بـ Flutter', 'iOS and Android app with clean UI, animations, and API integration.', 'تطبيق iOS وAndroid بواجهة جميلة وتكامل API.', 200, 14, 'active', 4.7, 9),
    (fid1, cat_web,    'REST API Development and Third-Party Integrations',      'تطوير REST API وربط الخدمات الخارجية', 'Secure documented APIs with NestJS. Includes Swagger and tests.', 'APIs آمنة وموثقة باستخدام NestJS مع Swagger.', 100, 5, 'active', 4.6, 7),
    (fid2, cat_design, 'Social Media Graphics Pack 10 Custom Designs',           'تصاميم سوشيال ميديا 10 تصاميم مخصصة', 'Social media graphics for Instagram, Facebook, and LinkedIn.', 'تصاميم للسوشيال ميديا لإنستغرام وفيسبوك ولينكدإن.', 40, 3, 'active', 5.0, 31),
    (fid3, cat_mobile, 'Bug Fixing and Performance Optimization for Mobile Apps','إصلاح الأخطاء وتحسين أداء التطبيقات', 'Fix bugs and improve performance for React Native or Flutter apps.', 'إصلاح الأخطاء وتحسين الأداء لتطبيقات Flutter وReact Native.', 60, 3, 'active', 4.5, 5);

  INSERT INTO projects (client_id, title_en, title_ar, description_en, budget_min, budget_max, budget_type, preferred_city, status) VALUES
    (cid1, 'E-commerce Website for Jordanian Handicrafts', 'موقع تجارة إلكترونية للحرف اليدوية الأردنية', 'Bilingual e-commerce website for handmade Jordanian products with CliQ and card payments.', 500, 1200, 'fixed', 'amman', 'open'),
    (cid2, 'Mobile App for Restaurant Order Management',   'تطبيق موبايل لإدارة طلبات المطعم',          'Flutter or React Native app for orders, reservations, and kitchen display.', 800, 2000, 'fixed', 'irbid', 'open'),
    (cid1, 'Monthly Social Media Content Creation',        'إنشاء محتوى سوشيال ميديا شهري',             'Designer for monthly Instagram and TikTok content in Arabic and English.', 150, 300, 'fixed', 'amman', 'open'),
    (cid2, 'Logo and Brand Identity for New Cafe',         'شعار وهوية بصرية لكافيه جديد',              'Complete brand identity for new specialty coffee shop: logo, menu, social kit.', 200, 500, 'fixed', 'irbid', 'open');

  RAISE NOTICE 'Seed complete!';
END $$;
