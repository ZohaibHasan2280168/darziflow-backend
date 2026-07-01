import { signUpload } from "../services/cloudinaryService.js";

export const generateSignedUploadConfig = ({
    user,
    contextType,
    orderId,
    requestId,
    chatRoomId
}) => {

    const timestamp = Math.round(Date.now() / 1000);
    const role = user.role;
    let folder;

    switch (contextType) {

        case "profile":

            if (!["ADMIN", "CLIENT", "DEPARTMENT_HEAD", "QC_MEMBER"].includes(role)) {
                throw new Error("Not authorized to upload profile picture");
            }

            folder = `darziflow/profile/${user._id}`;
            break;

        case "prerequisite":

            if (!["ADMIN", "CLIENT"].includes(role)) {
                throw new Error("Not authorized to upload prerequisite documents");
            }

            if (!orderId) {
                throw new Error("orderId required");
            }

            folder = `darziflow/orders/${orderId}/prerequisites`;
            break;

        case "checkpoint":

            if (!["DEPARTMENT_HEAD", "ADMIN"].includes(role)) {
                throw new Error("Only department head can upload checkpoint media");
            }

            if (!orderId) {
                throw new Error("orderId required");
            }

            folder = `darziflow/orders/${orderId}/checkpoints`;
            break;

            folder = `darziflow/carousel`;
            break;

        case "order_request":

            if (!["ADMIN", "CLIENT"].includes(role)) {
                throw new Error("Not authorized to upload request files");
            }

            folder = requestId ? `darziflow/requests/${requestId}` : `darziflow/requests/user_${user._id}`;
            break;
        case "chat":
            if (!chatRoomId) {
                throw new Error("chatRoomId required for chat media uploads");
            }
            folder = `darziflow/chat/room_${chatRoomId}`;
            break;

        default:
            throw new Error("Invalid upload context");
    }

    const signature = signUpload({
        timestamp,
        folder,
    });

    return {
        timestamp,
        signature,
        apiKey: process.env.CLOUDINARY_API_KEY,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        folder,
        resourceType: "auto"
    };
};