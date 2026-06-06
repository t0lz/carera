const db = require('../db');

const ALLOWED_STATUSES = ['new', 'in_work', 'calculated', 'approved', 'completed', 'cancelled'];

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function validateCalculationPayload(payload) {
  const requiredPositive = [
    ['price_rub', payload.price_rub],
    ['engine_volume', getEngineVolumeCm3(payload)],
    ['power_hp', payload.power_hp],
    ['eur_rate', payload.eur_rate],
  ];

  for (const [field, value] of requiredPositive) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
      return field;
    }
  }

  if (!Number.isFinite(Number(payload.age_years)) || Number(payload.age_years) < 0) {
    return 'age_years';
  }
  if (payload.delivery_rub != null && Number(payload.delivery_rub) < 0) {
    return 'delivery_rub';
  }
  if (!['individual', 'company'].includes(payload.customer_type)) {
    return 'customer_type';
  }
  return null;
}

function roundRub(value) {
  return Math.round(value * 100) / 100;
}

function getEngineVolumeCm3(payload) {
  const liters = toNumber(payload.engine_volume_l);
  if (liters > 0) return Math.round(liters * 1000);
  return Math.round(toNumber(payload.engine_volume_cm3));
}

function getEngineVolumeLiters(engineVolumeCm3) {
  return roundRub(toNumber(engineVolumeCm3) / 1000);
}

function parseCbrRate(xmlText, charCode) {
  const blockRegExp = new RegExp(
    `<Valute[^>]*>[\\s\\S]*?<CharCode>${charCode}</CharCode>[\\s\\S]*?</Valute>`
  );
  const block = xmlText.match(blockRegExp)?.[0];
  const value = block?.match(/<Value>(.*?)<\/Value>/)?.[1];

  if (!value) return null;

  const rate = Number(value.replace(',', '.'));
  return Number.isFinite(rate) ? rate : null;
}

function parseCbrXmlDate(xmlText) {
  const date = xmlText.match(/<ValCurs[^>]*Date="([^"]+)"/)?.[1];
  if (!date) return null;

  const [day, month, year] = date.split('.');
  if (!day || !month || !year) return null;

  return `${year}-${month}-${day}`;
}

