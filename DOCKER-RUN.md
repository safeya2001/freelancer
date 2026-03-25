# تشغيل المشروع بـ Docker

**مهم:** كل الأوامر تشتغل من داخل مجلد **`freelance`** (المجلد اللي فيه `docker-compose.yml`)، مو من مجلد `freelancer`.

## الطريقة الأسهل (من أي مكان)

من مجلد `freelancer` شغّل:

```bat
freelance\run-docker.bat
```

هذا ينقلك لمجلد `freelance`، ينسخ `.env.example` إلى `.env` إذا ما موجود، ويشغّل Docker.

---

## الطريقة اليدوية

### 1. ادخل لمجلد المشروع

```bat
cd freelance
```

### 2. إعداد ملف البيئة

```bat
copy .env.example .env
```

عدّل `.env` وضَع على الأقل:
- `JWT_SECRET` و `JWT_REFRESH_SECRET` (قيم عشوائية طويلة)
- باقي القيم اختيارية (Stripe، SMTP، Google)

### 3. التشغيل (وأنت داخل مجلد `freelance`)

```bat
docker compose up -d --build
```

انتظر حتى تصبح كل الخدمات `healthy` (أول مرة قد تستغرق عدة دقائق).

## الوصول للتطبيق

- **الواجهة:** http://localhost:3002 (المنفذ 3002 عشان ما يتعارض مع تطبيقات ثانية على 3000)
- **الـ API:** http://localhost:3001/api/v1
- **صحة الـ API:** http://localhost:3001/api/v1/health

الفرونت اند يبني بقيم افتراضية: عنوان الـ API = http://localhost:3001/api/v1 عشان اللوغن والطلبات تشتغل من المتصفح.

## التحقق من الخدمات

```bash
docker compose ps
```

## إيقاف التشغيل

```bash
docker compose down
```

---

**ملاحظة:** الـ migrations من 001 إلى 009 تُنفَّذ تلقائياً عند أول إنشاء لقاعدة البيانات. إذا كان عندك volume قديم لـ Postgres وتريد تشغيل الـ migrations الجديدة فقط، نفّذ الملفات 005–009 يدوياً على قاعدة البيانات.

---

## لو ظهر "Internal server error" عند اللوغن

- تأكد إن في ملف **`.env`** قيم لـ **`JWT_SECRET`** و **`JWT_REFRESH_SECRET`** (س strings طويلة وعشوائية). بدونهم الباكند يعمل لكن اللوغن يقدر يفشل.
- **Stripe** صار اختياري: ما تحتاج تضبط `STRIPE_SECRET_KEY` أو `STRIPE_WEBHOOK_SECRET` عشان التشغيل؛ تقدر تستخدم الدفع المحلي فقط.
- الفرونت يفتح على **http://localhost:3002** ويبعت طلبات على **http://localhost:3001/api/v1** — لو غيّرت المنافذ تأكد إن الـ `.env` فيها `NEXT_PUBLIC_API_URL` و `FRONTEND_URL` المناسبين وأعد بناء الفرونت: `docker compose up -d --build`.

---

## كيف تتأكد إن المشروع هذا من التعديلات هنا (مو من مصدر ثاني)

- تشغيل من **Docker** على **localhost:3002** و **localhost:3001** — نفس الإعداد اللي ضبطناه.
- وجود ملفات مثل: **`run-docker.bat`**، **`DOCKER-RUN.md`**، migrations **005** حتى **009** (دفع محلي، سحوبات، محتوى، إشعارات، عروض بالساعة)، ووجود **وحدة Content** و **Reports** و **initiate-local** في الباكند.
- لو فتحت المشروع من مجلد **freelancer** وبداخله **freelance** وضبطت اللوغن والمنفذ 3002 هون، فهو نفس المشروع اللي تم العمل عليه.
