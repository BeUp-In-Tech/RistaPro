import { Router } from 'express';
import { checkAuth } from '../../middlewares/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { Role } from '../user/user.interface';
import { DocumentController } from './document.controller';
import {
  documentUploadZodSchema,
  faceVerificationZodSchema,
  parentIdUploadZodSchema,
  parentPhotoUploadZodSchema,
} from './document.validate';
import {
  documentMulterUpload,
  imageMulterUpload,
} from '../../config/multer.config';

const router = Router();

// AUTHENTICATED USER VERIFY FACE
router.post(
  '/face-verification',
  checkAuth(Role.USER, Role.ADMIN),
  validateRequest(faceVerificationZodSchema),
  DocumentController.verifyFace
);

// AUTHENTICATED USER UPLOAD PARENT/GUARDIAN PHOTO
router.post(
  '/parent/photo',
  checkAuth(Role.USER, Role.ADMIN),
  imageMulterUpload.single('photo'),
  validateRequest(parentPhotoUploadZodSchema),
  DocumentController.uploadParentPhoto
);


// AUTHENTICATED USER UPLOAD PARENT/GUARDIAN ID CARD
router.post(
  '/parent/id-card',
  checkAuth(Role.USER, Role.ADMIN),
  documentMulterUpload.array('documents', 2),
  validateRequest(parentIdUploadZodSchema),
  DocumentController.uploadParentIdDocument
);

// AUTHENTICATED USER UPLOAD DOCUMENT
router.post(
  '/upload',
  checkAuth(Role.USER, Role.ADMIN),
  documentMulterUpload.array('documents', 10),
  validateRequest(documentUploadZodSchema),
  DocumentController.uploadDocument
);

// AUTHENTICATED USER GET DOCUMENTS
router.get(
  '/:candidateId',
  checkAuth(Role.USER),
  DocumentController.getCandidateDocuments
);

export const documentRoutes = router;
