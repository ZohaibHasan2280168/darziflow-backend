import asyncHandler from "express-async-handler";
import Department from "../models/Department.js";
import { createOperationSchema, updateOperationSchema } from "../validations/departmentValidation.js";
import {logAction} from "../utils/auditLogger.js";
import { createAndSendNotification, sendNotificationToRoles } from "../services/notificationService.js";

export const createOperation = asyncHandler(async (req, res) => {
  const { error, value } = createOperationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const department = await Department.findByIdAndUpdate(
    req.params.deptId,
    { $push: { operations: value } },
    { new: true, runValidators: true }
  );

  if (!department) {
    return res.status(404).json({ message: "Department not found" });
  }

  const newOperation = department.operations.at(-1);

    await sendNotificationToRoles({
      roles: ["ADMIN", "DEPARTMENT_HEAD"],
      departmentId: department._id,
      senderId: req.user._id,
      type: "OP_CREATE",
      title: "New Operation Added",
      body: `A new operation "${value.name}" has been added to the ${department.name} department.`,
      data: {
        deptId: department._id.toString(),
        screen: "/dept-head-dashboard"
      }
    });

  await logAction(req, {
    action: "OP_CREATE",
    deptId: department._id,
    performedBy: req.user._id,
    details: `Created new operation in department ${department.name}`,
    priority: "info"
  });

  res.status(201).json(newOperation);
});

export const updateOperation = asyncHandler(async (req, res) => {
  const { error, value } = updateOperationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const department = await Department.findOneAndUpdate(
    { "operations._id": req.params.opId },
    {
      $set: {
        "operations.$.name": value.name,
        "operations.$.description": value.description
      }
    },
    { new: true, runValidators: true }
  );

  if (!department) {
    return res.status(404).json({ message: "Operation not found" });
  }

  const updatedOperation = department.operations.find(
    op => op._id.toString() === req.params.opId
  );

    await sendNotificationToRoles({
      roles: ["ADMIN", "DEPARTMENT_HEAD"],
      departmentId: department._id,
      senderId: req.user._id,
      type: "OP_UPDATE",
      title: "Operation Updated",
      body: `The operation "${updatedOperation.name}" in ${department.name} has been modified.`,
      data: {
        deptId: department._id.toString(),
        screen: "/dept-head-dashboard"
      }
    });

  await logAction(req, {
    action: "OP_UPDATE",
    deptId: department._id,
    performedBy: req.user._id,
    details: `Updated operation in department ${department.name}`,
    priority: "info"
  });

  res.status(200).json(updatedOperation);
});

export const deleteOperation = asyncHandler(async (req, res) => {
  const department = await Department.findOneAndUpdate(
    { "operations._id": req.params.opId },
    { $pull: { operations: { _id: req.params.opId } } },
    { new: true }
  );

  if (!department) {
    return res.status(404).json({ message: "Operation not found" });
  }

    await sendNotificationToRoles({
      roles: ["ADMIN", "DEPARTMENT_HEAD"],
      departmentId: department._id,
      senderId: req.user._id,
      type: "OP_DELETE",
      title: "Operation Removed 🗑️",
      body: `An operation has been removed from the ${department.name} department.`,
      data: {
        deptId: department._id.toString(),
        screen: "/dept-head-dashboard"
      }
    });

  await logAction(req, {
    action: "OP_DELETE",
    deptId: department._id,
    performedBy: req.user._id,
    details: `Deleted operation in department ${department.name}`,
    priority: "info"
  });

  res.status(200).json({ message: "Operation deleted successfully" });
});