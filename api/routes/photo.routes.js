const Router = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = new Router();
const photoController = require('../controller/photo.controller');
const { requireAuth } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'cars');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const originalExt = path.extname(file.originalname || '').toLowerCase();
    const ext = allowedExtensions.has(originalExt) ? originalExt : '.jpg';

    const uniqueName =
      Date.now() +
      '-' +
      Math.round(Math.random() * 1e9) +
      ext;

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Можно загружать только изображения'));
    }

    cb(null, true);
  },
});

router.get('/photo', (req, res) => photoController.listByAd(req, res));

router.post('/photo', requireAuth, (req, res) => photoController.create(req, res));

router.post(
  '/photo/upload',
  requireAuth,
  upload.array('photos', 10),
  (req, res) => photoController.uploadPhotos(req, res)
);

router.delete('/photo/:id', requireAuth, (req, res) => photoController.remove(req, res));

router.delete('/photo/by-ad/:adId', requireAuth, (req, res) => photoController.removeByAd(req, res));

module.exports = router;