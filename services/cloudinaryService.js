import cloudinary from "../config/cloudinary.js";

export const signUpload = (params)=>{
        return cloudinary.utils.api_sign_request(
        params,
        process.env.CLOUDINARY_API_SECRET
    );
}

export const deleteByPublicId = (publicId, resourceType='image')=>{
    return cloudinary.uploader.destroy(publicId,{
        resource_type: resourceType
    });

}

