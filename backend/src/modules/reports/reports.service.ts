import { Injectable, Inject } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as ExcelJS from 'exceljs';
import postgres from 'postgres';
import { DB } from '../../database/database.module';

@Injectable()
export class ReportsService {
  constructor(@Inject(DB) private sql: postgres.Sql) {}

  async getPaymentReport(from: string, to: string, format: 'pdf' | 'excel'): Promise<Buffer> {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new Error('Invalid date range');
    }

    const rows = await this.sql`
      SELECT t.id, t.type, t.amount, t.status, t.payment_method, t.reference_number,
             t.created_at, t.order_id, t.milestone_id,
             cp.full_name_en AS client_name, cp.full_name_ar AS client_name_ar,
             fp.full_name_en AS freelancer_name, fp.full_name_ar AS freelancer_name_ar,
             COALESCE(pr.title_en, g.title_en) AS project_title_en
      FROM transactions t
      LEFT JOIN profiles cp ON cp.user_id = t.from_user_id
      LEFT JOIN profiles fp ON fp.user_id = t.to_user_id
      LEFT JOIN orders o ON o.id = t.order_id
      LEFT JOIN gigs g ON g.id = o.gig_id
      LEFT JOIN milestones m ON m.id = t.milestone_id
      LEFT JOIN contracts c ON c.id = m.contract_id
      LEFT JOIN projects pr ON pr.id = c.project_id
      WHERE t.type = 'deposit' AND t.status = 'completed'
        AND t.created_at >= ${fromDate.toISOString()}
        AND t.created_at <= ${new Date(toDate.getTime() + 86400000).toISOString()}
      ORDER BY t.created_at DESC
    `;

    if (format === 'excel') {
      return this.generatePaymentReportExcel(rows as any[]);
    }
    return this.generatePaymentReportPdf(rows as any[], from, to);
  }

  private async generatePaymentReportPdf(rows: any[], from: string, to: string): Promise<Buffer> {
    const tableRows = rows.map(
      (r) => `
      <tr>
        <td>${new Date(r.created_at).toLocaleDateString('en-GB')}</td>
        <td>${r.id?.slice(0, 8) ?? ''}</td>
        <td>${r.client_name ?? ''}</td>
        <td>${r.freelancer_name ?? ''}</td>
        <td>${r.project_title_en ?? '—'}</td>
        <td>${Number(r.amount).toFixed(3)}</td>
        <td>${r.payment_method ?? 'stripe'}</td>
        <td>${r.reference_number ?? '—'}</td>
      </tr>`,
    ).join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; padding: 20px; }
    h1 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background: #2D6A4F; color: #fff; }
    td:first-child, th:first-child { text-align: left; }
  </style>
</head>
<body>
  <h1>Payment Report</h1>
  <p>From ${from} to ${to} — ${rows.length} transaction(s)</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Tx ID</th>
        <th>Client</th>
        <th>Freelancer</th>
        <th>Project</th>
        <th>Amount (JOD)</th>
        <th>Method</th>
        <th>Reference</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;

    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    return Buffer.from(pdfBuffer);
  }

  private async generatePaymentReportExcel(rows: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payments', { headerFooter: { firstHeader: 'Payment Report' } });
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Transaction ID', key: 'id', width: 38 },
      { header: 'Client', key: 'client_name', width: 22 },
      { header: 'Freelancer', key: 'freelancer_name', width: 22 },
      { header: 'Project', key: 'project_title_en', width: 30 },
      { header: 'Amount (JOD)', key: 'amount', width: 14 },
      { header: 'Method', key: 'payment_method', width: 14 },
      { header: 'Reference', key: 'reference_number', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((r) => {
      sheet.addRow({
        date: new Date(r.created_at).toLocaleDateString('en-GB'),
        id: r.id,
        client_name: r.client_name ?? '',
        freelancer_name: r.freelancer_name ?? '',
        project_title_en: r.project_title_en ?? '—',
        amount: Number(r.amount),
        payment_method: r.payment_method ?? 'stripe',
        reference_number: r.reference_number ?? '—',
      });
    });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
