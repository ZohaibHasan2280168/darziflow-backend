import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {createOperation,updateOperation,deleteOperation} from "../controllers/operationController.js";

const router = express.Router();
const templateAuth = [protect, authorizeRoles("MODERATOR", "ADMIN", "DEPARTMENT_HEAD")];

// CREATE
router.post(
  "/departments/:deptId/operations",
  templateAuth,
  createOperation
);

// UPDATE / DELETE
router.put("/departments/:deptId/operations/:opId", templateAuth, updateOperation);
router.delete("/departments/:deptId/operations/:opId", templateAuth, deleteOperation);

export default router;
