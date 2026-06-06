const db = require('../db');

class VehicleController {
  async create(req,res){ try{
    const v = req.body;
    const { rows } = await db.query(
      `INSERT INTO vehicles
       (car_model_id, body_type_id, car_make_id, year, vin, transmission, fuel_type, drive_type, color,
        engine_volume_l, power_hp, torque_nm, mileage_km)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING vehicle_id`,
      [
        v.car_model_id, v.body_type_id, v.car_make_id, v.year, v.vin || null,
        v.transmission || null, v.fuel_type || null, v.drive_type || null, v.color || null,
        v.engine_volume_l, v.power_hp, v.torque_nm, v.mileage_km
      ]
    );
    res.status(201).json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }

  async getAll(req,res){ try{
    const w=[]; const p=[];
    if (req.query.make_id)      { p.push(req.query.make_id);      w.push(`car_make_id=$${p.length}`); }
    if (req.query.model_id)     { p.push(req.query.model_id);     w.push(`car_model_id=$${p.length}`); }
    if (req.query.body_type_id) { p.push(req.query.body_type_id); w.push(`body_type_id=$${p.length}`); }
    if (req.query.year_from)    { p.push(req.query.year_from);    w.push(`year >= $${p.length}`); }
    if (req.query.year_to)      { p.push(req.query.year_to);      w.push(`year <= $${p.length}`); }

    const sql = `SELECT vehicle_id, car_model_id, body_type_id, car_make_id, year,
                        mileage_km, power_hp, torque_nm
                 FROM vehicles
                 ${w.length ? 'WHERE '+w.join(' AND ') : '' }
                 ORDER BY vehicle_id DESC LIMIT 100`;
    const { rows } = await db.query(sql, p);
    res.json(rows);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }

  async getOne(req,res){ try{
    const { rows } = await db.query('SELECT * FROM vehicles WHERE vehicle_id=$1',[req.params.id]);
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json(rows[0]);
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }

  async update(req,res){ try{
    const v = req.body, id = req.params.id;
    const access = await db.query(
      'SELECT seller_id FROM ads WHERE vehicle_id = $1 LIMIT 1',
      [id]
    );
    if (
      access.rows.length &&
      Number(access.rows[0].seller_id) !== Number(req.user.user_id) &&
      req.user.role_name !== 'admin'
    ) {
      return res.status(403).json({ error:'forbidden' });
    }
    const { rows } = await db.query(
      `UPDATE vehicles SET
        car_model_id=COALESCE($1,car_model_id),
        body_type_id=COALESCE($2,body_type_id),
        car_make_id =COALESCE($3,car_make_id),
        year        =COALESCE($4,year),
        vin         =COALESCE($5,vin),
        transmission=COALESCE($6,transmission),
        fuel_type   =COALESCE($7,fuel_type),
        drive_type  =COALESCE($8,drive_type),
        color       =COALESCE($9,color),
        engine_volume_l=COALESCE($10,engine_volume_l),
        power_hp    =COALESCE($11,power_hp),
        torque_nm   =COALESCE($12,torque_nm),
        mileage_km  =COALESCE($13,mileage_km)
       WHERE vehicle_id=$14 RETURNING vehicle_id`,
      [v.car_model_id, v.body_type_id, v.car_make_id, v.year, v.vin || null, v.transmission || null,
       v.fuel_type || null, v.drive_type || null, v.color || null, v.engine_volume_l, v.power_hp,
       v.torque_nm, v.mileage_km, id]
    );
    if(!rows.length) return res.status(404).json({ error:'not_found' });
    res.json({ vehicle_id: rows[0].vehicle_id });
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }

  async remove(req,res){ try{
    const access = await db.query(
      'SELECT seller_id FROM ads WHERE vehicle_id = $1 LIMIT 1',
      [req.params.id]
    );
    if (
      access.rows.length &&
      Number(access.rows[0].seller_id) !== Number(req.user.user_id) &&
      req.user.role_name !== 'admin'
    ) {
      return res.status(403).json({ error:'forbidden' });
    }
    const { rowCount } = await db.query('DELETE FROM vehicles WHERE vehicle_id=$1',[req.params.id]);
    if(!rowCount) return res.status(404).json({ error:'not_found' });
    res.json({ ok:true });
  }catch(e){ console.error(e); res.status(500).json({ error:'db_error' }); } }
}
module.exports = new VehicleController();
