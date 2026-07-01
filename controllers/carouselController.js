import asyncHandler from "express-async-handler";
import Carousel from "../models/Carousel.js";
import { deleteByPublicId } from "../services/cloudinaryService.js";
 
 // @desc    Add new carousel item
 // @route   POST /api/carousel
 // @access  Private/Admin
 export const addCarouselItem = asyncHandler(async (req, res) => {
     const { imageUrl, publicId, title, description, link, priority } = req.body;

     if (!imageUrl || !publicId || !title) {
         res.status(400);
         throw new Error("Please provide image URL, public ID and title");
     }
 
     const carouselItem = await Carousel.create({
         imageUrl,
         publicId,
         title,
         description,
         link,
         priority: priority || 0
     });
 
     res.status(201).json(carouselItem);
 });
 
 // @desc    Get all active carousel items
 // @route   GET /api/carousel
 // @access  Public
 export const getCarouselItems = asyncHandler(async (req, res) => {
     const items = await Carousel.find({ isActive: true }).sort({ priority: -1, createdAt: -1 });
     res.json(items);
 });
 
 // @desc    Delete carousel item
 // @route   DELETE /api/carousel/:id
 // @access  Private/Admin
 export const deleteCarouselItem = asyncHandler(async (req, res) => {
     const item = await Carousel.findById(req.params.id);
 
     if (!item) {
         res.status(404);
         throw new Error("Carousel item not found");
     }
 
     // Delete from Cloudinary
     await deleteByPublicId(item.publicId);
 
     // Delete from DB
     await item.deleteOne();
 
     res.json({ message: "Carousel item removed" });
 });
