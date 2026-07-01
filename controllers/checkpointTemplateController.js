import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Department from "../models/Department.js";
import {logAction} from "../utils/auditLogger.js";
import { createAndSendNotification, sendNotificationToRoles } from "../services/notificationService.js";
import User from '../models/User.js';


export const createCheckpoint = asyncHandler(async (req, res) => {
  const department = await Department.findOneAndUpdate(
    { "operations._id": req.params.opId },
    { $push: { "operations.$.checkpoints": req.body } },
    { new: true, runValidators: true }
  );

  if (!department) {
    return res.status(404).json({ message: "Operation not found" });
  }

  const operation = department.operations.find(
    (op) => op._id.toString() === req.params.opId
  );

  const newCheckpoint = operation.checkpoints.at(-1);

    await sendNotificationToRoles({
      roles: ["ADMIN", "DEPARTMENT_HEAD"],
      departmentId: department._id,
      senderId: req.user._id,
      type: "CHK_CREATE",
      title: "New Checkpoint Added ",
      body: `A new checkpoint "${newCheckpoint.name}" has been added to ${operation.name}.`,
      data: {
        deptId: department._id.toString(),
        screen: "/dept-head-dashboard" 
      }
    });

  await logAction(req, {
    action: "CHK_CREATE",
    deptId: department._id,
    performedBy: req.user._id,
    details: `Created new checkpoint in operation ${operation.name}`,
    priority: "info"
  });

  res.status(201).json(newCheckpoint);
});

export const updateCheckpoint = asyncHandler(async (req, res) => {
  const { deptId, opId, chkId } = req.params;

  if (!Object.keys(req.body).length) {
    return res.status(400).json({ message: "Update body cannot be empty" });
  }

  const updateFields = {};
  for (const key in req.body) {
    updateFields[`operations.$[op].checkpoints.$[chk].${key}`] = req.body[key];
  }

  const department = await Department.findOneAndUpdate(
    { _id: deptId },
    { $set: updateFields },
    {
      new: true,
      runValidators: true,
      arrayFilters: [
        { "op._id": new mongoose.Types.ObjectId(opId) },
        { "chk._id": new mongoose.Types.ObjectId(chkId) }
      ],
      context: "query"
    }
  );

  if (!department) {
    return res.status(404).json({ message: "Department not found" });
  }

  const operation = department.operations.id(opId);
  const checkpoint = operation.checkpoints.id(chkId);

    await sendNotificationToRoles({
      roles: ["ADMIN", "DEPARTMENT_HEAD"],
      departmentId: department._id,
      senderId: req.user._id,
      type: "CHK_UPDATE",
      title: "Checkpoint Updated",
      body: `The requirements for "${checkpoint.name}" in ${operation.name} have been updated.`,
      data: {
        deptId: department._id.toString(),
        screen: "/dept-head-dashboard"
      }
    });

  await logAction(req, {
    action: "CHK_UPDATE",
    deptId: department._id,
    performedBy: req.user._id,
    details: `Updated checkpoint in operation ${operation.name}`,
    priority: "info"
  });

  res.status(200).json(checkpoint);
});

export const deleteCheckpoint = asyncHandler(async (req, res) => {
  const department = await Department.findOneAndUpdate(
    { "operations.checkpoints._id": req.params.chkId },
    {
      $pull: {
        "operations.$[].checkpoints": { _id: req.params.chkId }
      }
    },
    { new: true }
  );

  if (!department) {
    return res.status(404).json({ message: "Checkpoint not found" });
  }

    await sendNotificationToRoles({
      roles: ["ADMIN", "DEPARTMENT_HEAD"],
      departmentId: department._id,
      senderId: req.user._id,
      type: "CHK_DELETE",
      title: "Checkpoint Removed 🗑️",
      body: `A checkpoint was removed from the ${department.name} workflow.`,
      data: {
        deptId: department._id.toString(),
        screen: "/dept-head-dashboard"
      }
    });

  await logAction(req, {
    action: "CHK_DELETE",
    deptId: department._id,
    performedBy: req.user._id,
    details: `Deleted checkpoint in department ${department.name}`,
    priority: "info"
  });

  res.status(200).json({ message: "Checkpoint deleted successfully" });
});
