// apps/server/src/modules/friends/friend.service.js
import { friendRepository } from './friend.repository.js';
import { notificationService } from '../notifications/notification.service.js';
import { userRepository } from '../users/user.repository.js';
import { AppError } from '../../utils/AppError.js';

// Normalizes the friendship record into "the other person" from userId's POV
function toFriendView(friendship, userId) {
  const other = friendship.userAId === userId ? friendship.userB : friendship.userA;
  return { friendshipId: friendship.id, since: friendship.createdAt, user: other };
}

export const friendService = {
  async sendRequest(senderId, receiverId) {
    if (senderId === receiverId) throw AppError.badRequest("You can't friend yourself");

    const blocked = await friendRepository.isBlocked(senderId, receiverId);
    if (blocked) throw AppError.forbidden('Unable to send friend request');

    const alreadyFriends = await friendRepository.areFriends(senderId, receiverId);
    if (alreadyFriends) throw AppError.conflict('Already friends');

    const existing = await friendRepository.findPendingRequest(senderId, receiverId);
    if (existing) throw AppError.conflict('Friend request already sent');

    const sender = await userRepository.findById(senderId);

    // Auto-accept if the other person already sent one to you
    const reverse = await friendRepository.findPendingRequest(receiverId, senderId);
    if (reverse) {
      await friendRepository.updateRequestStatus(reverse.id, 'ACCEPTED');
      const friendship = await friendRepository.createFriendship(senderId, receiverId);
      await notificationService.create(receiverId, 'FRIEND_ACCEPTED', {
        fromUserId: senderId,
        fromUsername: sender?.username,
      });
      return { autoAccepted: true, friendship };
    }

    const request = await friendRepository.createRequest(senderId, receiverId);
    await notificationService.create(receiverId, 'FRIEND_REQUEST', {
      fromUserId: senderId,
      fromUsername: sender?.username,
      requestId: request.id,
    });
    return { autoAccepted: false, request };
  },

  async respondToRequest(requestId, receiverId, accept) {
    const request = await friendRepository.findRequestById(requestId);
    if (!request || request.receiverId !== receiverId) throw AppError.notFound('Request not found');
    if (request.status !== 'PENDING') throw AppError.conflict('Request already handled');

    await friendRepository.updateRequestStatus(requestId, accept ? 'ACCEPTED' : 'REJECTED');

    if (accept) {
      const friendship = await friendRepository.createFriendship(request.senderId, request.receiverId);
      const accepter = await userRepository.findById(receiverId);
      await notificationService.create(request.senderId, 'FRIEND_ACCEPTED', {
        fromUserId: receiverId,
        fromUsername: accepter?.username,
      });
      return { accepted: true, friendship };
    }
    return { accepted: false };
  },

  async cancelRequest(requestId, senderId) {
    const request = await friendRepository.findRequestById(requestId);
    if (!request || request.senderId !== senderId) throw AppError.notFound('Request not found');
    if (request.status !== 'PENDING') throw AppError.conflict('Request already handled');
    await friendRepository.updateRequestStatus(requestId, 'CANCELLED');
    return { cancelled: true };
  },

  async listIncoming(userId) {
    return friendRepository.listIncoming(userId);
  },

  async listOutgoing(userId) {
    return friendRepository.listOutgoing(userId);
  },

  async listFriends(userId) {
    const friendships = await friendRepository.listFriends(userId);
    return friendships.map((f) => toFriendView(f, userId));
  },

  async removeFriend(userId, friendId) {
    const result = await friendRepository.removeFriendship(userId, friendId);
    if (result.count === 0) throw AppError.notFound('Friendship not found');
    return { removed: true };
  },

  async block(blockerId, blockedId) {
    if (blockerId === blockedId) throw AppError.badRequest("You can't block yourself");
    await friendRepository.removeFriendship(blockerId, blockedId);
    await friendRepository.blockUser(blockerId, blockedId);
    return { blocked: true };
  },

  async unblock(blockerId, blockedId) {
    const result = await friendRepository.unblockUser(blockerId, blockedId);
    if (result.count === 0) throw AppError.notFound('Block not found');
    return { unblocked: true };
  },

  async listBlocked(userId) {
    return friendRepository.listBlocked(userId);
  },
};