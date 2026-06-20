import { Router } from "express";
import { checkAuth } from "../../../middlewares/auth.middleware";
import { Role } from "../../user/user.interface";
import { dashboardDocumentsController } from "./dashboard.doc.controller";
import { documentRejectZodSchema } from "../../document/document.validate";
import { validateRequest } from "../../../middlewares/validateRequest";

const router = Router();


router.get('/', checkAuth(Role.ADMIN), dashboardDocumentsController.readDocuments);
router.get('/:candidateId', checkAuth(Role.ADMIN), dashboardDocumentsController.readUserDocument);
 
router.patch(
  '/:documentId/approve',
  checkAuth(Role.ADMIN),
  dashboardDocumentsController.approveDocument
);

router.patch(
  '/:documentId/reject',
  checkAuth(Role.ADMIN),
  validateRequest(documentRejectZodSchema),
  dashboardDocumentsController.rejectDocument
);

export const dashboardDocumentsRouter = router;