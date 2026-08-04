cat > /home/claude/syncspace/apps/server/src/modules/messages/message.routes.js << 'EOF'
import { Router } from 'express';
import { messageController } from './message.controller.js';
import { validate } from '../../middleware/validate.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { uploadAnyFile } from '../../utils/upload.js';
import {
  sendMessageSchema,
  listMessagesSchema,
  editMessageSchema,
  messageIdParamSchema,
  reactionSchema,
} from './message.validation.js';

const router = Router();
router.use(authMiddleware);

router.post('/room/:roomId', validate(sendMessageSchema), messageController.send);
router.post('/room/:roomId/file', uploadAnyFile.single('file'), messageController.sendFile);
router.get('/room/:roomId', validate(listMessagesSchema), messageController.list);
router.patch('/:messageId', validate(editMessageSchema), messageController.edit);
router.delete('/:messageId', validate(messageIdParamSchema), messageController.remove);
router.post('/:messageId/reactions', validate(reactionSchema), messageController.react);
router.delete('/:messageId/reactions', validate(reactionSchema), messageController.unreact);

export default router;
EOF
echo written