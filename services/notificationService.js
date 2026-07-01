import admin from "firebase-admin";
import Notification from "../models/Notifications.js";
import User from "../models/User.js";

export const createAndSendNotification = async ({
  recipientId,
  senderId = null,
  type,
  title,
  body,
  data = {}
}) => {
  try {
    const newNotification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      body,
      data
    });

    const user = await User.findById(recipientId).select("fcmTokens");
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      return newNotification;
    }

    const message = {
      notification: { title, body },
      data: {
        ...data,
        notificationId: newNotification._id.toString(),
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high",
        notification: {
          channelId: "high_importance_channel",
          sound: "default",
        }
      },
      apns: {
        payload: {
          aps: { sound: "default" }
        }
      },
      tokens: user.fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    //console.log(`FCM Summary: Sent: ${response.successCount}, Failed: ${response.failureCount}`);

    if (response.failureCount > 0) {
      const invalidTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          //  console.log(`Token ${idx} Error:`, resp.error.message);

          if (resp.error.code === 'messaging/registration-token-not-registered' ||
            resp.error.code === 'messaging/invalid-registration-token') {
            invalidTokens.push(user.fcmTokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        console.log(`Cleaning up ${invalidTokens.length} invalid tokens...`);
        await User.findByIdAndUpdate(recipientId, {
          $pull: { fcmTokens: { $in: invalidTokens } }
        });
      }
    }
    return newNotification;
  } catch (error) {
    console.error("Notification Error:", error);
  }
};

export const sendNotificationToRoles = async ({
  roles,
  departmentId = null,
  senderId = null,
  type,
  title,
  body,
  data = {}
}) => {
  try {
    const rolesToFilterByDept = roles.filter(r => r !== "ADMIN");
    const includesAdmin = roles.includes("ADMIN");

    let query = {};
    if (departmentId && rolesToFilterByDept.length > 0) {
      const conditions = [{ role: { $in: rolesToFilterByDept }, department: departmentId }];
      if (includesAdmin) {
        conditions.push({ role: "ADMIN" });
      }
      query.$or = conditions;
    } else {
      query.role = { $in: roles };
    }

    const recipients = await User.find(query).select("_id").lean();
    if (recipients.length === 0) return;

    await Promise.all(
      recipients.map(recipient =>
        createAndSendNotification({
          recipientId: recipient._id,
          senderId,
          type,
          title,
          body,
          data
        })
      )
    );
  } catch (error) {
    console.error("Error in sendNotificationToRoles:", error);
  }
};