import { messageService } from './message.service.js';
import { catchAsync } from '../../utils/catchAsync.js';

export const messageController = {
  send: catchAsync(async (req, res) => {
    const message = await messageService.send(req.params.roomId, req.user.id, req.body);
    res.status(201).json({ success: true, data: { message } });
  }),

  sendFile: catchAsync(async (req, res) => {
    const message = await messageService.sendFile(
      req.params.roomId,
      req.user.id,
      req.file,
      req.body.replyToId
    );
    res.status(201).json({ success: true, data: { message } });
  }),

  list: catchAsync(async (req, res) => {
    const messages = await messageService.list(req.params.roomId, req.user.id, req.query);
    res.json({ success: true, data: { messages } });
  }),

  edit: catchAsync(async (req, res) => {
    const result = await messageService.edit(req.params.messageId, req.user.id, req.body.content);
    res.json({ success: true, data: result });
  }),

  remove: catchAsync(async (req, res) => {
    const result = await messageService.remove(req.params.messageId, req.user.id);
    res.json({ success: true, data: result });
  }),

  react: catchAsync(async (req, res) => {
    const reaction = await messageService.react(req.params.messageId, req.user.id, req.body.emoji);
    res.json({ success: true, data: { reaction } });
  }),

  unreact: catchAsync(async (req, res) => {
    const result = await messageService.unreact(req.params.messageId, req.user.id, req.body.emoji);
    res.json({ success: true, data: result });
  }),
};