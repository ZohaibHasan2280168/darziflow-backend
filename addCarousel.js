import "dotenv/config";
import mongoose from "mongoose";
import cloudinary from "./config/cloudinary.js";
import Carousel from "./models/Carousel.js";
import connectDB from "./config/db.js";

const addCarousel = async () => {
    try {
        // Connect to Database
        await connectDB();

        const imagePath = "./carousal2.jpg";
        
        console.log(`Uploading ${imagePath} to Cloudinary...`);
        
        // Upload image to Cloudinary
        const result = await cloudinary.uploader.upload(imagePath, {
            folder: "darziflow/carousel",
            resource_type: "image"
        });

        console.log("Image uploaded successfully!");
        console.log("URL:", result.secure_url);
        console.log("Public ID:", result.public_id);

        // Create Carousel item in DB
        const carouselItem = await Carousel.create({
            imageUrl: result.secure_url,
            publicId: result.public_id,
            title: "New Collection 2026",
            description: "Experience the elegance of our latest designs.",
            link: "/shop/new-arrivals",
            priority: 1,
            isActive: true
        });

        console.log("Carousel item added to database successfully:");
        console.log(JSON.stringify(carouselItem, null, 2));
        
        // Close DB connection
        await mongoose.connection.close();
        console.log("Database connection closed.");
        
        process.exit(0);
    } catch (error) {
        console.error("Error adding carousel item:", error);
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
};

addCarousel();
