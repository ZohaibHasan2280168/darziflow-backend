import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateAccessToken } from "../utils/authUtill.js";

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  } 
  else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }

    return next(); 
  } catch (error) {

    if (error.name === "TokenExpiredError") {
      try {
        const refreshToken = req.cookies?.refreshToken || req.headers["x-refresh-token"];

        if (!refreshToken) {
          return res.status(401).json({ message: "Session expired, refresh token required" });
        }
        const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decodedRefresh.id).select("-password");

        if (!user) {
          return res.status(401).json({ message: "User not found" });
        }

        const newAccessToken = generateAccessToken(user);

        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 30 * 60 * 1000, // 30 min
          path: '/',
        });

        res.setHeader("x-access-token", newAccessToken);
        req.user = user;

        return next(); 
      } catch (refreshErr) {
        return res.status(401).json({ message: "Session expired, please login again" });
      }
    }

    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};


export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
