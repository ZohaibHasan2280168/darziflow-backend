import mongoose from "mongoose";

const CarouselSchema = new mongoose.Schema({
    imageUrl: { 
        type: String, 
        required: true 
    },
    publicId: { 
        type: String, 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    description: { 
        type: String 
    },
    link: { 
        type: String 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    priority: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const Carousel = mongoose.model("Carousel", CarouselSchema);
export default Carousel;