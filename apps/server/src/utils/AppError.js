export class AppError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details = null) {
    return new AppError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized', details = null) {
    return new AppError(401, message, details);
  }

  static forbidden(message = 'Forbidden', details = null) {
    return new AppError(403, message, details);
  }

  static notFound(message = 'Not found', details = null) {
    return new AppError(404, message, details);
  }

  static conflict(message = 'Conflict', details = null) {
    return new AppError(409, message, details);
  }

  static tooMany(message = 'Too many requests', details = null) {
    return new AppError(429, message, details);
  }

  static internal(message = 'Internal server error', details = null) {
    return new AppError(500, message, details);
  }
}