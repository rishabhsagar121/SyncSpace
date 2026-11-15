import { userRepository } from './user.repository.js';
import { uploadBufferToCloudinary } from '../../utils/cloudinaryUpload.js';
import { AppError } from '../../utils/AppError.js';

export const userService = {
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound('User not found');
    return user;
  },

  // What other people may see: no email unless the person allowed it, and presence only if they share it
  async getPublicProfile(targetId, viewerId) {
    const user = await userRepository.findById(targetId);
    if (!user || user.deletedAt) throw AppError.notFound('User not found');

    const privacy = user.profile?.privacy || {};
    const isSelf = targetId === viewerId;
    const sharePresence = isSelf || privacy.showLastSeen !== false;

    return {
      id: user.id,
      username: user.username,
      presenceStatus: sharePresence ? user.presenceStatus : 'OFFLINE',
      lastSeenAt: sharePresence ? user.lastSeenAt : null,
      createdAt: user.createdAt,
      ...(isSelf || privacy.showEmail === true ? { email: user.email } : {}),
      profile: user.profile
        ? {
            displayName: user.profile.displayName,
            bio: user.profile.bio,
            avatarUrl: user.profile.avatarUrl,
          }
        : null,
    };
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
    let avatarUrl = '';
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const result = await uploadBufferToCloudinary(file.buffer, 'syncspace/avatars');
        avatarUrl = result.secure_url;
      } catch (err) {
        const b64 = file.buffer.toString('base64');
        avatarUrl = `data:${file.mimetype || 'image/png'};base64,${b64}`;
      }
    } else {
      const b64 = file.buffer.toString('base64');
      avatarUrl = `data:${file.mimetype || 'image/png'};base64,${b64}`;
    }
    return userRepository.updateAvatar(userId, avatarUrl);
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