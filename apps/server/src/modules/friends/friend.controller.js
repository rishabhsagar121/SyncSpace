import { friendService } from './friend.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const friendController = {
  sendRequest: catchAsync(async (req, res) => {
    const result = await friendService.sendRequest(req.user.id, req.body.receiverId);
    res.status(201).json({ success: true, data: result });
  }),

  respond: catchAsync(async (req, res) => {
    const result = await friendService.respondToRequest(req.params.requestId, req.user.id, req.body.accept);
    res.json({ success: true, data: result });
  }),

  cancel: catchAsync(async (req, res) => {
    const result = await friendService.cancelRequest(req.params.requestId, req.user.id);
    res.json({ success: true, data: result });
  }),

  incoming: catchAsync(async (req, res) => {
    const requests = await friendService.listIncoming(req.user.id);
    res.json({ success: true, data: { requests } });
  }),

  outgoing: catchAsync(async (req, res) => {
    const requests = await friendService.listOutgoing(req.user.id);
    res.json({ success: true, data: { requests } });
  }),

  list: catchAsync(async (req, res) => {
    const friends = await friendService.listFriends(req.user.id);
    res.json({ success: true, data: { friends } });
  }),

  remove: catchAsync(async (req, res) => {
    const result = await friendService.removeFriend(req.user.id, req.params.friendId);
    res.json({ success: true, data: result });
  }),

  block: catchAsync(async (req, res) => {
    const result = await friendService.block(req.user.id, req.body.userId);
    res.json({ success: true, data: result });
  }),

  unblock: catchAsync(async (req, res) => {
    const result = await friendService.unblock(req.user.id, req.params.userId);
    res.json({ success: true, data: result });
  }),

  listBlocked: catchAsync(async (req, res) => {
    const blocked = await friendService.listBlocked(req.user.id);
    res.json({ success: true, data: { blocked } });
  }),
};