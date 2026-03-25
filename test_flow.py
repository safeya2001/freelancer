import urllib.request, json, subprocess

BASE = 'http://localhost:3001/api/v1'
PASS = 'Test@12345'

def req(method, path, data=None, token=None):
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        res = urllib.request.urlopen(r)
        return json.loads(res.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

def db(sql):
    r = subprocess.run(
        ['docker', 'exec', 'freelance_postgres', 'psql', '-U', 'freelance', '-d', 'freelance_db', '-c', sql],
        capture_output=True, text=True
    )
    return r.stdout.strip()

def ok(label, r, key='id'):
    s = r.get('success', False)
    d = r.get('data') or {}
    symbol = '\u2713' if s else '\u2717'
    val = (d.get(key) if isinstance(d, dict) else str(d)[:60]) if s else r.get('message', '?')
    print(f'  {symbol} {label}: {val}')
    return d if s else None

print('\n' + '='*60)
print('  DOPA WORK - FULL FLOW TEST')
print('='*60)

# SETUP
print('\n[SETUP] Preparing test users...')
db("UPDATE users SET status='active', email_verified=true WHERE email IN ('client_test@dopawork.com','freelancer_test@dopawork.com')")
db("UPDATE users SET phone_verified=true WHERE email='freelancer_test@dopawork.com'")
db("UPDATE users SET role='super_admin' WHERE email='client_test@dopawork.com'")
db("UPDATE withdrawals SET status='rejected' WHERE status='pending' AND freelancer_id=(SELECT id FROM users WHERE email='freelancer_test@dopawork.com')")
print('  done')

# LOGIN
print('\n[1] LOGIN')
ct = req('POST', '/auth/login', {'email': 'client_test@dopawork.com', 'password': PASS})['data']['access_token']
ft = req('POST', '/auth/login', {'email': 'freelancer_test@dopawork.com', 'password': PASS})['data']['access_token']
print(f'  \u2713 Client (super_admin) token: {ct[:35]}...')
print(f'  \u2713 Freelancer token: {ft[:35]}...')

# PROJECT
print('\n[2] CREATE PROJECT (Client)')
r = req('POST', '/projects', {
    'title_en': 'Build a Next.js E-Commerce Site',
    'title_ar': 'bnaaa mwq8',
    'description_en': 'Need a full e-commerce site with product listing, cart, and checkout using Next.js and PostgreSQL.',
    'budget_type': 'fixed', 'budget_min': 300, 'budget_max': 600
}, ct)
proj = ok('Create project', r)
pid = proj['id'] if proj else None

# PROPOSAL
print('\n[3] SUBMIT PROPOSAL (Freelancer)')
r = req('POST', '/proposals', {
    'project_id': pid,
    'cover_letter_en': 'I have 6 years experience with Next.js. Built 3 similar e-commerce sites. Can deliver in 25 days.',
    'proposed_budget': 450, 'delivery_days': 25
}, ft)
prop = ok('Submit proposal', r)
propid = prop['id'] if prop else None

# ACCEPT
print('\n[4] ACCEPT PROPOSAL + CREATE CONTRACT (Client)')
r = req('PATCH', f'/proposals/{propid}/accept', {}, ct)
ok('Accept proposal', r, 'proposal')
cid = (r.get('data') or {}).get('contract', {}).get('id')
print(f'  -> Contract ID: {cid}')

# MILESTONE
print('\n[5] ADD MILESTONE (Client)')
r = req('POST', f'/contracts/{cid}/milestones', {
    'title_en': 'Phase 1 - Product Listing and Cart',
    'description_en': 'Build product listing page, product detail, and shopping cart.',
    'amount': 225, 'due_date': '2026-04-20'
}, ct)
ms = ok('Add milestone', r)
mid = ms['id'] if ms else None

# LOCAL PAYMENT
print('\n[6] INITIATE LOCAL PAYMENT via CliQ (Client)')
r = req('POST', '/payments/initiate-local', {'milestone_id': mid, 'payment_method': 'cliq'}, ct)
ok('Initiate CliQ payment', r, 'transaction_id')
txn_id = (r.get('data') or {}).get('transaction_id')
if r.get('success'):
    instr = json.loads(r['data']['payment_instructions'])
    print(f'     Alias: {instr["details"]["cliq_alias"]}')
    print(f'     Ref:   {r["data"]["reference_number"]}')
    print(f'     EN:    {instr["instructions_en"]}')

# ADMIN CONFIRM PAYMENT
print('\n[7] ADMIN CONFIRM PAYMENT')
r = req('PATCH', f'/admin/transactions/{txn_id}/confirm', {}, ct)
ok('Confirm payment -> escrow funded', r, 'message')

# MILESTONE FLOW
print('\n[8] MILESTONE FLOW (Freelancer submits -> Client approves)')
db(f"UPDATE milestones SET status='in_progress' WHERE id='{mid}'")
r = req('POST', f'/milestones/{mid}/submit', {'delivery_note_en': 'Phase 1 complete. All features implemented and tested.'}, ft)
ok('Freelancer submit', r, 'status')
r = req('PATCH', f'/milestones/{mid}/approve', {}, ct)
ok('Client approve', r, 'status')

# WALLET
print('\n[9] FREELANCER WALLET AFTER APPROVAL')
r = req('GET', '/wallets/me', None, ft)
d = r['data']
print(f'  balance:         {d["balance"]} JOD')
print(f'  pending_balance: {d["pending_balance"]} JOD')
print(f'  total_earned:    {d["total_earned"]} JOD')

# WITHDRAWAL
print('\n[10] REQUEST WITHDRAWAL (Freelancer)')
bal = float(d['balance'])
if bal > 0:
    r = req('POST', '/withdrawals', {
        'amount': min(100, bal), 'method': 'cliq',
        'cliq_alias': 'freelancer@test.jo', 'notes': 'First payout'
    }, ft)
    wd = ok('Request withdrawal', r)
    wid = wd['id'] if wd else None
    if wid:
        print('\n[11] ADMIN PROCESS WITHDRAWAL')
        r2 = req('PATCH', f'/withdrawals/admin/{wid}/process', {
            'reference_number': 'CLIQ-TEST-001', 'notes': 'Sent via CliQ'
        }, ct)
        ok('Process withdrawal', r2, 'message')
else:
    print(f'  ! balance={bal} JOD (pending={d["pending_balance"]}) - funds held in escrow until contract completion')

# REVIEWS
print('\n[12] REVIEWS')
r = req('POST', f'/reviews/contract/{cid}', {
    'rating': 5, 'comment_en': 'Excellent work, very professional and on time!'
}, ct)
ok('Client leaves review for freelancer', r)
r = req('POST', f'/reviews/contract/{cid}', {
    'rating': 5, 'comment_en': 'Great client, clear instructions and quick responses!'
}, ft)
ok('Freelancer leaves review for client', r)

# ADMIN STATS
print('\n[13] ADMIN DASHBOARD')
r = req('GET', '/admin/stats', None, ct)
ok('Admin stats', r, 'total_users')
r = req('GET', '/admin/transactions?limit=5', None, ct)
ok('Admin transactions', r, 'total')
r = req('GET', '/admin/contracts', None, ct)
ok('Admin contracts list', r, 'total')
try:
    pdf_req = urllib.request.Request(BASE + '/admin/reports/payments?from=2026-01-01&to=2026-12-31&format=pdf',
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {ct}'}, method='GET')
    pdf_res = urllib.request.urlopen(pdf_req)
    pdf_data = pdf_res.read()
    print(f'  + Payment report PDF: {len(pdf_data)} bytes ({pdf_res.headers.get("Content-Type","")})')
except urllib.error.HTTPError as e:
    err = json.loads(e.read())
    print(f'  - Payment report PDF: {err.get("message","?")}')

# CONTENT CMS
print('\n[14] CONTENT (CMS) - PUBLIC')
r = req('GET', '/content/faq')
ok('Public FAQ', r, 'data')
r = req('GET', '/content/pages/terms_en')
ok('Terms page', r, 'page_key')
r = req('GET', '/content/banners')
ok('Banners', r, 'data')

# BROADCAST NOTIFICATION
print('\n[15] ADMIN BROADCAST NOTIFICATION')
r = req('POST', '/admin/notifications/broadcast', {
    'title_en': 'Platform Update', 'title_ar': 'تحديث المنصة',
    'body_en': 'We have launched new features!', 'body_ar': 'اطلقنا ميزات جديدة!',
    'target': 'all'
}, ct)
ok('Broadcast notification', r, 'message')

print('\n' + '='*60)
print('  ALL TESTS COMPLETE')
print('='*60 + '\n')
