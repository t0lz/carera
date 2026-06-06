const db = require('../db');

class MakeController {
  async create(req,res){ try{
    const { name } = req.body;
    const { rows } = await db.query('INSERT INTO car_makes(name) VALUES ($1) RETURNING car_make_id,name',[name]);
    res.status(201).json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error: 'db_error' }); } }
  async getAll(_req,res){ try{
    const { rows } = await db.query('SELECT car_make_id,name FROM car_makes ORDER BY name');
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({ error: 'db_error' }); } }
  async getOne(req,res){ try{
    const { rows } = await db.query('SELECT car_make_id,name FROM car_makes WHERE car_make_id=$1',[req.params.id]);
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error: 'db_error' }); } }
  async update(req,res){ try{
    const { rows } = await db.query(
      'UPDATE car_makes SET name=COALESCE($1,name) WHERE car_make_id=$2 RETURNING car_make_id',
      [req.body.name, req.params.id]
    );
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json({ car_make_id: rows[0].car_make_id });
  }catch(e){ console.error(e); res.status(500).json({ error: 'db_error' }); } }
  async remove(req,res){ try{
    const { rowCount } = await db.query('DELETE FROM car_makes WHERE car_make_id=$1',[req.params.id]);
    if(!rowCount) return res.status(404).json({ error:'not_found' });
    res.json({ ok:true });
  }catch(e){ console.error(e); res.status(500).json({ error: 'db_error' }); } }
}
module.exports = new MakeController();
