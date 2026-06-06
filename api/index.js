const express = require('express');
const path = require('path');
const db = require('./db');

const roleRouter = require('./routes/role.routes');
const userRouter = require('./routes/user.routes');
const makeRouter = require('./routes/make.routes');
const modelRouter = require('./routes/model.routes');
const bodyTypeRouter = require('./routes/bodyType.routes');
const vehicleRouter = require('./routes/vehicle.routes');
const adRouter = require('./routes/ad.routes');
const photoRouter = require('./routes/photo.routes');
const importOrderRouter = require('./routes/importOrder.routes');
const authRouter = require('./routes/auth.routes');

const PORT = process.env.PORT || 8080;
const app = express();

app.use(express.json());

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/debug-db', async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        current_user,
        current_database(),
        current_schema()
    `);

    res.json(rows[0]);
  } catch (e) {
    console.error('debug-db error:', e);

    res.status(500).json({
      error: e.message,
      code: e.code,
    });
  }
});

app.get('/api/debug-ad/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `
      SELECT 
        ad_id, 
        status, 
        rejection_reason, 
        published_at, 
        updated_at
      FROM ads 
      WHERE ad_id = $1
      `,
      [req.params.id]
    );

    res.json(rows);
  } catch (e) {
    console.error('debug-ad error:', e);

    res.status(500).json({
      error: e.message,
      code: e.code,
    });
  }
});

app.use('/api', authRouter);
app.use('/api', roleRouter);
app.use('/api', userRouter);
app.use('/api', makeRouter);
app.use('/api', modelRouter);
app.use('/api', bodyTypeRouter);
app.use('/api', vehicleRouter);
app.use('/api', adRouter);
app.use('/api', photoRouter);
app.use('/api', importOrderRouter);

app.listen(PORT, () => console.log(`сервер запущен на порте ${PORT}`));