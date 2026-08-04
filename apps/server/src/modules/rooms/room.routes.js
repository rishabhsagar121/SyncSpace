cat > /home/claude/syncspace/apps/server/src/modules/rooms/room.routes.js << 'EOF'
import { Router } from 'express';
import { roomController } from './room.controller.js';
import { validate } from '../../middleware/validate.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import {
  createRoomSchema,
  joinRoomSchema,
  roomIdParamSchema,
  targetUserBodySchema,
  muteBodySchema,
  updateSettingsSchema,
  updateModeSchema,
} from './room.validation.js';

const router = Router();
router.use(authMiddleware);

router.post('/', validate(createRoomSchema), roomController.create);
router.post('/join', validate(joinRoomSchema), roomController.join);
router.get('/mine', roomController.listMine);
router.get('/:roomId', validate(roomIdParamSchema), roomController.get);
router.post('/:roomId/leave', validate(roomIdParamSchema), roomController.leave);
router.post('/:roomId/kick', validate(targetUserBodySchema), roomController.kick);
router.post('/:roomId/mute', validate(muteBodySchema), roomController.mute);
router.post('/:roomId/transfer-host', validate(targetUserBodySchema), roomController.transferHost);
router.patch('/:roomId/settings', validate(updateSettingsSchema), roomController.updateSettings);
router.patch('/:roomId/mode', validate(updateModeSchema), roomController.updateMode);
router.delete('/:roomId', validate(roomIdParamSchema), roomController.remove);

export default router;
EOF
echo written