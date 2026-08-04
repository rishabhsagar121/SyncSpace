import { userService } from './user.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const userController = {
  getMe: catchAsync(async (req, res) => {
    const user = await userService.getProfile(req.user.id);
    res.json({ success: true, data: { user } });
  }),

  getById: catchAsync(async (req, res) => {
    const user = await userService.getProfile(req.params.userId);
    res.json({ success: true, data: { user } });
  }),

  search: catchAsync(async (req, res) => {
    const results = await userService.search(req.query.q, req.user.id);
    res.json({ success: true, data: { users: results } });
  }),

  updateProfile: catchAsync(async (req, res) => {
    const profile = await userService.updateProfile(req.user.id, req.body);
    res.json({ success: true, data: { profile } });
  }),

  uploadAvatar: catchAsync(async (req, res) => {
    const profile = await userService.uploadAvatar(req.user.id, req.file);
    res.json({ success: true, data: { profile } });
  }),

  updatePrivacy: catchAsync(async (req, res) => {
    const profile = await userService.updatePrivacy(req.user.id, req.body);
    res.json({ success: true, data: { profile } });
  }),

  listSessions: catchAsync(async (req, res) => {
    const sessions = await userService.listSessions(req.user.id);
    res.json({ success: true, data: { sessions } });
  }),

  revokeSession: catchAsync(async (req, res) => {
    const result = await userService.revokeSession(req.user.id, req.params.sessionId);
    res.json({ success: true, data: result });
  }),

  deleteAccount: catchAsync(async (req, res) => {
    await userService.deleteAccount(req.user.id);
    res.json({ success: true, message: 'Account deleted' });
  }),
};