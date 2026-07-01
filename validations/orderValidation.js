import Joi from 'joi';

export const orderSchema = Joi.object({
    name: Joi.string().required().trim(),
    type: Joi.string().valid('PANT', 'JACKET', 'SHORTS', 'OTHER').required(),
    description: Joi.string().allow('', null),
    amount: Joi.number().positive().required(),
    currency: Joi.string().default('Rs.'),
    dueDate: Joi.date().iso().min('now').messages({
    'date.min': 'The due date cannot be in the past',
    'date.base': 'Please provide a valid date'
}),
    clientName: Joi.string().when('clientId', {
        is: Joi.string().hex().length(24),
        then: Joi.optional(),
        otherwise: Joi.required()
    }),
    clientEmail: Joi.string().email().when('clientId', {
        is: Joi.string().hex().length(24),
        then: Joi.optional(),
        otherwise: Joi.required()
    }),
    clientId: Joi.string().hex().length(24).allow(null, ''), // Validate MongoDB ID format
    qcMemberId: Joi.string().hex().length(24).allow(null, ''),
    requiredDocTypes: Joi.array().items(Joi.string().uppercase()),
    departmentSequenceIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required(),
    sourceRequestId: Joi.string().hex().length(24).allow(null, ''),
    approvedBlueprints: Joi.array().items(Joi.object({
        fileName: Joi.string().required(),
        fileUrl: Joi.string().required(),
        publicId: Joi.string().required(),
        resourceType: Joi.string().default('auto')
    })).default([]),
    overallStatus: Joi.string().valid('DRAFT', 'DOCS_PENDING', 'READY_TO_START', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
});

export const updateOrderSchema = orderSchema.fork(
    ['name', 'type', 'amount', 'currency', 'dueDate', 'clientName', 'clientEmail', 'departmentSequenceIds', 'qcMemberId'], 
    (schema) => schema.optional()
);