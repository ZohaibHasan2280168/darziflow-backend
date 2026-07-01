import ChatRoom from '../models/ChatRoom.js';
import Message from '../models/Message.js';
import User from '../models/User.js';


export const getOrCreateDirectRoom = async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user.id;
    
    if (!targetUserId) {
      return res.status(400).json({ success: false, message: "Target user ID is required." });
    }

    // Look for an existing direct room containing exactly both participants
    let room = await ChatRoom.findOne({
      type: 'direct',
      participants: { $all: [currentUserId, targetUserId], $size: 2 }
    });

    if (!room) {
      room = new ChatRoom({
        type: 'direct',
        participants: [currentUserId, targetUserId]
      });
      await room.save();
    }

    return res.status(200).json({ success: true, room });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getRecentChats = async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const rooms = await ChatRoom.find({ participants: currentUserId })
      .populate('participants', 'name role avatar') 
      .populate({
        path: 'lastMessage',
        populate: { path: 'sender', select: 'name role' }
      })
      .sort({ updatedAt: -1 }); 

    return res.status(200).json({ success: true, rooms });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const getChatMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;
    
    const messages = await Message.find({ chatRoomId: roomId })
      .populate('sender', 'name role avatar')
      .populate({
        path: 'replyTo',
        select: 'text media sender',
        populate: { path: 'sender', select: 'name' }
      })
      .populate('mentions', 'name')
      .sort({ createdAt: -1 }) // Sort descending to get newest first for pagination
      .skip(skip)
      .limit(limit);

    const chronologicalMessages = messages.reverse();

    return res.status(200).json({ success: true, messages: chronologicalMessages });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const searchGlobalUsers = async (req, res) => {
  try {
    const { query } = req.query;
    const currentUserId = req.user.id;

    if (!query) {
      return res.status(200).json({ success: true, users: [] });
    }

    // Search users by name (case-insensitive) excluding the current user
    const users = await User.find({
      _id: { $ne: currentUserId },
      name: { $regex: query, $options: 'i' }
    }).select('name role avatar');

    return res.status(200).json({ success: true, users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};