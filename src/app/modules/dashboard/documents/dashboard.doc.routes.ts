import { Router } from "express";
import { checkAuth } from "../../../middlewares/auth.middleware";
import { Role } from "../../user/user.interface";
import { dashboardDocumentsController } from "./dashboard.doc.controller";

const router = Router();


router.get('/', checkAuth(Role.ADMIN), dashboardDocumentsController.readDocuments);

export const dashboardDocumentsRouter = router;