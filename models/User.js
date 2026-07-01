import mongoose from "mongoose";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["MODERATOR", "ADMIN", "DEPARTMENT_HEAD", "QC_MEMBER", "CLIENT"],
      required: true,
    },

    avatar: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" }
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    mustChangePassword: {
      type: Boolean,
      default: false
    },
    passwordUpdatedAt: {
      type: Date,
    },

    fcmTokens: [{ type: String }],

    // Verification fields
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    verificationExpires: { type: Date },

    //Forgot Password fields
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.index({ role: 1 });
userSchema.index({ department: 1 });

userSchema.pre("save", function (next) {
  if (this.department && this.role !== "DEPARTMENT_HEAD") {
    return next(
      new Error("Only DEPARTMENT_HEAD can be assigned a department")
    );
  }
  next();
});

// Generate Password Reset Token
userSchema.methods.generatePasswordResetToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 minutes
  return resetToken;
};

export default mongoose.model("User", userSchema);
