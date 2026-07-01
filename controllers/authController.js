import User from '../models/User.js';
import { generateAccessToken, generateRefreshToken, hashPassword, comparePassword } from '../utils/authUtill.js';
import crypto from "crypto";
import { sendEmail } from "../utils/mailer.js";
import { logAction } from "../utils/auditLogger.js";
import asyncHandler from "express-async-handler";
import { sendNotificationToRoles, createAndSendNotification } from "../services/notificationService.js";

const registerUser = asyncHandler(async (req, res) => {
  const { name, email: email, password, role } = req.body;

  const userExists = await User.findOne({ email: email });
  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  //Hash password
  const hashed = await hashPassword(password);

  //email verification token
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = Date.now() + 30 * 60 * 1000;

  //Create user (status PENDING until email verified)
  const newUser = await User.create({
    name,
    email: email,
    password: hashed,
    role,
    verificationToken,
    verificationExpires,
  });

  const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

  const emailHTML = `
    <h2>Welcome to DarziFlow, ${name}!</h2>
    <p>Thank you for registering as a <b>${role}</b>.</p>
    <p>Please verify your email address by clicking the button below:</p>
    <a href="${verificationLink}" 
       style="background-color:#4CAF50;color:white;padding:10px 15px;text-decoration:none;border-radius:5px;">
       Verify Email
    </a>
    <p>This link will expire in 30 minutes.</p>
    <br/>
    <p>If you didn’t request this, please ignore this email.</p>
  `;

  await sendEmail(email, "Verify your DarziFlow account", emailHTML);

  await logAction(req, {
    action: "SIGNUP",
    performedBy: newUser._id,
    details: `${newUser.name} signed up`,
    priority: "success"
  });

  await sendNotificationToRoles({
    roles: ["ADMIN"],
    senderId: newUser._id,
    type: "USER_CREATE",
    title: "New Registration",
    body: `A new user ${newUser.name} has signed up and is pending verification.`,
    data: { screen: "/users" }
  });

  res.status(201).json({
    message: "User registered successfully. Please check your email to verify your account.",
    user: {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password, platform } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

  if (!user.isVerified) {
    return res.status(403).json({ message: "Please verify your email before logging in." });
  }

  if (platform === "WEB") {
    if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
      return res
        .status(403)
        .json({ message: "Access denied. Only Moderators and Admins can login from web." });
    }
  } else if (platform === "MOBILE") {
    if (
      user.role !== "DEPARTMENT_HEAD" &&
      user.role !== "QC_MEMBER" &&
      user.role !== "CLIENT"
    ) {
      return res
        .status(403)
        .json({ message: "Access denied. Only Department Heads, QC Officers, or Clients can login from mobile." });
    }
  } else {
    return res
      .status(400)
      .json({ message: "Platform not specified or invalid (use WEB or MOBILE)" });
  }


  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 60 * 1000, // 30 minutes
    path: '/',
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  await logAction(req, {
    action: "LOGIN",
    performedBy: user._id,
    details: `${user.name} logged in`,
    priority: "success"
  });

  res.status(200).json({
    message: "User logged in successfully",
    mustChangePassword: user.mustChangePassword,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      passwordUpdatedAt: user.passwordUpdatedAt,
    },
    accessToken,
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({
    verificationToken: token,
    verificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationExpires = undefined;
  await user.save();

  res.status(200).json({ message: "Email verified successfully. You can now log in." });
});

const logoutUser = asyncHandler(async (req, res) => {
  const user = req.user;
  const { fcmToken } = req.body;


  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: '/',
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: '/',
  });

  if (user) {
    if (fcmToken) {

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $pull: { fcmTokens: fcmToken } },
        { new: true }
      );

    } else {
      console.log(`🔥 LOGOUT DEBUG: Skipped database update because fcmToken was empty.`);
    }

    await logAction(req, {
      action: "LOGOUT",
      performedBy: user._id,
      details: `${user.name} logged out`,
      priority: "success",
    });
  }

  res.status(200).json({ message: "Logged out successfully" });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });

  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const emailContent = `
    <h2>Password Reset Request</h2>
    <p>Hello ${user.name},</p>
    <p>You recently requested to reset your password for your DarziFlow account.</p>
    <p>Click the link below to reset your password (valid for 15 minutes):</p>
    <a href="${resetUrl}" target="_blank" 
       style="background:#667eea;color:white;padding:10px 20px;
       border-radius:6px;text-decoration:none;">Reset Password</a>
    <p>If you did not request this, you can safely ignore this email.</p>
  `;

  await sendEmail(user.email, "DarziFlow Password Reset", emailContent);

  res.status(200).json({
    success: true,
    message: "Password reset link sent to your email",
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const resetPasswordToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken,
    resetPasswordExpire: { $gt: Date.now() },
  });

  if (!user)
    return res.status(400).json({
      success: false,
      message: "Invalid or expired password reset token",
    });

  const { password } = req.body;
  if (!password)
    return res
      .status(400)
      .json({ success: false, message: "Password is required" });

  user.password = await hashPassword(password);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.passwordUpdatedAt = Date.now();
  await user.save();

  await logAction(req, {
    action: "CHANGE_PASSWORD",
    performedBy: user._id,
    details: `${user.name} changed their password`,
    priority: "success",
  });

  await createAndSendNotification({
    recipientId: user._id,
    senderId: user._id,
    type: "USER_UPDATE",
    title: "Password Reset Successful",
    body: "Your password has been successfully reset. If you did not perform this action, please contact support immediately.",
    data: { screen: "/login" }
  });

  res.status(200).json({
    success: true,
    message: "Password reset successfully! You can now log in.",
  });
});

const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select("name email role department mustChangePassword isVerified")
    .populate("department", "name status");

  if (!user) {
    return res.status(404).json({ msg: "User not found" });
  }

  res.json(user);
});

const generateFcmToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ message: "Token required" });

  await User.findByIdAndUpdate(req.user.id, {
    $addToSet: { fcmTokens: token }
  });

  res.status(200).json({ message: "Token updated successfully" });
});

export { generateFcmToken, resetPassword, forgotPassword, logoutUser, registerUser, loginUser, verifyEmail, getMe };