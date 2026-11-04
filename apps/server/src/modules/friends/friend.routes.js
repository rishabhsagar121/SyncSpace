import { Router } from 'express';
import { friendController } from './friend.controller.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { validate } from '../../middleware/validate.js';
import {
  sendRequestSchema,
  respondRequestSchema,
  requestIdParamSchema,
  friendIdParamSchema,
  blockUserSchema,
  userIdParamSchema,
} from './friend.validation.js';

const router = Router();
router.use(authMiddleware);

router.get('/', friendController.list);
router.get('/requests/incoming', friendController.incoming);
router.get('/requests/outgoing', friendController.outgoing);
router.get('/requests', friendController.incoming);

router.post('/requests', validate(sendRequestSchema), friendController.sendRequest);
router.post('/request', validate(sendRequestSchema), friendController.sendRequest);
router.patch('/requests/:requestId', validate(respondRequestSchema), friendController.respond);
router.post('/requests/:requestId/accept', (req, res, next) => {
  req.body.accept = true;
  return friendController.respond(req, res, next);
});
router.post('/requests/:requestId/decline', (req, res, next) => {
  req.body.accept = false;
  return friendController.respond(req, res, next);
});

router.delete('/requests/:requestId', validate(requestIdParamSchema), friendController.cancel);
router.delete('/:friendId', validate(friendIdParamSchema), friendController.remove);

router.post('/block', validate(blockUserSchema), friendController.block);
router.delete('/block/:userId', validate(userIdParamSchema), friendController.unblock);
router.get('/blocked', friendController.listBlocked);

export default router;
