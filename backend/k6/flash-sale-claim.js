import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';
import { SharedArray } from 'k6/data';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '');
const CAMPAIGN_ID = __ENV.CAMPAIGN_ID || '1';
const ITEM_ID = __ENV.ITEM_ID || '1';
const CLAIM_PATH = __ENV.CLAIM_PATH || `/commerce/flash-sales/${CAMPAIGN_ID}/items/${ITEM_ID}/claim`;
const PRELOAD_PATH = __ENV.PRELOAD_PATH || `/commerce/flash-sales/${CAMPAIGN_ID}/items/${ITEM_ID}/preload`;
const PROFILE = __ENV.PROFILE || 'smoke';
const QUANTITY = Number(__ENV.QUANTITY || '1');
const SLEEP_MS = Number(__ENV.SLEEP_MS || '0');
const RUN_ID = __ENV.RUN_ID || `${Date.now()}`;
const USER_FILE = __ENV.USERS_FILE || './users.example.json';

const claimReservedRate = new Rate('flash_sale_claim_reserved_rate');
const deterministicResponseRate = new Rate('flash_sale_deterministic_response_rate');
const claimConflictRate = new Rate('flash_sale_claim_conflict_rate');
const claimRejectedRate = new Rate('flash_sale_claim_rejected_rate');
const claimReserved = new Counter('flash_sale_claim_reserved_total');
const claimRejected = new Counter('flash_sale_claim_rejected_total');
const claimDuration = new Trend('flash_sale_claim_duration', true);

http.setResponseCallback(http.expectedStatuses({ min: 200, max: 399 }, 409, 422, 429, 503));

const users = new SharedArray('flash sale users', () => {
  try {
    const parsed = JSON.parse(open(USER_FILE));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
});

export const options = buildOptions(PROFILE);

export function setup() {
  const tokens = resolveTokens();
  if (__ENV.PRELOAD === 'true') {
    preloadStock();
  }
  if (tokens.length === 0) {
    throw new Error('No customer token available. Set ACCESS_TOKEN, TOKENS, or USERS_FILE with tokens/login credentials.');
  }
  return { tokens };
}

export default function (data) {
  const token = pickToken(data.tokens);
  const requestId = `${RUN_ID}-${exec.vu.idInTest}-${exec.scenario.iterationInTest}-${randomSuffix()}`;
  const payload = JSON.stringify({
    requestId,
    quantity: QUANTITY,
  });

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  group('flash sale claim', () => {
    const started = Date.now();
    const response = http.post(`${BASE_URL}${CLAIM_PATH}`, payload, {
      headers,
      tags: {
        type: 'flash-sale-claim',
        profile: PROFILE,
      },
      timeout: __ENV.REQUEST_TIMEOUT || '5s',
    });
    claimDuration.add(Date.now() - started);

    const reserved = response.status === 200 && hasReservationToken(response);
    const deterministic = [200, 409, 422, 429, 503].includes(response.status);
    const conflict = response.status === 409;
    const rejected = response.status !== 200;

    claimReservedRate.add(reserved);
    deterministicResponseRate.add(deterministic);
    claimConflictRate.add(conflict);
    claimRejectedRate.add(rejected);
    if (reserved) {
      claimReserved.add(1);
    }
    if (rejected) {
      claimRejected.add(1);
    }

    check(response, {
      'claim returns deterministic status': () => deterministic,
      'reserved response has reservationToken': () => response.status !== 200 || reserved,
      'no unexpected server error': () => response.status !== 500,
    });
  });

  if (SLEEP_MS > 0) {
    sleep(SLEEP_MS / 1000);
  }
}

export function handleSummary(data) {
  const summaryPath = __ENV.SUMMARY_PATH || `flash-sale-${PROFILE}-${RUN_ID}.json`;
  return {
    stdout: textSummary(data),
    [summaryPath]: JSON.stringify(data, null, 2),
  };
}

function buildOptions(profile) {
  const thresholds = {
    'http_req_duration{type:flash-sale-claim}': ['p(95)<250', 'p(99)<750'],
    'http_req_failed{type:flash-sale-claim}': ['rate<0.02'],
    flash_sale_claim_duration: ['p(95)<250', 'p(99)<750'],
    flash_sale_deterministic_response_rate: ['rate>0.99'],
  };

  if (profile === 'local') {
    return {
      scenarios: {
        flash_sale_local: {
          executor: 'ramping-vus',
          gracefulRampDown: '20s',
          stages: [
            { duration: '30s', target: 50 },
            { duration: '1m', target: 200 },
            { duration: '30s', target: 0 },
          ],
        },
      },
      thresholds,
    };
  }

  if (profile === 'flash-1k') {
    return rampingProfile(1000, thresholds);
  }

  if (profile === 'flash-5k') {
    return rampingProfile(5000, thresholds);
  }

  if (profile === 'flash-10k') {
    return rampingProfile(10000, thresholds);
  }

  return {
    scenarios: {
      flash_sale_smoke: {
        executor: 'constant-vus',
        vus: Number(__ENV.VUS || '1'),
        duration: __ENV.DURATION || '30s',
      },
    },
    thresholds,
  };
}

function rampingProfile(targetVus, thresholds) {
  return {
    scenarios: {
      flash_sale_claim: {
        executor: 'ramping-vus',
        gracefulRampDown: '1m',
        stages: [
          { duration: __ENV.RAMP_UP || '2m', target: targetVus },
          { duration: __ENV.HOLD || '5m', target: targetVus },
          { duration: __ENV.RAMP_DOWN || '2m', target: 0 },
        ],
      },
    },
    thresholds,
  };
}

function resolveTokens() {
  const directTokens = splitCsv(__ENV.TOKENS);
  if (directTokens.length > 0) {
    return directTokens;
  }

  if (__ENV.ACCESS_TOKEN) {
    return [__ENV.ACCESS_TOKEN];
  }

  const fileTokens = users
    .map((user) => user.token || user.accessToken)
    .filter((token) => typeof token === 'string' && token.trim().length > 0);
  if (fileTokens.length > 0) {
    return fileTokens;
  }

  if (__ENV.LOGIN_USERS === 'true') {
    return users
      .map((user) => login(user.email, user.password))
      .filter((token) => token !== null);
  }

  if (__ENV.LOGIN_EMAIL && __ENV.LOGIN_PASSWORD) {
    const token = login(__ENV.LOGIN_EMAIL, __ENV.LOGIN_PASSWORD);
    return token ? [token] : [];
  }

  return [];
}

function preloadStock() {
  const adminToken = __ENV.ADMIN_TOKEN || login(__ENV.ADMIN_EMAIL, __ENV.ADMIN_PASSWORD);
  if (!adminToken) {
    throw new Error('PRELOAD=true requires ADMIN_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD.');
  }
  const response = http.post(
    `${BASE_URL}${PRELOAD_PATH}`,
    JSON.stringify({
      stock: Number(__ENV.PRELOAD_STOCK || '1000'),
      perUserLimit: Number(__ENV.PRELOAD_PER_USER_LIMIT || '1'),
    }),
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      tags: { type: 'flash-sale-preload', profile: PROFILE },
      timeout: __ENV.REQUEST_TIMEOUT || '5s',
    },
  );
  check(response, {
    'preload succeeded': (res) => res.status === 200,
  });
  if (response.status !== 200) {
    throw new Error(`Flash sale preload failed with status ${response.status}: ${response.body}`);
  }
}

