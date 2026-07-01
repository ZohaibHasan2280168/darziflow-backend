import User from '../models/User.js';
import { hashPassword, generatePassword } from "../utils/authUtill.js";
import { sendEmail } from '../utils/mailer.js';
import crypto from 'crypto';
import { sendNotificationToRoles } from './notificationService.js';

// Creates a new user and sends welcome email.

export const createNewUser = async ({ name, email, role, reqUserId, req = null }) => {
    const tempPassword = generatePassword();
    const hashedPassword = await hashPassword(tempPassword);

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = Date.now() + 30 * 60 * 1000; // expires in 30 mins
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    const newUser = await User.create({
        name,
        email,
        role,
        password: hashedPassword,
        mustChangePassword: true,
        isVerified: false,
        verificationToken,
        verificationExpires,
        createdBy: reqUserId
    });

    const appDownloadLink = process.env.CLIENT_APP_URL || "https://darziflow.com/download/client-app.apk";

    const emailContent = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; color: #333; background-color: #ffffff;">
        <div style="background-color: #000000; padding: 35px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 2px;">DARZIFLOW</h1>
            <p style="margin: 10px 0 0; opacity: 0.8; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Premium Tailoring Management</p>
        </div>
        
        <div style="padding: 40px 30px;">
            <h2 style="color: #1a1a1a; margin-top: 0; font-size: 24px;">Welcome, ${name}!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #555;">Your account has been created successfully. You can now track your orders and manage your tailoring experience with ease.</p>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #000000; padding: 20px; margin: 30px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #333;">Your Login Credentials</h3>
                <p style="margin: 5px 0; font-size: 15px;"><strong>Email:</strong> ${email}</p>
                <p style="margin: 5px 0; font-size: 15px;"><strong>Temporary Password:</strong> <code style="background: #e9ecef; padding: 3px 8px; border-radius: 4px; font-weight: bold; color: #d63384;">${tempPassword}</code></p>
            </div>

            <div style="text-align: center; margin: 40px 0;">
                <a href="${verificationLink}" style="background-color: #000000; color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Verify Email Account</a>
            </div>

            <div style="border-top: 1px solid #eee; margin: 40px 0; padding-top: 40px; text-align: center;">
                <h3 style="margin: 0 0 10px 0; color: #1a1a1a;">Get the Mobile Experience</h3>
                <p style="font-size: 14px; color: #666; margin-bottom: 25px;">Download our Android app to track your orders on the go and receive real-time updates.</p>
                <a href="${appDownloadLink}" style="background-color: #28a745; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; display: inline-block;">Download Android APK</a>
            </div>
            
            <p style="font-size: 13px; color: #999; text-align: center; margin-top: 40px;">
                Note: For security reasons, you will be required to change your password upon your first login.
            </p>
        </div>
        
        <div style="background-color: #f1f1f1; padding: 25px; text-align: center; font-size: 12px; color: #777;">
            <p style="margin: 0;">&copy; ${new Date().getFullYear()} DarziFlow. All rights reserved.</p>
            <p style="margin: 8px 0 0;">This is an automated system message. Please do not reply directly to this email.</p>
        </div>
    </div>
    `;

    await sendEmail(email, "Your DarziFlow Account", emailContent);

    await sendNotificationToRoles({
        roles: ["ADMIN"],
        senderId: reqUserId,
        type: "USER_CREATE",
        title: "New User Registered",
        body: `A new user ${name} (${role}) has been created in the system.`,
        data: { screen: "/users" }
    });

    return newUser;
};

// Finds an existing user by ID or creates a new user (with duplicate email check).
export const findOrCreateClient = async ({ name, email, reqUserId, clientId = null }) => {
    if (clientId) {
        const user = await User.findById(clientId);
        if (!user || user.role !== 'CLIENT') {
            throw new Error('Selected client not found or is not a client.');
        }
        return user;
    }

    // New Client Logic: Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error(`A user with email ${email} already exists. Please select them from existing clients instead of creating a new account.`);
    }

    return await createNewUser({
        name,
        email,
        role: "CLIENT",
        reqUserId
    });
};
