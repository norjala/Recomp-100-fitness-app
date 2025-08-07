import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { nanoid } from "nanoid";
import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import type { User, RegisterUser, LoginUser, ForgotPassword, ResetPassword } from "@shared/schema";

const scryptAsync = promisify(scrypt);

declare global {
  namespace Express {
    interface User extends Omit<import("@shared/schema").User, 'password'> {}
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
  // Session configuration
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));

  // Auth routes
  app.post("/api/register", async (req, res) => {
    try {
      const userData: RegisterUser = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash password and create verification token
      const hashedPassword = await hashPassword(userData.password);
      const verificationToken = generateToken();

      // Create user
      const user = await storage.createUser({
        email: userData.email,
        password: hashedPassword,
        emailVerificationToken: verificationToken,
      });

      // Send verification email (with development bypass)
      const emailSent = await sendVerificationEmail(user.email, verificationToken);
      if (!emailSent) {
        console.error("Failed to send verification email");
        // In development, auto-verify email if SendGrid fails
        if (process.env.NODE_ENV === "development") {
          await storage.verifyUserEmail(user.id);
          return res.status(201).json({ 
            message: "Account created and automatically verified (development mode). You can now log in.",
            requiresVerification: false 
          });
        }
      }

      res.status(201).json({ 
        message: "Account created successfully. Please check your email to verify your account.",
        requiresVerification: true 
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password }: LoginUser = req.body;

      const user = await storage.getUserByEmail(email);
      if (!user || !(await comparePasswords(password, user.password))) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.isEmailVerified) {
        return res.status(401).json({ 
          message: "Please verify your email address before logging in",
          requiresVerification: true 
        });
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
    
    // Fetch fresh user data from database to get updated fields like firstName/lastName
    try {
      const freshUser = await storage.getUser(sessionUser.id);
      if (!freshUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(freshUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      
      // Development bypass for testing
      if (process.env.NODE_ENV === "development" && token === "dev-bypass") {
        const sessionUser = (req.session as any)?.user;
        if (sessionUser && sessionUser.email) {
          await storage.verifyUserEmail(sessionUser.id);
          (req.session as any).user = { ...sessionUser, isEmailVerified: true };
          return res.json({ message: "Email verified successfully (dev bypass)" });
        }
        
        // Also allow specific test emails
        const testEmails = ["test@example.com", "nrj.prolific@gmail.com"];
        for (const email of testEmails) {
          const testUser = await storage.getUserByEmail(email);
          if (testUser) {
            await storage.verifyUserEmail(testUser.id);
            (req.session as any).user = { ...testUser, isEmailVerified: true };
            return res.json({ message: "Email verified successfully (dev bypass)" });
          }
        }
      }
      
      const user = await storage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }

      await storage.verifyUserEmail(user.id);
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email }: ForgotPassword = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Don't reveal whether email exists
        return res.json({ message: "If that email exists, we've sent a password reset link" });
      }

      const resetToken = generateToken();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.setPasswordResetToken(user.id, resetToken, resetExpires);
      
      const emailSent = await sendPasswordResetEmail(user.email, resetToken);
      if (!emailSent) {
        console.error("Failed to send password reset email");
      }

      res.json({ message: "If that email exists, we've sent a password reset link" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password }: ResetPassword = req.body;
      
      const user = await storage.getUserByResetToken(token);
      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const hashedPassword = await hashPassword(password);
      await storage.resetPassword(user.id, hashedPassword);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      const verificationToken = generateToken();
      await storage.updateVerificationToken(user.id, verificationToken);
      
      const emailSent = await sendVerificationEmail(user.email, verificationToken);
      if (!emailSent) {
        console.error("Failed to send verification email");
        return res.status(500).json({ message: "Failed to send verification email" });
      }

      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Resend verification error:", error);
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

export const requireVerifiedEmail: RequestHandler = (req: any, res, next) => {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!user.isEmailVerified) {
    return res.status(401).json({ 
      message: "Email verification required",
      requiresVerification: true 
    });
  }
  req.user = user;
  next();
};