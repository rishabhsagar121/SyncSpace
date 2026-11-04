import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof AppError)) {
    logger.error(err.stack || err.message);
    error = AppError.internal('Something went wrong');
  } else if (error.statusCode >= 500) {
    logger.error(err.stack || err.message);
  }

  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(error.details ? { errors: error.details } : {}),
    ...(env.NODE_ENV === 'development' && !(err instanceof AppError) ? { stack: err.stack } : {}),
  });
}