import { Router } from 'express';
import { userController } from './user.controller.js';
import { validate } from '../../middleware/validate.js';
import { authMiddleware } from '../../middleware/authMiddleware.js';
import { uploadImage } from '../../utils/upload.js';
import {
  updateProfileSchema,
  searchUsersSchema,
  updatePrivacySchema,
  sessionParamSchema,
} from './user.validation.js';

const router = Router();
router.use(authMiddleware);

router.get('/me', userController.getMe);
router.get('/search', validate(searchUsersSchema), userController.search);
router.get('/:userId', userController.getById);
router.patch('/me/profile', validate(updateProfileSchema), userController.updateProfile);
router.post('/me/avatar', uploadImage.single('avatar'), userController.uploadAvatar);
router.patch('/me/privacy', validate(updatePrivacySchema), userController.updatePrivacy);
router.get('/me/sessions', userController.listSessions);
router.delete('/me/sessions/:sessionId', validate(sessionParamSchema), userController.revokeSession);
router.delete('/me', userController.deleteAccount);

export default router;