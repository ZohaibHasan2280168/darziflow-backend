import express from "express";
import {protect,authorizeRoles} from "../middleware/authMiddleware.js";
import {createUser,fetchUserById, updateUser, deleteUser,fetchUsers,getAvailableDepartmentHeads, getQCMembers} from "../controllers/userController.js";

const router = express.Router();

router.get(
  "/available-department-heads",
  protect,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const users = await getAvailableDepartmentHeads();
      res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

router.get(
  "/qc-members",
  protect,
  authorizeRoles("ADMIN"),
  async (req, res) => {
    try {
      const users = await getQCMembers();
      res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

router.get("/", protect,authorizeRoles("ADMIN"),fetchUsers);
router.get("/:id", protect, fetchUserById);

router.post("/create", protect,authorizeRoles("ADMIN"),createUser);
router.delete("/:id", protect,authorizeRoles("ADMIN"),deleteUser);
router.put("/:id", protect,authorizeRoles("ADMIN"),updateUser);



export default router;
