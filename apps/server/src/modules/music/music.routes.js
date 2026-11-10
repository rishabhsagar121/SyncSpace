import { Router } from 'express';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { searchSongs, resolveSong, MusicApiError } from './youtube.service.js';

const router = Router();
router.use(authMiddleware);

const run = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (err) {
    if (err instanceof MusicApiError) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    next(err);
  }
};

router.get('/search', run((req) => searchSongs(String(req.query.q || ''))));
router.get('/resolve', run((req) => resolveSong(String(req.query.url || ''))));

export default router;