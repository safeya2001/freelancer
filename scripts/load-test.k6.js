/**
 * k6 Load Test — Dopa Work Platform
 *
 * Scenarios:
 *  1. Ramp up to 1000 concurrent users logging in
 *  2. Browse gigs listing under load
 *  3. Concurrent API calls to /payments/my-pending (authenticated)
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 * Run:
 *   k6 run scripts/load-test.k6.js \
 *     -e BASE_URL=http://localhost:3001 \
 *     -e TEST_TOKEN=<your-jwt-token>
 *
 * Thresholds (what "pass" means):
 *   - 95% of requests complete in < 500ms
 *   - Error rate < 1%
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ─── ENVIRONMENT ─────────────────────────────────────────────────────────────

const BASE_URL   = __ENV.BASE_URL   || 'http://localhost:3001';
const TEST_TOKEN = __ENV.TEST_TOKEN || '';

// ─── CUSTOM METRICS ──────────────────────────────────────────────────────────

const errorRate      = new Rate('errors');
const loginDuration  = new Trend('login_duration',  true);
const gigsDuration   = new Trend('gigs_duration',   true);

// ─── OPTIONS (load profile) ──────────────────────────────────────────────────

export const options = {
  scenarios: {
    // Scenario 1: Ramp to 1000 concurrent users over 2 minutes
    mass_login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100  },  // warm up
        { duration: '60s', target: 1000 },  // peak load
        { duration: '30s', target: 0    },  // cool down
      ],
      exec: 'loginScenario',
      tags: { scenario: 'mass_login' },
    },

    // Scenario 2: Constant 200 users browsing gigs
    browse_gigs: {
      executor: 'constant-vus',
      vus: 200,
      duration: '2m',
      exec: 'browseGigsScenario',
      tags: { scenario: 'browse_gigs' },
    },

    // Scenario 3: 50 authenticated users polling my-pending payments
    poll_payments: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'pollPaymentsScenario',
      tags: { scenario: 'poll_payments' },
    },
  },

  thresholds: {
    // 95th percentile response time under 500ms
    http_req_duration: ['p(95)<500'],

    // Error rate below 1%
    errors: ['rate<0.01'],

    // Login specifically should be < 1s at p95
    login_duration: ['p(95)<1000'],
  },
};

// ─── SCENARIO 1: MASS LOGIN ──────────────────────────────────────────────────

export function loginScenario() {
  const uniqueId = Math.random().toString(36).slice(2, 10);

  const payload = JSON.stringify({
    email:    `loadtest_${uniqueId}@example.com`,
    password: 'WrongPass999',  // Intentionally wrong — tests auth endpoint under load
  });

  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags:    { endpoint: 'login' },
  };

  const start = Date.now();
  const res   = http.post(`${BASE_URL}/api/v1/auth/login`, payload, params);
  loginDuration.add(Date.now() - start);

  // We expect 401 (wrong creds) — the important thing is the server responds correctly
  const success = check(res, {
    'login responds (200 or 401)': (r) => r.status === 200 || r.status === 401,
    'login < 1s':                  (r) => r.timings.duration < 1_000,
    'no 500 errors':               (r) => r.status !== 500,
  });

  errorRate.add(!success);
  sleep(1); // Think time between requests
}

// ─── SCENARIO 2: BROWSE GIGS ─────────────────────────────────────────────────

export function browseGigsScenario() {
  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags:    { endpoint: 'gigs' },
  };

  const start = Date.now();

  // List all gigs
  const listRes = http.get(`${BASE_URL}/api/v1/gigs`, params);
  gigsDuration.add(Date.now() - start);

  const success = check(listRes, {
    'gigs list 200':   (r) => r.status === 200,
    'gigs list < 2s':  (r) => r.timings.duration < 2_000,
    'has data array':  (r) => {
      try {
        const body = JSON.parse(r.body as string);
        return Array.isArray(body.data) || typeof body.data === 'object';
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);

  // Simulate browsing: search with a keyword
  const searchRes = http.get(`${BASE_URL}/api/v1/gigs?q=design&page=1`, params);
  check(searchRes, {
    'search responds': (r) => r.status === 200,
  });

  sleep(2);
}

// ─── SCENARIO 3: POLL AUTHENTICATED ENDPOINT ─────────────────────────────────

export function pollPaymentsScenario() {
  if (!TEST_TOKEN) {
    // Skip if no token provided
    sleep(5);
    return;
  }

  const params = {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${TEST_TOKEN}`,
    },
    tags: { endpoint: 'my_pending' },
  };

  const res = http.get(`${BASE_URL}/api/v1/payments/my-pending`, params);

  const success = check(res, {
    'my-pending 200': (r) => r.status === 200,
    'my-pending < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!success);
  sleep(3);
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

export function handleSummary(data: any) {
  const passed   = data.metrics.errors?.values?.rate < 0.01;
  const p95login = data.metrics.login_duration?.values?.['p(95)'];
  const p95gigs  = data.metrics.gigs_duration?.values?.['p(95)'];

  console.log('\n========== LOAD TEST SUMMARY ==========');
  console.log(`Overall error rate:      ${(data.metrics.errors?.values?.rate * 100).toFixed(2)}%`);
  console.log(`Login p95 response time: ${p95login?.toFixed(0)}ms`);
  console.log(`Gigs p95 response time:  ${p95gigs?.toFixed(0)}ms`);
  console.log(`Result:                  ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log('=======================================\n');

  return {
    'stdout':                 JSON.stringify(data, null, 2),
    './load-test-report.json': JSON.stringify(data),
  };
}
