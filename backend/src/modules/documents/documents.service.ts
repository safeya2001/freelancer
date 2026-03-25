import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class DocumentsService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  private toWordsEN(amount: number): string {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
      'seventeen', 'eighteen', 'nineteen'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

    if (amount === 0) return 'zero';
    if (amount < 20) return ones[amount];
    if (amount < 100) return tens[Math.floor(amount / 10)] + (amount % 10 ? '-' + ones[amount % 10] : '');
    if (amount < 1000) return ones[Math.floor(amount / 100)] + ' hundred' + (amount % 100 ? ' ' + this.toWordsEN(amount % 100) : '');
    return this.toWordsEN(Math.floor(amount / 1000)) + ' thousand' + (amount % 1000 ? ' ' + this.toWordsEN(amount % 1000) : '');
  }

  private toWordsAR(amount: number): string {
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة',
      'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر',
      'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة',
      'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    if (amount === 0) return 'صفر';
    if (amount < 20) return ones[amount];
    if (amount < 100) return tens[Math.floor(amount / 10)] + (amount % 10 ? ' و' + ones[amount % 10] : '');
    if (amount < 1000) return hundreds[Math.floor(amount / 100)] + (amount % 100 ? ' و' + this.toWordsAR(amount % 100) : '');
    return this.toWordsAR(Math.floor(amount / 1000)) + ' ألف' + (amount % 1000 ? ' و' + this.toWordsAR(amount % 1000) : '');
  }

  private async getPaymentProofData(transactionId: string, forAdmin: boolean, requestingUserId?: string) {
    const rows = forAdmin
      ? await this.sql`
          SELECT t.*, cp.full_name_en AS client_name, cp.full_name_ar AS client_name_ar,
                 fp.full_name_en AS freelancer_name, fp.full_name_ar AS freelancer_name_ar,
                 cu.email AS client_email, fu.email AS freelancer_email,
                 COALESCE(pr.title_en, g.title_en) AS project_title_en,
                 COALESCE(pr.title_ar, g.title_ar) AS project_title_ar,
                 LEFT(COALESCE(pr.description_en, g.description_en), 400) AS project_description_en
          FROM transactions t
          LEFT JOIN users cu ON cu.id = t.from_user_id
          LEFT JOIN profiles cp ON cp.user_id = t.from_user_id
          LEFT JOIN users fu ON fu.id = t.to_user_id
          LEFT JOIN profiles fp ON fp.user_id = t.to_user_id
          LEFT JOIN orders o ON o.id = t.order_id
          LEFT JOIN gigs g ON g.id = o.gig_id
          LEFT JOIN milestones m ON m.id = t.milestone_id
          LEFT JOIN contracts c ON c.id = m.contract_id
          LEFT JOIN projects pr ON pr.id = c.project_id
          WHERE t.id = ${transactionId}
        `
      : await this.sql`
          SELECT t.*, cp.full_name_en AS client_name, cp.full_name_ar AS client_name_ar,
                 fp.full_name_en AS freelancer_name, fp.full_name_ar AS freelancer_name_ar,
                 cu.email AS client_email, fu.email AS freelancer_email,
                 COALESCE(pr.title_en, g.title_en) AS project_title_en,
                 COALESCE(pr.title_ar, g.title_ar) AS project_title_ar,
                 LEFT(COALESCE(pr.description_en, g.description_en), 400) AS project_description_en
          FROM transactions t
          LEFT JOIN users cu ON cu.id = t.from_user_id
          LEFT JOIN profiles cp ON cp.user_id = t.from_user_id
          LEFT JOIN users fu ON fu.id = t.to_user_id
          LEFT JOIN profiles fp ON fp.user_id = t.to_user_id
          LEFT JOIN orders o ON o.id = t.order_id
          LEFT JOIN gigs g ON g.id = o.gig_id
          LEFT JOIN milestones m ON m.id = t.milestone_id
          LEFT JOIN contracts c ON c.id = m.contract_id
          LEFT JOIN projects pr ON pr.id = c.project_id
          WHERE t.id = ${transactionId}
            AND (t.from_user_id = ${requestingUserId as string} OR t.to_user_id = ${requestingUserId as string})
        `;
    return (rows as any[])[0];
  }

  async generatePaymentProof(transactionId: string, requestingUserId: string): Promise<Buffer> {
    const tx = await this.getPaymentProofData(transactionId, false, requestingUserId);
    if (!tx) throw new NotFoundException('Transaction not found');
    return this.renderPaymentProofPdf(tx, requestingUserId);
  }

  async generatePaymentProofForAdmin(transactionId: string, adminId: string): Promise<Buffer> {
    const tx = await this.getPaymentProofData(transactionId, true);
    if (!tx) throw new NotFoundException('Transaction not found');
    return this.renderPaymentProofPdf(tx, adminId);
  }

  private async renderPaymentProofPdf(tx: any, generatedBy: string): Promise<Buffer> {

    const amount = Number(tx.amount);
    const amountEN = this.toWordsEN(Math.floor(amount));
    const amountAR = this.toWordsAR(Math.floor(amount));
    const docNumber = `PAY-${new Date().getFullYear()}-${tx.id.slice(0, 8).toUpperCase()}`;
    const issueDate = new Date().toLocaleDateString('en-GB');
    const issueDateAR = new Date().toLocaleDateString('ar-JO');

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>Payment Proof / إثبات دفع</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Arabic', 'Arial', sans-serif; background: #fff; color: #1a1a1a; font-size: 13px; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 20mm; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #2D6A4F; padding-bottom: 15px; margin-bottom: 25px; }
    .logo { font-size: 28px; font-weight: 900; color: #2D6A4F; }
    .logo span { color: #52B788; }
    .doc-title { text-align: center; margin-bottom: 25px; }
    .doc-title h1 { font-size: 22px; color: #2D6A4F; font-weight: 700; }
    .doc-title h2 { font-size: 18px; color: #2D6A4F; font-weight: 700; margin-top: 5px; }
    .doc-meta { display: flex; justify-content: space-between; background: #f0faf4; padding: 12px 18px; border-radius: 8px; margin-bottom: 25px; }
    .meta-item { text-align: center; }
    .meta-label { font-size: 11px; color: #666; }
    .meta-value { font-size: 13px; font-weight: 700; color: #2D6A4F; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 14px; font-weight: 700; color: #2D6A4F; border-right: 4px solid #52B788; padding-right: 10px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 12px; vertical-align: top; }
    td:first-child { color: #555; font-size: 12px; width: 40%; text-align: right; }
    td:last-child { font-weight: 600; }
    .amount-box { background: #2D6A4F; color: #fff; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .amount-number { font-size: 36px; font-weight: 900; }
    .amount-currency { font-size: 16px; opacity: 0.9; }
    .amount-words { background: #f0faf4; padding: 12px; border-radius: 8px; margin-top: 15px; }
    .amount-words p { margin: 4px 0; font-size: 13px; }
    .status-badge { display: inline-block; background: #52B788; color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .footer { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .signature-box { border-top: 1px solid #333; width: 180px; text-align: center; padding-top: 8px; font-size: 11px; color: #666; }
    .watermark { color: #e0e0e0; font-size: 11px; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo">منصة <span>فري<br/>لانس.جو</span></div>
      <div style="text-align:left; direction:ltr;">
        <div class="logo">Freelance<span>.JO</span></div>
        <div style="font-size:11px;color:#666;">Jordan Freelance Marketplace</div>
      </div>
    </div>

    <div class="doc-title">
      <h1>إثبات دفع</h1>
      <h2>Payment Proof</h2>
    </div>

    <div class="doc-meta">
      <div class="meta-item">
        <div class="meta-label">رقم المستند / Document No.</div>
        <div class="meta-value">${docNumber}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">تاريخ الإصدار / Issue Date</div>
        <div class="meta-value">${issueDate}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">الحالة / Status</div>
        <div class="meta-value"><span class="status-badge">${tx.status === 'completed' ? 'مكتمل / Completed' : tx.status}</span></div>
      </div>
    </div>

    <div class="amount-box">
      <div class="amount-number">${amount.toFixed(3)}</div>
      <div class="amount-currency">JOD — دينار أردني</div>
    </div>

    <div class="amount-words">
      <p><strong>بالأحرف (عربي):</strong> ${amountAR} دينار أردني</p>
      <p><strong>In Words (English):</strong> ${amountEN} Jordanian Dinar${amount > 1 ? 's' : ''}</p>
    </div>

    <div class="section">
      <div class="section-title">معلومات العميل / Client Information</div>
      <table>
        <tr><td>الاسم / Name</td><td>${tx.client_name || 'N/A'}</td></tr>
        <tr><td>الاسم بالعربي</td><td>${tx.client_name_ar || ''}</td></tr>
        <tr><td>البريد الإلكتروني / Email</td><td>${tx.client_email || 'N/A'}</td></tr>
      </table>
    </div>

    <div class="section">
      <div class="section-title">معلومات المستقل / Freelancer Information</div>
      <table>
        <tr><td>الاسم / Name</td><td>${tx.freelancer_name || 'N/A'}</td></tr>
        <tr><td>الاسم بالعربي</td><td>${tx.freelancer_name_ar || ''}</td></tr>
        <tr><td>البريد الإلكتروني / Email</td><td>${tx.freelancer_email || 'N/A'}</td></tr>
      </table>
    </div>

    ${tx.project_title_en || tx.project_title_ar ? `
    <div class="section">
      <div class="section-title">المشروع / Project</div>
      <table>
        <tr><td>العنوان (EN)</td><td>${tx.project_title_en || '—'}</td></tr>
        <tr><td>العنوان (AR)</td><td>${tx.project_title_ar || '—'}</td></tr>
        <tr><td>الوصف / Description</td><td>${(tx.project_description_en || '').slice(0, 300)}${(tx.project_description_en && tx.project_description_en.length > 300) ? '…' : ''}</td></tr>
      </table>
    </div>
    ` : ''}

    <div class="section">
      <div class="section-title">تفاصيل المعاملة / Transaction Details</div>
      <table>
        <tr><td>نوع المعاملة / Type</td><td>${tx.type}</td></tr>
        <tr><td>طريقة الدفع / Method</td><td>${tx.payment_method || 'Stripe'}</td></tr>
        <tr><td>رقم المعاملة / Transaction ID</td><td>${tx.id}</td></tr>
        <tr><td>Stripe Intent ID</td><td>${tx.stripe_payment_intent_id || 'N/A'}</td></tr>
        <tr><td>التاريخ / Date</td><td>${new Date(tx.created_at).toLocaleDateString('en-GB')}</td></tr>
        <tr><td>الوصف / Description</td><td>${tx.description_en || ''}</td></tr>
      </table>
    </div>

    <div class="footer">
      <div>
        <div class="signature-box">توقيع / Signature</div>
        <div class="signature-box" style="margin-top:12px;">ختم رسمي / Official Stamp</div>
      </div>
      <div style="text-align:left; direction:ltr; font-size:11px; color:#888;">
        <p>Generated by Freelance.JO Platform</p>
        <p>This document is system-generated and valid without a physical stamp.</p>
      </div>
    </div>

    <p class="watermark">هذه الوثيقة صادرة بصورة رقمية من منصة فريلانس.جو — Freelance.JO © ${new Date().getFullYear()}</p>
  </div>
</body>
</html>`;

    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // Save document record
    await this.sql`
      INSERT INTO documents (type, ref_id, ref_type, generated_by, title_en, title_ar, doc_number)
      VALUES ('payment_proof', ${tx.id}, 'transaction', ${generatedBy},
              'Payment Proof', 'إثبات دفع', ${docNumber})
      ON CONFLICT DO NOTHING
    `;

    return Buffer.from(pdfBuffer);
  }
}
