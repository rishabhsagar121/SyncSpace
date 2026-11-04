import multer from 'multer';
import { AppError } from './AppError.js';

const storage = multer.memoryStorage();

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      return cb(AppError.badRequest('Only image files are allowed'));
    }
    cb(null, true);
  },
});

export const uploadAnyFile = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
});