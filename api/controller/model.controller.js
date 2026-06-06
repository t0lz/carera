const db = require('../db');

class ModelController {
  async create(req,res){ try{
    const { car_make_id, name } = req.body;
    const { rows } = await db.query(
      'INSERT INTO car_models(car_make_id,name) VALUES ($1,$2) RETURNING car_model_id,car_make_id,name',
      [car_make_id, name]
    ); res.status(201).json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async getAll(req,res){ try{
    if (req.query.make_id) {
      const { rows } = await db.query(
        'SELECT car_model_id,car_make_id,name FROM car_models WHERE car_make_id=$1 ORDER BY name',
        [req.query.make_id]
      ); return res.json(rows);
    }
    const { rows } = await db.query('SELECT car_model_id,car_make_id,name FROM car_models ORDER BY name');
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async getOne(req,res){ try{
    const { rows } = await db.query(
      'SELECT car_model_id,car_make_id,name FROM car_models WHERE car_model_id=$1',[req.params.id]
    );
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async update(req,res){ try{
    const { rows } = await db.query(
      'UPDATE car_models SET car_make_id=COALESCE($1,car_make_id), name=COALESCE($2,name) WHERE car_model_id=$3 RETURNING car_model_id',
      [req.body.car_make_id, req.body.name, req.params.id]
    );
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json({ car_model_id: rows[0].car_model_id });
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
  async remove(req,res){ try{
    const { rowCount } = await db.query('DELETE FROM car_models WHERE car_model_id=$1',[req.params.id]);
    if(!rowCount) return res.status(404).json({ error:'not_found' });
    res.json({ ok:true });
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
}
module.exports = new ModelController();
