import express from "express";
import http from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import admin from "firebase-admin";
import fs from "fs";
import { initSocket } from './sockets/socketHandler.js';

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import DepartmentRoutes from "./routes/DepartmentRoutes.js";
import operationRoutes from "./routes/operationRoutes.js";
import userRoutes from "./routes/userRoute.js";
import checkpointRoutes from "./routes/checkpointRoutes.js";
import orderRoutes from "./routes/order/orderRoutes.js";
import workflowRoutes from "./routes/order/workflowRoutes.js";
import orderCheckpointRoutes from "./routes/order/checkpointRoutes.js";
import auditRoutes from './routes/auditRoutes.js';
import statRoutes from './routes/statRoutes.js';
import clientRoutes from "./routes/clientRoutes.js";
import uploadRoute from "./routes/uploadRoute.js";
import NotificationRoutes from "./routes/NotificationRoutes.js";
import carouselRoutes from "./routes/carouselRoutes.js";
import orderRequestRoutes from "./routes/orderRequestRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";


dotenv.config();

//connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser());

const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    }
  },
  credentials: true,
  exposedHeaders: ["x-access-token"],
}));

app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 
app.use(cookieParser()); 

// Helmet settings 
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(morgan("dev"));

// Read Firebase credentials from env var (Render/Vercel) or fall back to local file (dev)
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  serviceAccount = JSON.parse(
    fs.readFileSync("./config/serviceAccountKey.json", "utf-8")
  );
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.set('socketio', io);

//ROUTES

app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/users", userRoutes);
app.use("/api/departments", DepartmentRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/workflow", workflowRoutes);
app.use("/api/checkpoints", orderCheckpointRoutes);
app.use("/api/", operationRoutes);
app.use("/api/", checkpointRoutes);
app.use("/api/chat", chatRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/stats', statRoutes);
app.use("/api/upload", uploadRoute);
app.use("/api/notifications", NotificationRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/carousel", carouselRoutes);
app.use("/api/requests", orderRequestRoutes);


// Default route
app.get("/", (req, res) => {
  res.send("API is running...")
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});