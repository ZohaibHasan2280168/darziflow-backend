---
name: darziflow-socket-forensics
description: Workflow to forcefully debug silent failures in the Node.js Socket.io implementation where Flutter payloads are not saving to MongoDB.
---

# Forensic Trace: Socket Payload to MongoDB Save

## 📌 Context
Flutter is emitting the `send_message` event, but the `Message` collection in MongoDB remains completely empty. We suspect either an event name mismatch, a String vs Object parsing issue, or a silent Promise rejection in Mongoose. 

We need to add aggressive, foolproof logging to the backend to trace the exact lifecycle of the payload.

## 🛠️ Step 1: Add Raw Payload Inspection (`socketHandler.js`)

Agent, we must determine if the event is even reaching the server and what format it is in.

1. Open the file handling Socket.io connections (e.g., `socketHandler.js`).
2. Inside `io.on('connection')`, ensure there is a globally visible listener catch-all (or just specifically verify the event name matches Flutter EXACTLY).
3. At the very top of `socket.on('send_message', async (data) => { ... })`, inject this exact inspection block:
   ```javascript
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
       return;
     }
   }