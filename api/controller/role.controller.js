const db = require('../db');

class RoleController {
  async create(req, res) {
    try {
      const { name } = req.body;
      const { rows } = await db.query(
        'INSERT INTO roles(name) VALUES ($1) RETURNING role_id, name',
        [name]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e); res.status(500).json({ error: 'db_error' });
    }
  }
  async getAll(_req, res) {
    try {
      const { rows } = await db.query('SELECT role_id, name FROM roles ORDER BY name');
      res.json(rows);
    } catch (e) { console.error(e); res.status(500).json({ error: 'db_error' }); }
  }
  async remove(req, res) {
    try {
      const { rowCount } = await db.query('DELETE FROM roles WHERE role_id=$1', [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: 'not_found' });
      res.json({ ok: true });
    } catch (e) { console.error(e); res.status(500).json({ error: 'db_error' }); }
  }
}
module.exports = new RoleController();
