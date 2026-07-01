import asyncHandler from "express-async-handler";
import { generateSignedUploadConfig } from "../services/uploadService.js";

export const getUploadSignature = asyncHandler(async (req, res) => {

    const { contextType, orderId, requestId, chatRoomId } = req.body;

    const config = generateSignedUploadConfig({
        user: req.user,
        contextType,
        orderId,
        requestId,
        chatRoomId
    });

    res.status(200).json(config);
});