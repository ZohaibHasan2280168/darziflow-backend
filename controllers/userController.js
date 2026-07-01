import User from '../models/User.js';
import { sendEmail } from '../utils/mailer.js';
import { logAction } from "../utils/auditLogger.js";
import { createAndSendNotification, sendNotificationToRoles } from '../services/notificationService.js';
import { createNewUser } from '../services/userService.js';

const fetchUsers = async (req, res) => {
  try {
    // fetch all users, excluding password
    const users = await User.find().select("-password");

    // aggregate role-based stats
    const roleStats = await User.aggregate([
      { $group: { _id: "$role", count: { $sum: 1 } } }
    ]);

    // format roleStats into an object like { ADMIN: 3, MODERATOR: 5, USER: 20 }
    const roleCounts = roleStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.json({
      message: "Users fetched successfully",
      users,
      stats: {
        totalUsers: users.length,
        roles: roleCounts
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};


const fetchUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).select("-password -__v -emailVerificationToken");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "User fetched successfully",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getAvailableDepartmentHeads = async () => {
  try {
    const users = await User.find({
      role: "DEPARTMENT_HEAD",
      department: null
    })
      .select("_id name role department")
      .lean();
    return users;
  } catch (error) {
    throw new Error("Error fetching available department heads");
  }
};

const getQCMembers = async () => {
  try {
    const users = await User.find({
      role: "QC_MEMBER"
    })
      .select("_id name email role")
      .lean();
    return users;
  } catch (error) {
    throw new Error("Error fetching QC members");
  }
};


const createUser = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = await createNewUser({
      name,
      email,
      role,
      reqUserId: req.user._id
    });

    await logAction(req, {
      action: "USER_CREATE",
      performedBy: req.user._id,
      details: `Created user account for ${email}`,
      priority: "success"
    });

    res.status(201).json({
      message: "User created and credentials sent via email",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role
      }
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const updateUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;

    await user.save();

    // Send updated credentials if password or email changed
    if (password || email || name) {
      const emailContent = `
        <h2>Your Account on DarziFlow has been updated</h2>
        <p>Hello ${user.name},</p>
        <p>Your login details:</p>
        <ul>
          <li><strong>Name:</strong> ${user.name}</li>
          <li><strong>Email:</strong> ${user.email}</li>
          <li><strong>Password:</strong> ${password}</li>
        </ul>
       <p>Please login and update your password if needed.</p>
      `;
      await sendEmail(user.email, "Your Account Credentials Updated", emailContent);
    }

    await sendNotificationToRoles({
      roles: ["ADMIN"],
      senderId: req.user._id,
      type: "USER_UPDATE",
      title: "User Updated",
      body: `User '${user.name}' has been updated.`,
      data: { screen: "/users" }
    });

    res.json({ message: "User updated successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await user.deleteOne();

    await sendNotificationToRoles({
      roles: ["ADMIN"],
      senderId: req.user._id,
      type: "USER_DELETE",
      title: "User Deleted",
      body: `User '${user.name}' (${user.role}) has been deleted.`,
      data: { screen: "/users" }
    });

    res.json({ message: `User '${user.name}' (${user.role}) deleted successfully.` });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export { createUser, updateUser, deleteUser, fetchUsers, fetchUserById, getAvailableDepartmentHeads, getQCMembers };