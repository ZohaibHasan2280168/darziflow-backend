import { Schema, model } from 'mongoose';

const MessageSchema = new Schema({
  chatRoomId: { 
    type: Schema.Types.ObjectId, 
    ref: 'ChatRoom', 
    required: true 
  },
  sender: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  text: { 
    type: String, 
    default: "" 
  },
  media: [{
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video', 'document'], required: true }
  }],
  replyTo: { 
    type: Schema.Types.ObjectId, 
    ref: 'Message', 
    default: null 
  }, 
  mentions: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }], 
  readBy: [{ 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  }]
}, { timestamps: true }); 

export default model('Message', MessageSchema);