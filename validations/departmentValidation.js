import Joi from "joi";
import mongoose from "mongoose";

// Helper function to validate MongoDB ObjectId strings
const objectIdValidator = (value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
    }
    return value;
};

// Checkpoint Template Schema

export const checkpointSchema = Joi.object({
    name: Joi.string().trim().required().messages({ 'any.required': 'Checkpoint name is required.' }),
    description: Joi.string().allow('').optional(),
    
    allowedSubmissionTypes: Joi.array().items(
        Joi.string().valid("TEXT", "IMAGE", "VIDEO", "DOCUMENT")
    ).optional(),
    
    minRequiredUploads: Joi.number().min(0).optional(),
});

// Operation Template Schema
export const operationSchema = Joi.object({
    name: Joi.string().trim().required().messages({ 'any.required': 'Operation name is required.' }),
    description: Joi.string().allow('').optional(),
    
    // Allows creating an Operation with nested Checkpoints
    checkpoints: Joi.array().items(checkpointSchema).optional(),
});

//creating a new Department document
export const createDepartmentSchema = Joi.object({
    name: Joi.string().trim().required().messages({ 'any.required': 'Department name is required.' }),
    description: Joi.string().allow('').optional(),
    
    departmentHead: Joi.string().custom(objectIdValidator, 'Department Head ID').required(),
    status: Joi.string().valid("ACTIVE", "INACTIVE").optional(), 
    operations: Joi.array().items(operationSchema).optional(),
});

export const updateDepartmentSchema = Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().allow('').optional(),
    
    departmentHead: Joi.string().custom(objectIdValidator, 'Department Head ID').optional(),
    
    status: Joi.string().valid("ACTIVE", "INACTIVE").optional(),
});

export const createOperationSchema = operationSchema;

export const updateOperationSchema = Joi.object({
    name: Joi.string().trim().optional(),
    description: Joi.string().allow('').optional(),
});

export const createCheckpointSchema = checkpointSchema;
export const updateCheckpointSchema = checkpointSchema.min(1);