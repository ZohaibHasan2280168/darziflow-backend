import express from "express";
import {generateFcmToken,getMe,forgotPassword, resetPassword,logoutUser, registerUser, loginUser, verifyEmail} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

//Register
router.post("/register", registerUser);

// Email Verification 2FA
router.get("/verify/:token", verifyEmail);

//Login
router.post("/login", loginUser);

// Me route

router.get('/me',protect,getMe);
// Logout
router.post("/logout",protect,logoutUser);

//send email for forgot password
router.post("/forgot-password", forgotPassword);

//Update password using token
router.put("/reset-password/:token", resetPassword);

router.post("/update-fcm-token",protect,generateFcmToken);


export default router;