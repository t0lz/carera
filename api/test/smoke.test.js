const assert = require('node:assert');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';

async function getJson(path) {
  const response = await fetch(BASE_URL + path);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

async function postJson(path, body, token) {
  const response = await fetch(BASE_URL + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

(async () => {
  {
    const { response, data } = await getJson('/api/health');
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
  }

  {
    const { response, data } = await getJson('/api/make');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(data));
  }

  {
    const { response } = await postJson('/api/auth/login', {
      email: 'wrong@example.com',
      password: 'wrong-password',
    });
    assert.equal(response.status, 401);
  }

  {
    const { response } = await getJson('/api/auth/profile');
    assert.equal(response.status, 401);
  }

  {
    const { response, data } = await postJson('/api/import-order/calculate', {
      price_rub: 1500000,
      delivery_rub: 120000,
      engine_volume_l: 2,
      power_hp: 150,
      age_years: 4,
      eur_rate: 100,
      customer_type: 'individual',
    });
    assert.equal(response.status, 200);
    assert.ok(data.total > data.price_rub);
  }

  console.log('Smoke tests passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
