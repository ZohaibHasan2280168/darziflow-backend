import { Schema, model } from 'mongoose';

const ChatRoomSchema = new Schema({
  name: { 
    type: String, 
    required: false 
  },
  type: { 
    type: String, 
    enum: ['direct', 'group'], 
    default: 'direct' 
  },
  orderId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Order', 
    required: false 
  }, 
  participants: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }],
  lastMessage: { 
    type: Schema.Types.ObjectId, 
    ref: 'Message' 
  },
}, { timestamps: true }); 

export default model('ChatRoom', ChatRoomSchema);