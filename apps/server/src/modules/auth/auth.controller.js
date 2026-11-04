import { authService } from './auth.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { setRefreshCookie, clearRefreshCookie, getRefreshCookie } from '../../utils/cookies.js';

function meta(req) {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

export const authController = {
  register: catchAsync(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.register(req.body, meta(req));
    setRefreshCookie(res, refreshToken);
    res.status(201).json({ success: true, data: { user, accessToken } });
  }),

  login: catchAsync(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.login(req.body, meta(req));
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, data: { user, accessToken } });
  }),

  refresh: catchAsync(async (req, res) => {
    const rawToken = getRefreshCookie(req);
    const { accessToken, refreshToken } = await authService.refresh(rawToken);
    setRefreshCookie(res, refreshToken);
    res.json({ success: true, data: { accessToken } });
  }),

  logout: catchAsync(async (req, res) => {
    const rawToken = getRefreshCookie(req);
    await authService.logout(rawToken);
    clearRefreshCookie(res);
    res.json({ success: true, message: 'Logged out' });
  }),
};