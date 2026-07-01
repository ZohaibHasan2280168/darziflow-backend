import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {createCheckpoint,updateCheckpoint,deleteCheckpoint} from "../controllers/checkpointTemplateController.js";

const router = express.Router();
const templateAuth = [protect, authorizeRoles("MODERATOR", "ADMIN", "DEPARTMENT_HEAD")];

// CREATE
router.post(
  "/departments/:deptId/operations/:opId/checkpoints",
  templateAuth,
  createCheckpoint
);

// UPDATE
router.put(
  "/departments/:deptId/operations/:opId/checkpoints/:chkId",
  templateAuth,
  updateCheckpoint
);

// DELETE
router.delete(
  "/departments/:deptId/operations/:opId/checkpoints/:chkId",
  templateAuth,
  deleteCheckpoint
);

export default router;
