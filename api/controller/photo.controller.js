const fs = require('fs');
const path = require('path');
const db = require('../db');

function getLocalFilePathByUrl(url) {
  if (!url || !url.startsWith('/uploads/cars/')) return null;

  const filename = path.basename(url);

  return path.join(__dirname, '..', '..', 'public', 'uploads', 'cars', filename);
}

function safeUnlink(filePath) {
  if (!filePath) return;

  fs.unlink(filePath, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.warn('Не удалось удалить файл фото:', filePath, err.message);
    }
  });
}

class PhotoController {
  async canEditAd(adId, user) {
    const { rows } = await db.query(
      'SELECT seller_id FROM ads WHERE ad_id = $1',
      [adId]
    );

    return rows.length && (
      Number(rows[0].seller_id) === Number(user.user_id) ||
      user.role_name === 'admin'
    );
  }

  async listByAd(req, res) {
    try {
      const adId = Number(req.query.ad_id);

      if (!adId) {
        return res.status(400).json({ error: 'ad_id_required' });
      }

      const { rows } = await db.query(
        `
        SELECT
          ad_photo_id AS photo_id,
          ad_photo_id,
          ad_id,
          url
        FROM ad_photos
        WHERE ad_id = $1
        ORDER BY ad_photo_id
        `,
        [adId]
      );

      res.json(rows);
    } catch (err) {
      console.error('photo listByAd error:', err);

      res.status(500).json({
        error: 'db_error',
        details: err.message,
      });
    }
  }

  async create(req, res) {
    try {
      const { ad_id, url } = req.body;

      if (!ad_id || !url) {
        return res.status(400).json({ error: 'ad_id_and_url_required' });
      }

      const isExternalUrl = /^https?:\/\//i.test(url);
      const isLocalUploadUrl = String(url).startsWith('/uploads/cars/');

      if (!isExternalUrl && !isLocalUploadUrl) {
        return res.status(400).json({ error: 'invalid_photo_url' });
      }

      if (!(await this.canEditAd(ad_id, req.user))) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const { rows } = await db.query(
        `
        INSERT INTO ad_photos (ad_id, url)
        VALUES ($1, $2)
        RETURNING ad_photo_id AS photo_id, ad_photo_id, ad_id, url
        `,
        [ad_id, url]
      );

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('photo create error:', err);

      res.status(500).json({
        error: 'db_error',
        details: err.message,
      });
    }
  }

  async uploadPhotos(req, res) {
    try {
      const adId = Number(req.body.ad_id);

      if (!adId) {
        return res.status(400).json({ error: 'ad_id_required' });
      }

      if (!req.files || !req.files.length) {
        return res.status(400).json({ error: 'files_required' });
      }

      if (!(await this.canEditAd(adId, req.user))) {
        req.files.forEach((file) => safeUnlink(file.path));
        return res.status(403).json({ error: 'forbidden' });
      }

      const values = [];
      const params = [];

      req.files.forEach((file, index) => {
        const url = `/uploads/cars/${file.filename}`;

        params.push(adId, url);
        values.push(`($${index * 2 + 1}, $${index * 2 + 2})`);
      });

      const { rows } = await db.query(
        `
        INSERT INTO ad_photos (ad_id, url)
        VALUES ${values.join(', ')}
        RETURNING ad_photo_id AS photo_id, ad_photo_id, ad_id, url
        `,
        params
      );

      res.status(201).json(rows);
    } catch (err) {
      console.error('photo uploadPhotos error:', err);

      if (req.files && req.files.length) {
        req.files.forEach((file) => safeUnlink(file.path));
      }

      res.status(500).json({
        error: 'upload_error',
        details: err.message,
      });
    }
  }

  async remove(req, res) {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({ error: 'id_required' });
      }

      const photo = await db.query(
        'SELECT ad_id, url FROM ad_photos WHERE ad_photo_id = $1',
        [id]
      );

      if (!photo.rows.length) {
        return res.status(404).json({ error: 'not_found' });
      }

      if (!(await this.canEditAd(photo.rows[0].ad_id, req.user))) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const { rowCount } = await db.query(
        'DELETE FROM ad_photos WHERE ad_photo_id = $1',
        [id]
      );

      if (!rowCount) {
        return res.status(404).json({ error: 'not_found' });
      }

      safeUnlink(getLocalFilePathByUrl(photo.rows[0].url));

      res.json({ ok: true });
    } catch (err) {
      console.error('photo remove error:', err);

      res.status(500).json({
        error: 'db_error',
        details: err.message,
      });
    }
  }

  async removeByAd(req, res) {
    try {
      const adId = Number(req.params.adId);

      if (!adId) {
        return res.status(400).json({ error: 'ad_id_required' });
      }

      if (!(await this.canEditAd(adId, req.user))) {
        return res.status(403).json({ error: 'forbidden' });
      }

      const oldPhotos = await db.query(
        'SELECT url FROM ad_photos WHERE ad_id = $1',
        [adId]
      );

      const { rowCount } = await db.query(
        'DELETE FROM ad_photos WHERE ad_id = $1',
        [adId]
      );

      oldPhotos.rows.forEach((photo) => {
        safeUnlink(getLocalFilePathByUrl(photo.url));
      });

      res.json({ deleted: rowCount });
    } catch (err) {
      console.error('photo removeByAd error:', err);

      res.status(500).json({
        error: 'db_error',
        details: err.message,
      });
    }
  }
}

module.exports = new PhotoController();