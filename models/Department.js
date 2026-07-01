import mongoose from "mongoose";

const CheckpointTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },

    allowedSubmissionTypes: {
        type: [String],
        enum: ["TEXT", "IMAGE", "VIDEO", "DOCUMENT"],
        default: ["TEXT"],
    },
    minRequiredUploads: { type: Number, default: 0 },
}, { _id: true }); 

const OperationTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    checkpoints: [CheckpointTemplateSchema]
}, { _id: true });

const DepartmentSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
    
    departmentHead: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User", 
        required: true 
    },
    // Status to enable/disable the template in workflow creation
    status: { 
        type: String, 
        enum: ["ACTIVE", "INACTIVE"], 
        default: "ACTIVE" 
    },
    
    // The core workflow structure
    operations: [OperationTemplateSchema], 

    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User",
    },
}, { timestamps: true });

const Department = mongoose.model("Department", DepartmentSchema);
export default Department;