const db = require('../db');

const AD_STATUSES = {
  pending: 'На модерации',
  approved: 'Опубликовано',
  rejected: 'Отклонено',
};

function canManageAds(user) {
  return user && ['manager', 'admin'].includes(user.role_name);
}

class AdController {
  async create(req, res) {
    try {
      const { vehicle_id, title, description, price } = req.body || {};
      const seller_id = req.user.user_id;

      if (!vehicle_id || !title || !Number.isFinite(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({ error: 'invalid_ad_data' });
      }

      const { rows } = await db.query(
        `INSERT INTO ads
          (seller_id, vehicle_id, title, description, price, status, rejection_reason, published_at)
         VALUES ($1, $2, $3, $4, $5, 'pending', NULL, NULL)
         RETURNING ad_id, status`,
        [seller_id, vehicle_id, title, description || null, Number(price)]
      );

      res.status(201).json(rows[0]);
    } catch (e) {
      console.error('create ad error:', e);

      res.status(500).json({
        error: 'db_error',
        details: e.message,
        code: e.code,
      });
    }
  }

  async getAll(req, res) {
    try {
      const {
        make_id,
        model_id,
        body_type_id,
        year_from,
        year_to,
        price_from,
        price_to,
        min_price,
        max_price,
        seller_id,
        moderation,
      } = req.query;

      const where = [];
      const params = [];
      let i = 1;
      const managerMode = moderation === '1' && canManageAds(req.user);

      if (!managerMode) {
        if (seller_id && req.user && Number(seller_id) === Number(req.user.user_id)) {
          where.push(`a.seller_id = $${i++}`);
          params.push(Number(seller_id));
        } else {
          where.push(`a.status = 'approved'`);
        }
      } else if (seller_id) {
        where.push(`a.seller_id = $${i++}`);
        params.push(Number(seller_id));
      }

      if (make_id) {
        where.push(`v.car_make_id = $${i++}`);
        params.push(Number(make_id));
      }

      if (model_id) {
        where.push(`v.car_model_id = $${i++}`);
        params.push(Number(model_id));
      }

      if (body_type_id) {
        where.push(`v.body_type_id = $${i++}`);
        params.push(Number(body_type_id));
      }

      if (year_from) {
        where.push(`v.year >= $${i++}`);
        params.push(Number(year_from));
      }

      if (year_to) {
        where.push(`v.year <= $${i++}`);
        params.push(Number(year_to));
      }

      const pFrom = price_from ?? min_price;
      const pTo = price_to ?? max_price;

      if (pFrom) {
        where.push(`a.price >= $${i++}`);
        params.push(Number(pFrom));
      }

      if (pTo) {
        where.push(`a.price <= $${i++}`);
        params.push(Number(pTo));
      }

      let sql = `
        SELECT
          a.ad_id,
          a.title,
          a.description,
          a.price,
          a.vehicle_id,
          a.seller_id,
          a.published_at,
          a.updated_at,
          COALESCE(a.status, 'pending') AS status,
          a.rejection_reason,
          u.email AS seller_email,
          u.firstname AS seller_firstname,
          u.lastname AS seller_lastname,
          photo.url AS photo_url,
          v.year,
          v.mileage_km,
          v.car_make_id,
          v.car_model_id,
          v.body_type_id,
          cm.name AS car_make,
          mdl.name AS car_model,
          bt.name AS body_type
        FROM ads a
          JOIN vehicles v ON a.vehicle_id = v.vehicle_id
          JOIN car_makes cm ON v.car_make_id = cm.car_make_id
          JOIN car_models mdl ON v.car_model_id = mdl.car_model_id
          JOIN body_types bt ON v.body_type_id = bt.body_type_id
          LEFT JOIN users u ON a.seller_id = u.user_id
          LEFT JOIN LATERAL (
            SELECT p.url
            FROM ad_photos p
            WHERE p.ad_id = a.ad_id
            ORDER BY p.ad_photo_id
            LIMIT 1
          ) photo ON TRUE
      `;

      if (where.length) sql += ' WHERE ' + where.join(' AND ');

      sql += `
        ORDER BY
          CASE COALESCE(a.status, 'pending')
            WHEN 'pending' THEN 0
            WHEN 'rejected' THEN 1
            ELSE 2
          END,
          a.updated_at DESC NULLS LAST,
          a.published_at DESC NULLS LAST,
          a.ad_id DESC
        LIMIT 200
      `;

      const { rows } = await db.query(sql, params);

      res.json(rows.map((row) => ({
        ...row,
        status_label: AD_STATUSES[row.status] || row.status,
      })));
    } catch (e) {
      console.error('getAll ads error:', e);

      res.status(500).json({
        error: 'db_error',
        details: e.message,
        code: e.code,
      });
    }
  }

  async getOne(req, res) {
    try {
      const { rows } = await db.query(
        `
        SELECT
          a.ad_id,
          a.title,
          a.description,
          a.price,
          a.vehicle_id,
          a.seller_id,
          a.published_at,
          a.updated_at,
          COALESCE(a.status, 'pending') AS status,
          a.rejection_reason,
          v.car_make_id,
          v.car_model_id,
          v.body_type_id,
          v.year,
          v.mileage_km,
          v.color,
          v.transmission,
          v.fuel_type,
          v.drive_type,
          v.engine_volume_l,
          v.power_hp,
          v.torque_nm,
          cm.name AS car_make,
          mdl.name AS car_model,
          bt.name AS body_type,
          u.firstname AS seller_firstname,
          u.lastname AS seller_lastname,
          u.phone AS seller_phone,
          u.email AS seller_email
        FROM ads a
          JOIN vehicles v ON a.vehicle_id = v.vehicle_id
          JOIN car_makes cm ON v.car_make_id = cm.car_make_id
          JOIN car_models mdl ON v.car_model_id = mdl.car_model_id
          JOIN body_types bt ON v.body_type_id = bt.body_type_id
          LEFT JOIN users u ON a.seller_id = u.user_id
        WHERE a.ad_id = $1
        `,
        [req.params.id]
      );

      if (!rows.length) return res.status(404).json({ error: 'not_found' });

      const ad = rows[0];
      const isOwner = req.user && Number(ad.seller_id) === Number(req.user.user_id);

      if (ad.status !== 'approved' && !isOwner && !canManageAds(req.user)) {
        return res.status(403).json({ error: 'ad_not_published' });
      }

      res.json({
        ...ad,
        status_label: AD_STATUSES[ad.status] || ad.status,
      });
    } catch (e) {
      console.error('getOne ad error:', e);

      res.status(500).json({
        error: 'db_error',
        details: e.message,
        code: e.code,
      });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, description, price } = req.body || {};

      const access = await db.query(
        'SELECT seller_id FROM ads WHERE ad_id = $1',
        [id]
      );

      if (!access.rows.length) return res.status(404).json({ error: 'not_found' });

      const isOwner = Number(access.rows[0].seller_id) === Number(req.user.user_id);

      if (!isOwner && req.user.role_name !== 'admin') {
        return res.status(403).json({ error: 'forbidden' });
      }

      if (price != null && (!Number.isFinite(Number(price)) || Number(price) <= 0)) {
        return res.status(400).json({ error: 'invalid_price' });
      }

      const nextStatusSql = isOwner
        ? ", status = 'pending', rejection_reason = NULL, published_at = NULL"
        : '';

      const { rows } = await db.query(
        `UPDATE ads SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          price = COALESCE($3, price),
          updated_at = NOW()
          ${nextStatusSql}
         WHERE ad_id = $4
         RETURNING ad_id, status`,
        [title || null, description || null, price, id]
      );

      if (!rows.length) return res.status(404).json({ error: 'not_found' });

      res.json(rows[0]);
    } catch (e) {
      console.error('update ad error:', e);

      res.status(500).json({
        error: 'db_error',
        details: e.message,
        code: e.code,
      });
    }
  }