function formatDateDot(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return formatDateDot();
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

function addDays(value, days) {
  const date = value ? new Date(value) : new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function parseCbrDynamicsRows(htmlText) {
  const rows = [];
  const rowRegExp =
    /<tr>\s*<td>(\d{2}\.\d{2}\.\d{4})<\/td>\s*<td>\d+<\/td>\s*<td>([\d,]+)<\/td>\s*<\/tr>/g;
  let match;

  while ((match = rowRegExp.exec(htmlText)) !== null) {
    const [, dateText, valueText] = match;
    const [day, month, year] = dateText.split('.');
    const rate = Number(valueText.replace(',', '.'));

    if (Number.isFinite(rate)) {
      rows.push({
        date: `${year}-${month}-${day}`,
        cbr_date: dateText,
        eur: roundRub(rate),
      });
    }
  }

  return rows;
}

function formatDateForCbr(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return formatDateForCbr();
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

async function getCbrEuroRate(dateValue) {
  const requestedDate = dateValue ? new Date(dateValue) : new Date();
  const fromDate = formatDateDot(addDays(requestedDate, -14));
  const toDate = formatDateDot(requestedDate);
  const dynamicsUrl =
    'https://www.cbr.ru/currency_base/dynamics/?' +
    `UniDbQuery.FromDate=${encodeURIComponent(fromDate)}` +
    `&UniDbQuery.ToDate=${encodeURIComponent(toDate)}` +
    '&UniDbQuery.Posted=True&UniDbQuery.VAL_NM_RQ=R01239';

  const dynamicsResponse = await fetch(dynamicsUrl);
  if (dynamicsResponse.ok) {
    const htmlText = await dynamicsResponse.text();
    const latestRate = parseCbrDynamicsRows(htmlText)[0];

    if (latestRate) {
      return latestRate;
    }
  }

  const cbrDate = formatDateForCbr(dateValue);
  const url = `https://www.cbr.ru/scripts/XML_daily.asp?date_req=${encodeURIComponent(cbrDate)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('cbr_rate_error');

  const xmlText = await response.text();
  const rate = parseCbrRate(xmlText, 'EUR');
  const actualDate = parseCbrXmlDate(xmlText);
  if (!rate) throw new Error('eur_rate_not_found');
  if (actualDate && actualDate !== cbrDate.split('/').reverse().join('-')) {
    throw new Error(`cbr_date_mismatch:${actualDate}`);
  }

  return {
    eur: roundRub(rate),
    date: cbrDate.split('/').reverse().join('-'),
    cbr_date: cbrDate,
  };
}

function getCustomsFee(priceRub) {
  if (priceRub <= 200000) return 1067;
  if (priceRub <= 450000) return 2134;
  if (priceRub <= 1200000) return 4269;
  if (priceRub <= 2700000) return 11746;
  if (priceRub <= 4200000) return 16524;
  if (priceRub <= 5500000) return 21344;
  if (priceRub <= 7000000) return 27540;
  return 30000;
}

function getExcise(powerHp) {
  if (powerHp <= 90) return 0;
  if (powerHp <= 150) return powerHp * 61;
  if (powerHp <= 200) return powerHp * 583;
  if (powerHp <= 300) return powerHp * 955;
  if (powerHp <= 400) return powerHp * 1628;
  if (powerHp <= 500) return powerHp * 1685;
  return powerHp * 1740;
}

function getUtilizationFee(ageYears, customerType) {
  const isCompany = customerType === 'company';
  const baseRate = isCompany ? 20000 : 3400;
  const coefficient = isCompany
    ? (ageYears > 3 ? 2.44 : 1.63)
    : (ageYears > 3 ? 0.26 : 0.17);

  return baseRate * coefficient;
}

function getDuty({ priceRub, engineVolumeCm3, ageYears, customerType, eurRate }) {
  if (customerType === 'company') {
    return priceRub * 0.15;
  }

  if (ageYears <= 3) {
    return Math.max(priceRub * 0.48, engineVolumeCm3 * 2.5 * eurRate);
  }

  const rate = ageYears <= 5 ? 2.7 : 3;
  return engineVolumeCm3 * rate * eurRate;
}

function calculateImportPayments(payload) {
  const priceRub = toNumber(payload.price_rub);
  const engineVolumeCm3 = getEngineVolumeCm3(payload);
  const powerHp = toNumber(payload.power_hp);
  const ageYears = toNumber(payload.age_years);
  const deliveryRub = toNumber(payload.delivery_rub);
  const eurRate = toNumber(payload.eur_rate);
  const customerType = payload.customer_type === 'company' ? 'company' : 'individual';

  const customsFee = getCustomsFee(priceRub);
  const duty = getDuty({ priceRub, engineVolumeCm3, ageYears, customerType, eurRate });
  const excise = getExcise(powerHp);
  const vatBase = priceRub + duty + excise;
  const vat = customerType === 'company' ? vatBase * 0.2 : 0;
  const utilizationFee = getUtilizationFee(ageYears, customerType);
  const paymentsTotal = customsFee + duty + excise + vat + utilizationFee;
  const total = priceRub + deliveryRub + paymentsTotal;

  return {
    price_rub: roundRub(priceRub),
    delivery_rub: roundRub(deliveryRub),
    customs_fee: roundRub(customsFee),
    duty: roundRub(duty),
    excise: roundRub(excise),
    vat: roundRub(vat),
    utilization_fee: roundRub(utilizationFee),
    payments_total: roundRub(paymentsTotal),
    total: roundRub(total),
    customer_type: customerType,
    note: 'Расчет демонстрационный и используется для предварительной оценки заказа.'
  };
}

function mapOrderRow(row) {
  return {
    import_order_id: row.import_order_id,
    user_id: row.user_id,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    car_make: row.car_make,
    car_model: row.car_model,
    price_rub: row.price_rub,
    delivery_rub: row.delivery_rub,
    engine_volume_cm3: row.engine_volume_cm3,
    engine_volume_l: getEngineVolumeLiters(row.engine_volume_cm3),
    power_hp: row.power_hp,
    age_years: row.age_years,
    eur_rate: row.eur_rate,
    customer_type: row.customer_type,
    status: row.status,
    created_at: row.created_at,
    calculation: {
      calculation_id: row.calculation_id,
      customs_fee: row.customs_fee,
      duty: row.duty,
      excise: row.excise,
      vat: row.vat,
      utilization_fee: row.utilization_fee,
      payments_total: row.payments_total,
      total: row.total,
    }
  };
}

class ImportOrderController {
  async getRates(_req, res) {
    try {
      const rate = await getCbrEuroRate(_req.query.date);
      const requestedDate = _req.query.date || new Date().toISOString().slice(0, 10);
      res.json({ ...rate, requested_date: requestedDate });
    } catch (e) {
      console.error('currency rate error:', e);
      res.status(503).json({ error: 'rate_unavailable' });
    }
  }

  async calculate(req, res) {
    try {
      const invalidField = validateCalculationPayload(req.body || {});
      if (invalidField) {
        return res.status(400).json({ error: 'invalid_field', field: invalidField });
      }
      res.json(calculateImportPayments(req.body || {}));
    } catch (e) {
      console.error('import calculate error:', e);
      res.status(500).json({ error: 'calculate_error' });
    }
  }

  async create(req, res) {
    const client = await db.connect();

    try {
      const body = req.body || {};
      const invalidField = validateCalculationPayload(body);
      if (invalidField) {
        return res.status(400).json({ error: 'invalid_field', field: invalidField });
      }
      if (!body.customer_name || !body.customer_phone || !body.make || !body.model) {
        return res.status(400).json({ error: 'customer_and_car_required' });
      }
      const calculation = calculateImportPayments(body);

      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO import_orders
          (user_id, customer_name, customer_phone, car_make, car_model, price_rub, delivery_rub,
           engine_volume_cm3, power_hp, age_years, eur_rate, customer_type, status, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'new',NOW())
         RETURNING import_order_id, status, created_at`,
        [
          req.user.user_id,
          body.customer_name || null,
          body.customer_phone || null,
          body.make || body.car_make || null,
          body.model || body.car_model || null,
          calculation.price_rub,
          calculation.delivery_rub,
          getEngineVolumeCm3(body),
          toNumber(body.power_hp),
          toNumber(body.age_years),
          toNumber(body.eur_rate),
          calculation.customer_type,
        ]
      );

      const order = orderResult.rows[0];

      const calculationResult = await client.query(
        `INSERT INTO customs_calculations
          (import_order_id, customs_fee, duty, excise, vat, utilization_fee, payments_total, total, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
         RETURNING calculation_id`,
        [
          order.import_order_id,
          calculation.customs_fee,
          calculation.duty,
          calculation.excise,
          calculation.vat,
          calculation.utilization_fee,
          calculation.payments_total,
          calculation.total,
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        import_order_id: order.import_order_id,
        order_id: `IMP-${order.import_order_id}`,
        status: order.status,
        created_at: order.created_at,
        calculation_id: calculationResult.rows[0].calculation_id,
        calculation,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('import order error:', e);
      res.status(500).json({ error: 'order_error' });
    } finally {
      client.release();
    }
  }

  async getAll(req, res) {
    try {
      const params = [];
      const where = [];

      const canManage = ['manager', 'admin'].includes(req.user.role_name);
      const requestedUserId = Number(req.query.user_id);
      if (!canManage || requestedUserId) {
        params.push(canManage ? requestedUserId : req.user.user_id);
        where.push(`o.user_id = $${params.length}`);
      }

      if (req.query.status) {
        params.push(req.query.status);
        where.push(`o.status = $${params.length}`);
      }

      const sql = `
        SELECT
          o.*,
          c.calculation_id,
          c.customs_fee,
          c.duty,
          c.excise,
          c.vat,
          c.utilization_fee,
          c.payments_total,
          c.total
        FROM import_orders o
          LEFT JOIN customs_calculations c ON c.import_order_id = o.import_order_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY o.created_at DESC, o.import_order_id DESC
        LIMIT 200
      `;

      const { rows } = await db.query(sql, params);
      res.json(rows.map(mapOrderRow));
    } catch (e) {
      console.error('get import orders error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  }

  async getOne(req, res) {
    try {
      const { rows } = await db.query(
        `SELECT
          o.*,
          c.calculation_id,
          c.customs_fee,
          c.duty,
          c.excise,
          c.vat,
          c.utilization_fee,
          c.payments_total,
          c.total
         FROM import_orders o
           LEFT JOIN customs_calculations c ON c.import_order_id = o.import_order_id
         WHERE o.import_order_id = $1`,
        [req.params.id]
      );

      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      const canManage = ['manager', 'admin'].includes(req.user.role_name);
      if (!canManage && Number(rows[0].user_id) !== Number(req.user.user_id)) {
        return res.status(403).json({ error: 'forbidden' });
      }
      res.json(mapOrderRow(rows[0]));
    } catch (e) {
      console.error('get import order error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  }

  async updateStatus(req, res) {
    try {
      const { status } = req.body || {};

      if (!ALLOWED_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'invalid_status' });
      }

      const { rows } = await db.query(
        `UPDATE import_orders
         SET status = $1
         WHERE import_order_id = $2
         RETURNING import_order_id, status`,
        [status, req.params.id]
      );

      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      res.json(rows[0]);
    } catch (e) {
      console.error('update import order status error:', e);
      res.status(500).json({ error: 'db_error' });
    }
  }
}

module.exports = new ImportOrderController();
