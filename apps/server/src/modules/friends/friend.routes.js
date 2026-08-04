cat > /home/claude/syncspace/apps/server/src/modules/friends/friend.routes.js << 'EOF'
import { Router } from 'express';
import { friendController } from './friend.controller.js';
import { validate } from '../../middleware/validate.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
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

router.post('/requests', validate(sendRequestSchema), friendController.sendRequest);
router.patch('/requests/:requestId', validate(respondRequestSchema), friendController.respond);
router.delete('/requests/:requestId', validate(requestIdParamSchema), friendController.cancel);
router.get('/requests/incoming', friendController.incoming);
router.get('/requests/outgoing', friendController.outgoing);

router.get('/', friendController.list);
router.delete('/:friendId', validate(friendIdParamSchema), friendController.remove);

router.post('/block', validate(blockUserSchema), friendController.block);
router.delete('/block/:userId', validate(userIdParamSchema), friendController.unblock);
router.get('/blocked', friendController.listBlocked);

export default router;
EOF
echo written