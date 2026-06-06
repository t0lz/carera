const db = require('../db');

class UserController {
  async getAll(_req, res) {
    try {
      const { rows } = await db.query(
        `SELECT u.user_id, u.email, u.role_id, r.name AS role_name,
                u.firstname, u.lastname, u.phone, u.created_at
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         ORDER BY u.user_id DESC`
      );
      res.json(rows);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'db_error' });
    }
  }

  async getOne(req, res) {
    try {
      const { rows } = await db.query(
        `SELECT u.user_id, u.email, u.role_id, r.name AS role_name,
                u.firstname, u.lastname, u.phone, u.created_at
         FROM users u
         JOIN roles r ON r.role_id = u.role_id
         WHERE u.user_id = $1`,
        [req.params.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'db_error' });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const { email, role_id, firstname, lastname, phone } = req.body || {};
      const nextRoleId = req.user.role_name === 'admin' ? role_id : null;

      const { rows } = await db.query(
        `UPDATE users SET
          email = COALESCE(NULLIF(TRIM($1), ''), email),
          role_id = COALESCE($2, role_id),
          firstname = COALESCE($3, firstname),
          lastname = COALESCE($4, lastname),
          phone = COALESCE($5, phone)
         WHERE user_id = $6
         RETURNING user_id, email, role_id, firstname, lastname, phone`,
        [email, nextRoleId, firstname, lastname, phone, id]
      );
      if (!rows.length) return res.status(404).json({ error: 'not_found' });
      res.json(rows[0]);
    } catch (e) {
      console.error(e);
      if (e.code === '23505') return res.status(409).json({ error: 'email_already_used' });
      res.status(500).json({ error: 'db_error' });
    }
  }

  async remove(req, res) {
    try {
      if (Number(req.params.id) === Number(req.user.user_id)) {
        return res.status(400).json({ error: 'cannot_delete_current_user' });
      }
      const { rowCount } = await db.query(
        'DELETE FROM users WHERE user_id = $1',
        [req.params.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'not_found' });
      res.json({ ok: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'db_error' });
    }
  }
}

module.exports = new UserController();
