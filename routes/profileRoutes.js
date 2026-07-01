import express from "express";
import {protect} from "../middleware/authMiddleware.js";
import {changePassword, getProfile,  updateAvatar,updateProfile} from "../controllers/profileController.js";

const router = express.Router();

router.get("/", protect,getProfile);

router.put("/password", protect, changePassword);

router.put("/updateProfile", protect, updateProfile);

router.put("/avatar", protect, updateAvatar);

export default router;
