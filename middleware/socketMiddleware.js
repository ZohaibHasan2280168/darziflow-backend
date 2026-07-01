import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const protectSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    socket.user = user; 
    next(); 

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new Error("TokenExpiredError"));
    }
    return next(new Error("Authentication error: Invalid token"));
  }
};