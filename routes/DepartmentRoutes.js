import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { getDepartments, getDepartmentById, createDepartment, updateDepartment, deleteDepartment,getDepartmentOverview } from "../controllers/departmentController.js";

const router = express.Router();

const templateAuth = [protect, authorizeRoles("ADMIN", "DEPARTMENT_HEAD")];

router.get("/overview", protect, authorizeRoles("DEPARTMENT_HEAD"), getDepartmentOverview);

// api/departments
router.route("/").get(protect, getDepartments)
                 .post(templateAuth, createDepartment); 

// api/departments/:deptId
router.route("/:deptId")
    .get(protect, getDepartmentById)   
    .put(templateAuth, updateDepartment)  
    .delete(templateAuth, deleteDepartment); 


export default router;