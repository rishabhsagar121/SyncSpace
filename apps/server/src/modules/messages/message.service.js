// apps/server/src/modules/messages/message.service.js
import { messageRepository } from './message.repository.js';
import { roomRepository } from '../rooms/room.repository.js';
import { uploadBufferToCloudinary } from '../../utils/cloudinaryUpload.js';
import { domainEvents } from '../../utils/domainEvents.js';
import { AppError } from '../../utils/AppError.js';
import { env } from '../../config/env.js';

const MAX_INLINE_BYTES = 3 * 1024 * 1024; // used only when Cloudinary is not available

async function assertMember(roomId, userId) {
  const membership = await roomRepository.findMembership(roomId, userId);
  if (!membership || membership.leftAt) throw AppError.forbidden('Not a member of this room');
  return membership;
}

function cloudinaryConfigured() {
  return !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

// Returns a URL for the file: Cloudinary if it works, otherwise a small inline data URL
async function storeFile(file) {
  if (cloudinaryConfigured()) {
    try {
      const result = await uploadBufferToCloudinary(file.buffer, 'syncspace/messages');
      return result.secure_url;
    } catch {
      // fall through to the inline fallback below
    }
  }

  if (file.size > MAX_INLINE_BYTES) {
    throw AppError.badRequest(
      'File storage (Cloudinary) is not working, and this file is too large to send without it.'
    );
  }
  const b64 = file.buffer.toString('base64');
  return `data:${file.mimetype || 'application/octet-stream'};base64,${b64}`;
}

export const messageService = {
  async send(roomId, senderId, { type = 'TEXT', content, replyToId }) {
    await assertMember(roomId, senderId);
    return messageRepository.create({ roomId, senderId, type, content, replyToId });
  },

  async sendFile(roomId, senderId, file, replyToId) {
    await assertMember(roomId, senderId);
    if (!file) throw AppError.badRequest('No file provided');

    const fileUrl = await storeFile(file);
    const type = file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE';

    const message = await messageRepository.create({
      roomId,
      senderId,
      type,
      fileUrl,
      fileName: file.originalname,
      replyToId: replyToId || undefined,
    });

    // Binary uploads go over REST, so broadcast to the room ourselves
    domainEvents.emit('message:created', { roomId, message });

    return message;
  },

  async list(roomId, userId, opts) {
    await assertMember(roomId, userId);
    return messageRepository.listByRoom(roomId, opts);
  },

  async edit(messageId, userId, content) {
    const result = await messageRepository.edit(messageId, userId, content);
    if (result.count === 0) throw AppError.forbidden('Cannot edit this message');
    return { edited: true };
  },

  async remove(messageId, userId) {
    const result = await messageRepository.softDelete(messageId, userId);
    if (result.count === 0) throw AppError.forbidden('Cannot delete this message');
    return { deleted: true };
  },

  async react(messageId, userId, emoji) {
    return messageRepository.addReaction(messageId, userId, emoji);
  },

  async unreact(messageId, userId, emoji) {
    await messageRepository.removeReaction(messageId, userId, emoji);
    return { removed: true };
  },
};