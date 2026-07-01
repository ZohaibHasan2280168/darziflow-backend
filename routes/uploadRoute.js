import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {getUploadSignature} from "../controllers/uploadController.js";

const router = express.Router();

router.post("/signature", protect, getUploadSignature);

export default router;