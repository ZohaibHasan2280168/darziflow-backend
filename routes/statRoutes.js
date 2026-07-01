import { Router } from "express";
import { getActiveWorkflows,getAllDepartmentWorkflows,getPendingSubmissions,getQcStats} from "../controllers/statController.js";
import { protect } from '../middleware/authMiddleware.js';

const router = Router();

router.use(protect);


router.route("/:deptId/active-workflows").get(getActiveWorkflows);

router.route('/:deptId/all-workflows').get(getAllDepartmentWorkflows);

router.get('/getStats', getQcStats);

router.get('/submissions/pending', getPendingSubmissions);


export default router;