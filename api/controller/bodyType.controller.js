const db = require('../db');

class BodyTypeController {
  async create(req,res){ try{
    const { name } = req.body;
    const { rows } = await db.query(
      'INSERT INTO body_types(name) VALUES ($1) RETURNING body_type_id,name',[name]
    ); res.status(201).json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async getAll(_req,res){ try{
    const { rows } = await db.query('SELECT body_type_id,name FROM body_types ORDER BY name');
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async getOne(req,res){ try{
    const { rows } = await db.query(
      'SELECT body_type_id,name FROM body_types WHERE body_type_id=$1',[req.params.id]
    );
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async update(req,res){ try{
    const { rows } = await db.query(
      'UPDATE body_types SET name=COALESCE($1,name) WHERE body_type_id=$2 RETURNING body_type_id',
      [req.body.name, req.params.id]
    );
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json({ body_type_id: rows[0].body_type_id });
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async remove(req,res){ try{
    const { rowCount } = await db.query('DELETE FROM body_types WHERE body_type_id=$1',[req.params.id]);
    if(!rowCount) return res.status(404).json({ error:'not_found' });
    res.json({ ok:true });
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
}
module.exports = new BodyTypeController();
