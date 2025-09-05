import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { nanoid } from "nanoid";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import { storage } from "./storage.js";
import type { User, RegisterUser, LoginUser } from "../shared/schema.js";

const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User extends Omit<import("../shared/schema.js").User, 'password'> {}
  }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function generateToken(): string {
  return nanoid(32);
}

export function setupAuth(app: Express) {
  // Production-ready session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Warn about MemoryStore in production (but it's acceptable for 10 users)
  if (process.env.NODE_ENV === "production") {
    console.log("⚠️  Using MemoryStore for sessions (acceptable for 10 users)");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "bolt-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    name: "recomp.sid", // Custom session name for security
    cookie: {
      httpOnly: true,
      // Allow HTTP for localhost testing, but require HTTPS for production domains
      secure: process.env.NODE_ENV === "production" && !process.env.ALLOW_HTTP_LOCALHOST,
      maxAge: sessionTtl,
      sameSite: "lax", // Use lax for better compatibility
    },
    // Add rolling sessions - extend session on activity
    rolling: true,
  };

  // Important: Trust Render's proxy
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));

  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const userData: RegisterUser = req.body;
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ 
          message: "Username already exists" 
        });
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(userData.password);
      const newUser = await storage.createUser({
        username: userData.username,
        password: hashedPassword,
      });

      // Auto-login after registration
      const { password: _, ...userWithoutPassword } = newUser;
      (req.session as any).user = userWithoutPassword;

      return res.status(201).json({ 
        message: "Account created successfully", 
        user: userWithoutPassword 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password }: LoginUser = req.body;

      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Store user in session (excluding password)
      const { password: _, ...userWithoutPassword } = user;
      (req.session as any).user = userWithoutPassword;

      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", async (req, res) => {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Fetch fresh user data from database
    try {
      const freshUser = await storage.getUser(sessionUser.id);
      if (!freshUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = freshUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

export const requireAuth: RequestHandler = (req: any, res, next) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  req.user = user;
  next();
};