  async moderate(req, res) {
  try {
    const { id } = req.params;
    const { action, rejection_reason } = req.body || {};

    if (!['publish', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'invalid_action' });
    }

    if (action === 'reject' && !String(rejection_reason || '').trim()) {
      return res.status(400).json({ error: 'rejection_reason_required' });
    }

    const status = action === 'publish' ? 'approved' : 'rejected';
    const reason = action === 'reject' ? String(rejection_reason).trim() : null;

    const { rows } = await db.query(
      `UPDATE ads SET
        status = $1::varchar,
        rejection_reason = $2::text,
        published_at = CASE 
          WHEN $1::varchar = 'approved' THEN NOW() 
          ELSE NULL 
        END,
        updated_at = NOW()
       WHERE ad_id = $3::int
       RETURNING ad_id, status, rejection_reason, published_at, updated_at`,
      [status, reason, Number(id)]
    );

    if (!rows.length) return res.status(404).json({ error: 'not_found' });

    res.json({
      ...rows[0],
      status_label: AD_STATUSES[rows[0].status] || rows[0].status,
    });
  } catch (e) {
    console.error('moderate ad error:', e);

    res.status(500).json({
      error: 'db_error',
      details: e.message,
      code: e.code,
    });
    }
  }

  async remove(req, res) {
    let client;

    try {
      client = await db.connect();
      await client.query('BEGIN');

      const { rows } = await client.query(
        `SELECT ad_id, seller_id, vehicle_id
         FROM ads
         WHERE ad_id = $1
           AND (seller_id = $2 OR $3 IN ('admin', 'manager'))
         FOR UPDATE`,
        [req.params.id, req.user.user_id, req.user.role_name]
      );

      if (!rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'not_found' });
      }

      const ad = rows[0];

      await client.query('DELETE FROM ad_photos WHERE ad_id = $1', [ad.ad_id]);

      const deleteResult = await client.query(
        'DELETE FROM ads WHERE ad_id = $1 RETURNING ad_id',
        [ad.ad_id]
      );

      if (!deleteResult.rows.length) {
        throw new Error('ad_delete_failed');
      }

      await client.query('COMMIT');

      res.json({ ok: true });
    } catch (e) {
      if (client) await client.query('ROLLBACK').catch(() => {});

      console.error('delete ad error:', e);

      res.status(500).json({
        error: 'db_error',
        details: e.message,
        code: e.code,
      });
    } finally {
      if (client) client.release();
    }
  }
}

module.exports = new AdController();