import { authRepository } from './auth.repository.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens.js';
import { AppError } from '../../utils/AppError.js';

const REFRESH_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sanitizeUser(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

async function issueSession(user, meta) {
  const accessToken = signAccessToken({ sub: user.id });
  const refreshToken = signRefreshToken({ sub: user.id });
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS);

  await authRepository.createSession({
    userId: user.id,
    refreshToken,
    expiresAt,
    userAgent: meta?.userAgent,
    ipAddress: meta?.ipAddress,
    deviceLabel: meta?.deviceLabel,
  });

  return { accessToken, refreshToken };
}

export const authService = {
  async register({ username, email, password }, meta) {
    const existingEmail = await authRepository.findByEmail(email);
    if (existingEmail) throw AppError.conflict('Email already in use');

    const existingUsername = await authRepository.findByUsername(username);
    if (existingUsername) throw AppError.conflict('Username already taken');

    const passwordHash = await hashPassword(password);
    const user = await authRepository.createUser({ username, email, passwordHash });
    const { accessToken, refreshToken } = await issueSession(user, meta);

    return { user: sanitizeUser(user), accessToken, refreshToken };
  },

  async login({ identifier, password }, meta) {
    const user = await authRepository.findByIdentifier(identifier);
    if (!user) throw AppError.unauthorized('Invalid credentials');

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) throw AppError.unauthorized('Invalid credentials');

    const { accessToken, refreshToken } = await issueSession(user, meta);
    return { user: sanitizeUser(user), accessToken, refreshToken };
  },

  async refresh(rawRefreshToken) {
    if (!rawRefreshToken) throw AppError.unauthorized('No refresh token provided');

    let payload;
    try {
      payload = verifyRefreshToken(rawRefreshToken);
    } catch {
      throw AppError.unauthorized('Invalid or expired session');
    }

    const session = await authRepository.findValidSessionByToken(rawRefreshToken);
    if (!session || session.userId !== payload.sub) {
      throw AppError.unauthorized('Session no longer valid');
    }

    const accessToken = signAccessToken({ sub: payload.sub });
    const newRefreshToken = signRefreshToken({ sub: payload.sub });
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_MS);

    await authRepository.rotateSessionToken(session.id, newRefreshToken, expiresAt);

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(rawRefreshToken) {
    if (rawRefreshToken) {
      await authRepository.revokeSessionByToken(rawRefreshToken);
    }
    return { loggedOut: true };
  },
};