function login(email, password) {
  if (!email || !password) {
    return null;
  }
  const response = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password, rememberMe: false }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { type: 'auth-login', profile: PROFILE },
      timeout: __ENV.REQUEST_TIMEOUT || '5s',
    },
  );
  if (response.status !== 200) {
    return null;
  }
  try {
    return response.json('accessToken');
  } catch (_) {
    return null;
  }
}

function pickToken(tokens) {
  const index = (exec.vu.idInTest - 1) % tokens.length;
  return tokens[index];
}

function hasReservationToken(response) {
  try {
    const token = response.json('reservationToken');
    return typeof token === 'string' && token.length > 0;
  } catch (_) {
    return false;
  }
}

function splitCsv(value) {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

function textSummary(data) {
  const metrics = data.metrics;
  const reserved = metricValue(metrics, 'flash_sale_claim_reserved_total', 'count') || 0;
  const rejected = metricValue(metrics, 'flash_sale_claim_rejected_total', 'count') || 0;
  const p95 = metricValue(metrics, 'flash_sale_claim_duration', 'p(95)');
  const p99 = metricValue(metrics, 'flash_sale_claim_duration', 'p(99)');
  return [
    '',
    'Flash sale K6 summary',
    `profile=${PROFILE}`,
    `reserved=${reserved}`,
    `rejected=${rejected}`,
    `claim_p95_ms=${formatNumber(p95)}`,
    `claim_p99_ms=${formatNumber(p99)}`,
    '',
  ].join('\n');
}

function formatNumber(value) {
  return typeof value === 'number' ? value.toFixed(2) : 'n/a';
}

function metricValue(metrics, metricName, valueName) {
  if (!metrics[metricName] || !metrics[metricName].values) {
    return null;
  }
  return metrics[metricName].values[valueName];
}
