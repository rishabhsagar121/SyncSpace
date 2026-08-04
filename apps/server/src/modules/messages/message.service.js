import { messageRepository } from './message.repository.js';
import { roomRepository } from '../rooms/room.repository.js';
import { uploadBufferToCloudinary } from '../../utils/cloudinaryUpload.js';
import { AppError } from '../../utils/AppError.js';

async function assertMember(roomId, userId) {
  const membership = await roomRepository.findMembership(roomId, userId);
  if (!membership || membership.leftAt) throw AppError.forbidden('Not a member of this room');
  return membership;
}

export const messageService = {
  async send(roomId, senderId, { type = 'TEXT', content, replyToId }) {
    await assertMember(roomId, senderId);
    return messageRepository.create({ roomId, senderId, type, content, replyToId });
  },

  async sendFile(roomId, senderId, file, replyToId) {
    await assertMember(roomId, senderId);
    if (!file) throw AppError.badRequest('No file provided');

    const result = await uploadBufferToCloudinary(file.buffer, 'syncspace/messages');
    const type = file.mimetype.startsWith('image/') ? 'IMAGE' : 'FILE';

    return messageRepository.create({
      roomId,
      senderId,
      type,
      fileUrl: result.secure_url,
      fileName: file.originalname,
      replyToId,
    });
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