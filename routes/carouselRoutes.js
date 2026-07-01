import express from "express";
import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import {addCarouselItem,getCarouselItems,deleteCarouselItem} from "../controllers/carouselController.js";

const router = express.Router();

router.route("/")
    .get(getCarouselItems) // Publicly accessible to clients
    .post(protect, authorizeRoles("ADMIN"), addCarouselItem);

router.route("/:id")
    .delete(protect, authorizeRoles("ADMIN"), deleteCarouselItem);

export default router;
