---
name: darziflow-global-user-search
description: Workflow to implement a global user search feature to initiate new direct chats when the user's recent chat list is empty. Covers adding the Node.js search endpoint and updating the Flutter GetX UI.
---

# Feature: Global User Search for New Chats

## 📌 Context
Currently, the `GET /api/chat/rooms` endpoint works perfectly, but for new users, it returns an empty array. We need a way for users to search the global database for other staff/clients and initiate a brand new 1-on-1 chat.

## 🛠️ Step 1: Backend Implementation (Node.js)

Agent, please add a new endpoint to search the global `User` collection. 

**1. Create the Controller (`chatController.js`)**
Add a new exported function `searchGlobalUsers`:
* Extract the `query` from `req.query`.
* Search the `User` model where the `name` matches the query (use regex for case-insensitive partial matches).
* **Crucial:** Exclude the currently logged-in user (`req.user.id`) from the results so they can't start a chat with themselves.
* Select only necessary fields (`name`, `role`, `avatar`).

**2. Register the Route (`chatRoutes.js`)**
Add this route *above* the `/:roomId` routes to prevent route collision:
`router.get('/users/search', protect, chatController.searchGlobalUsers);`

**Expected JSON Response:**
```json
{
  "success": true,
  "users": [
    { "_id": "647ef...", "name": "Ali", "role": "QC_MEMBER", "avatar": "url..." }
  ]
}