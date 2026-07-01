import User from '../models/User.js';
import { deleteByPublicId } from "../services/cloudinaryService.js";
import asyncHandler from "express-async-handler";
import {hashPassword,comparePassword} from "../utils/authUtill.js";

const getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password"); // don’t send password
        if (!user) return res.status(404).json({ msg: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).send("Server error");
    }
}


const changePassword = async (req, res) => {
      try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: "User not found" });

    // verify old password
    const isMatch = await comparePassword(oldPassword, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid old password" });

    // hash new password
    user.password = await hashPassword(newPassword);
    user.passwordUpdatedAt = new Date();
    await user.save();
    
    res.json({ msg: "Password updated successfully" });

  } catch (err) {
    res.status(500).send("Server error");
  }
}

const updateProfile = asyncHandler(async (req, res) => {
  const { name, newEmail } = req.body;

  if (!name && !newEmail) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (newEmail) {
    const normalizedEmail = newEmail.toLowerCase();

    const existing = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id }
    });

    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    user.email = normalizedEmail;
  }

  if (name) {
    user.name = name;
  }

  await user.save();

  res.status(200).json({
    success: true,
    name: user.name,
    email: user.email
  });
});

const updateAvatar = asyncHandler(async (req, res) => {

    const allowedRoles = ["ADMIN", "CLIENT", "DEPARTMENT_HEAD", "QC_MEMBER"];

    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Not authorized" });
    }

    const { url, publicId } = req.body;

    if (!url || !publicId) {
        return res.status(400).json({ message: "Avatar data incomplete" });
    }

    const user = await User.findById(req.user._id);

    if (user.avatar?.publicId) {
        await deleteByPublicId(user.avatar.publicId, "image");
    }

    user.avatar = {
        url,
        publicId
    };

    await user.save();

    res.status(200).json({
        success: true,
        avatar: user.avatar
    });
});

export {changePassword,updateAvatar,getProfile,updateProfile};