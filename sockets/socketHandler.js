import { Server } from 'socket.io';
import Message from '../models/Message.js';
import ChatRoom from '../models/ChatRoom.js';
import { protectSocket } from '../middleware/socketMiddleware.js'; 


export const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    io.use(protectSocket);

    io.on('connection', (socket) => {

        console.log(`User Connected: ${socket.user.name} (${socket.id})`);

        socket.on('join_room', (data) => {
            const roomId = (typeof data === 'object' && data !== null) ? (data.roomId || data.chatRoomId) : data;
            if (roomId) {
                socket.join(roomId);
                console.log(`User ${socket.id} joined room: ${roomId}`);
            } else {
                console.error("❌ [SOCKET ERROR] join_room called with invalid roomId:", data);
            }
        });

        socket.on('leave_room', (data) => {
            const roomId = (typeof data === 'object' && data !== null) ? (data.roomId || data.chatRoomId) : data;
            if (roomId) {
                socket.leave(roomId);
                console.log(`User ${socket.id} left room: ${roomId}`);
            }
        });

        socket.on('send_message', async (data) => {
            console.log("=========================================");
            console.log("🚨 [TRACE 1] send_message event triggered!");
            console.log("🚨 [TRACE 2] Data Type:", typeof data);
            console.log("🚨 [TRACE 3] Raw Payload:", data);
            
            // Failsafe: If Flutter sent a stringified JSON instead of a raw map, parse it.
            let parsedData = data;
            if (typeof data === 'string') {
                try {
                    parsedData = JSON.parse(data);
                    console.log("🚨 [TRACE 4] Successfully parsed string payload to object.");
                } catch (e) {
                    console.error("❌ [FATAL] Payload is a string but NOT valid JSON:", e.message);
                    socket.emit('message_error', { error: "Payload is not a valid JSON string." });
                    return;
                }
            }

            try {
                const { chatRoomId, senderId, text, media, replyTo, mentions } = parsedData;

                const messagePayload = {
                    chatRoomId,
                    sender: senderId || (socket.user ? socket.user._id : null),
                    text,
                    media: media || [],
                    mentions: mentions || []
                };
                
                if (replyTo) {
                    messagePayload.replyTo = replyTo;
                }

                console.log("🚨 [TRACE 5] Message Payload constructed:", messagePayload);

                const newMessage = new Message(messagePayload);

                console.log("🚨 [TRACE 6] Saving message to database...");
                // 1. Save the message (you already have this)
                const savedMessage = await newMessage.save();
                console.log("🚨 [TRACE 7] Message saved successfully. ID:", savedMessage._id);

                console.log("🚨 [TRACE 8] Updating ChatRoom lastMessage...");
                await ChatRoom.findByIdAndUpdate(chatRoomId, {
                    lastMessage: savedMessage._id
                });
                console.log("🚨 [TRACE 9] ChatRoom updated.");

                // 2. Populate the message data so the Flutter UI knows who sent it
                const populatedMessage = await Message.findById(savedMessage._id)
                    .populate('sender', 'name role avatar')
                    .populate({
                        path: 'replyTo',
                        select: 'text media sender',
                        populate: { path: 'sender', select: 'name' }
                    })
                    .populate('mentions', 'name');

                // 3. Broadcast it back to the room (This is the magic line that triggers Flutter!)
                io.to(parsedData.chatRoomId).emit('receive_message', populatedMessage);

                console.log("✅ [SOCKET] Broadcasted receive_message to room:", parsedData.chatRoomId);

                // TODO: Trigger FCM Notification logic here for offline participants
                // await triggerFCMForRoom(chatRoomId, senderId, text);

            } catch (error) {
                console.error("❌ Socket error processing message:", error);
                socket.emit('message_error', { error: "Failed to send message." });
            }
        });

        socket.on('typing', (data) => {
            const { chatRoomId, userName } = data;
            socket.to(chatRoomId).emit('user_typing', { userName });
        });

        socket.on('disconnect', () => {
            console.log(`User Disconnected: ${socket.id}`);
        });
    });

    return io;
};