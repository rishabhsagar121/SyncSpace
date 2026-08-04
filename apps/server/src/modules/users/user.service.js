import { userRepository } from './user.repository.js';
import { uploadBufferToCloudinary } from '../../utils/cloudinaryUpload.js';
import { AppError } from '../../utils/AppError.js';

export const userService = {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    return user;
  },

  async search(query, requesterId) {
    if (!query || query.trim().length < 2) return [];
    return userRepository.searchByUsername(query.trim(), requesterId);
  },

  async updateProfile(userId, data) {
    return userRepository.updateProfile(userId, data);
  },

  async uploadAvatar(userId, file) {
    if (!file) throw AppError.badRequest('No file provided');
    const result = await uploadBufferToCloudinary(file.buffer, 'syncspace/avatars');
    return userRepository.updateAvatar(userId, result.secure_url);
  },

  async updatePrivacy(userId, privacy) {
    return userRepository.updatePrivacy(userId, privacy);
  },

  async listSessions(userId) {
    return userRepository.listSessions(userId);
  },

  async revokeSession(userId, sessionId) {
    const result = await userRepository.revokeSessionForUser(userId, sessionId);
    if (result.count === 0) throw AppError.notFound('Session not found');
    return { revoked: true };
  },

  async deleteAccount(userId) {
    return userRepository.softDelete(userId);
  },
};