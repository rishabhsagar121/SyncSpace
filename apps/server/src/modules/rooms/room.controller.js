import { roomService } from './room.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const roomController = {
  create: catchAsync(async (req, res) => {
    const room = await roomService.create(req.user.id, req.body);
    res.status(201).json({ success: true, data: { room } });
  }),

  get: catchAsync(async (req, res) => {
    const room = await roomService.getRoom(req.params.roomId, req.user.id);
    res.json({ success: true, data: { room } });
  }),

  join: catchAsync(async (req, res) => {
    const room = await roomService.joinByCode(req.body.code, req.user.id, req.body.password);
    res.json({ success: true, data: { room } });
  }),

  leave: catchAsync(async (req, res) => {
    const result = await roomService.leave(req.params.roomId, req.user.id);
    res.json({ success: true, data: result });
  }),

  kick: catchAsync(async (req, res) => {
    const result = await roomService.kick(req.params.roomId, req.user.id, req.body.userId);
    res.json({ success: true, data: result });
  }),

  mute: catchAsync(async (req, res) => {
    const result = await roomService.mute(req.params.roomId, req.user.id, req.body.userId, req.body.isMuted);
    res.json({ success: true, data: result });
  }),

  transferHost: catchAsync(async (req, res) => {
    const result = await roomService.transferHost(req.params.roomId, req.user.id, req.body.userId);
    res.json({ success: true, data: result });
  }),

  updateSettings: catchAsync(async (req, res) => {
    const settings = await roomService.updateSettings(req.params.roomId, req.user.id, req.body);
    res.json({ success: true, data: { settings } });
  }),

  updateMode: catchAsync(async (req, res) => {
    const room = await roomService.updateMode(req.params.roomId, req.user.id, req.body.mode);
    res.json({ success: true, data: { room } });
  }),

  remove: catchAsync(async (req, res) => {
    const result = await roomService.delete(req.params.roomId, req.user.id);
    res.json({ success: true, data: result });
  }),

  listMine: catchAsync(async (req, res) => {
    const rooms = await roomService.listMyRooms(req.user.id);
    res.json({ success: true, data: { rooms } });
  }),
};