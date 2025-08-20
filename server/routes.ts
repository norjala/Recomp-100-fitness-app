import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { requireAuth, hashPassword } from "./auth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { insertUserSchema, insertDexaScanSchema } from "@shared/schema";
import { getAdminUsernames } from "./config";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth system
  setupAuth(app);

  // User registration for competition
  app.post('/api/users/register', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const registrationData = insertUserSchema.extend({
        scanDate: z.string(),
        bodyFat: z.number(),
        leanMass: z.number(),
        scanImagePath: z.string().optional(),
      }).parse(req.body);

      // Update with competition data
      const competitionUser = await storage.updateUser(userId, {
        name: registrationData.name,
        gender: registrationData.gender,
        height: registrationData.height,
        startingWeight: registrationData.startingWeight,
        targetBodyFatPercent: registrationData.targetBodyFatPercent,
        targetLeanMass: registrationData.targetLeanMass,
      });

      // Create baseline DEXA scan
      await storage.createDexaScan({
        userId: competitionUser.id,
        scanDate: new Date(registrationData.scanDate),
        bodyFatPercent: registrationData.bodyFat,
        leanMass: registrationData.leanMass,
        totalWeight: registrationData.startingWeight || 0,
        fatMass: (registrationData.bodyFat / 100) * (registrationData.startingWeight || 0),
        scanImagePath: registrationData.scanImagePath,
        isBaseline: true,
      });

      res.json({ user: competitionUser });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Update user target goals
  app.put('/api/user/targets', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { targetBodyFatPercent, targetLeanMass } = req.body;
      
      const updates: any = {};
      if (targetBodyFatPercent !== undefined && targetBodyFatPercent !== null && targetBodyFatPercent !== '') {
        updates.targetBodyFatPercent = Number(targetBodyFatPercent);
      }
      if (targetLeanMass !== undefined && targetLeanMass !== null && targetLeanMass !== '') {
        updates.targetLeanMass = Number(targetLeanMass);
      }
      
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "At least one target goal must be provided" });
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user targets:", error);
      res.status(500).json({ message: "Failed to update target goals" });
    }
  });

  // Get leaderboard
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Get contestants data
  app.get('/api/contestants', async (req, res) => {
    try {
      const contestants = await storage.getContestants();
      res.json(contestants);
    } catch (error) {
      console.error("Error fetching contestants:", error);
      res.status(500).json({ message: "Failed to fetch contestants" });
    }
  });

  // Get user's DEXA scans
  app.get('/api/users/:userId/scans', requireAuth, async (req: any, res) => {
    try {
      const requestedUserId = req.params.userId;
      const currentUserId = req.user.id;
      
      if (requestedUserId !== currentUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const scans = await storage.getUserScans(requestedUserId);
      res.json(scans);
    } catch (error) {
      console.error("Error fetching user scans:", error);
      res.status(500).json({ message: "Failed to fetch scans" });
    }
  });

  // Get user's scoring data
  app.get('/api/scoring/:userId', requireAuth, async (req: any, res) => {
    try {
      const requestedUserId = req.params.userId;
      const currentUserId = req.user.id;
      
      if (requestedUserId !== currentUserId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const scoring = await storage.getScoringData(requestedUserId);
      res.json(scoring);
    } catch (error) {
      console.error("Error fetching user scoring:", error);
      res.status(500).json({ message: "Failed to fetch scoring data" });
    }
  });

  // Create new DEXA scan
  app.post('/api/scans', requireAuth, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const scanData = insertDexaScanSchema.parse({
        ...req.body,
        userId,
        scanDate: new Date(req.body.scanDate),
      });

      const scan = await storage.createDexaScan(scanData);
      
      // Update user profile with name if provided
      if (req.body.firstName && req.body.lastName) {
        try {
          await storage.updateUser(userId, {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            name: `${req.body.firstName} ${req.body.lastName}`,
          });
        } catch (error) {
          console.error("Error updating user name:", error);
        }
      }
      
      // Recalculate scores
      await storage.recalculateAllScores();
      
      res.json(scan);
    } catch (error) {
      console.error("Error creating scan:", error);
      res.status(500).json({ message: "Failed to create scan" });
    }
  });

  // Update DEXA scan
  app.put('/api/scans/:scanId', requireAuth, async (req: any, res) => {
    try {
      const scanId = req.params.scanId;
      const userId = req.user.id;
      
      const existingScan = await storage.getDexaScan(scanId);
      if (!existingScan || existingScan.userId !== userId) {
        return res.status(404).json({ message: "Scan not found" });
      }

      const updateData = insertDexaScanSchema.partial().parse({
        ...req.body,
        scanDate: req.body.scanDate ? new Date(req.body.scanDate) : undefined,
      });

      const updatedScan = await storage.updateDexaScan(scanId, updateData);
      
      // Update user profile if name provided
      if (req.body.firstName && req.body.lastName) {
        try {
          await storage.updateUser(userId, {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            name: `${req.body.firstName} ${req.body.lastName}`,
          });
        } catch (error) {
          console.error("Error updating user name:", error);
        }
      }
      
      await storage.recalculateAllScores();
      res.json(updatedScan);
    } catch (error) {
      console.error("Error updating scan:", error);
      res.status(500).json({ message: "Failed to update scan" });
    }
  });

  // Delete DEXA scan
  app.delete('/api/scans/:scanId', requireAuth, async (req: any, res) => {
    try {
      const scanId = req.params.scanId;
      const userId = req.user.id;
      
      const existingScan = await storage.getDexaScan(scanId);
      if (!existingScan || existingScan.userId !== userId) {
        return res.status(404).json({ message: "Scan not found" });
      }

      await storage.deleteDexaScan(scanId);
      await storage.recalculateAllScores();
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scan:", error);
      res.status(500).json({ message: "Failed to delete scan" });
    }
  });

  // Simplified object storage for Bolt
  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // Simplified DEXA data extraction for Bolt
  app.post("/api/extract-dexa-data", requireAuth, async (req: any, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      // Import extraction functions
      const { extractDexaScanFromImage, extractDexaScanFromPDF } = await import("./openai");
      
      let extractedData;
      if (imageBase64.startsWith('data:application/pdf')) {
        extractedData = await extractDexaScanFromPDF(imageBase64);
      } else {
        extractedData = await extractDexaScanFromImage(imageBase64);
      }
      
      res.json(extractedData);
    } catch (error) {
      console.error("Error extracting DEXA data:", error);
      res.status(500).json({ error: "Failed to extract DEXA scan data" });
    }
  });

  app.put("/api/scan-images", requireAuth, async (req: any, res) => {
    if (!req.body.scanImageURL || !req.body.scanId) {
      return res.status(400).json({ error: "scanImageURL and scanId are required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.scanImageURL,
        { owner: req.user?.id, visibility: "private" }
      );

      await storage.updateScanImagePath(req.body.scanId, objectPath);
      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting scan image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin routes
  const requireAdmin = (req: any, res: any, next: any) => {
    const adminUsernames = getAdminUsernames();
    
    if (!req.user || !adminUsernames.includes(req.user.username)) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  app.get('/api/admin/users', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.post('/api/admin/users', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { username, password, name } = req.body;
      
      if (!password || !username) {
        return res.status(400).json({ message: "Username and password required" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.adminCreateUser({
        username,
        password: hashedPassword,
        name: name || undefined,
      });
      
      res.status(201).json(user);
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === '23505') {
        res.status(400).json({ message: "Username already exists" });
      } else {
        res.status(500).json({ message: "Failed to create user" });
      }
    }
  });

  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const updates = req.body;
      
      delete updates.id;
      delete updates.password;
      
      const user = await storage.adminUpdateUser(userId, updates);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      if (userId === req.user.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.post('/api/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const tempPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await hashPassword(tempPassword);
      
      await storage.adminUpdateUser(userId, { password: hashedPassword });
      res.json({ message: `Password reset. Temporary password: ${tempPassword}` });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Health check endpoints
  app.get('/health', async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/health', async (req, res) => {
    try {
      // Test database connection
      const userCount = await storage.getAllUsers().then(users => users.length);
      const allScans = await storage.getAllScans();
      const scanCount = allScans.length;
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: true,
          userCount,
          scanCount
        },
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
        }
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({ 
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}