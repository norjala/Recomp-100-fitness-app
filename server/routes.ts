import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertUserSchema, insertDexaScanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserWithStats(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User registration for competition
  app.post('/api/users/register', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userClaims = req.user.claims;
      
      const registrationData = insertUserSchema.extend({
        scanDate: z.string(),
        bodyFat: z.number(),
        leanMass: z.number(),
        scanImagePath: z.string().optional(),
      }).parse(req.body);

      // Create competition user profile
      const user = await storage.upsertUser({
        id: userId,
        email: userClaims.email,
        firstName: userClaims.first_name,
        lastName: userClaims.last_name,
        profileImageUrl: userClaims.profile_image_url,
      });

      // Update with competition data
      const competitionUser = await storage.createCompetitionUser({
        ...user,
        name: registrationData.name,
        gender: registrationData.gender,
        height: registrationData.height,
        startingWeight: registrationData.startingWeight,
      });

      // Create baseline DEXA scan
      await storage.createDexaScan({
        userId: competitionUser.id,
        scanDate: new Date(registrationData.scanDate),
        bodyFatPercent: registrationData.bodyFat,
        leanMass: registrationData.leanMass,
        totalWeight: registrationData.startingWeight,
        scanImagePath: registrationData.scanImagePath,
        isBaseline: true,
      });

      res.json({ user: competitionUser });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
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

  // Get user's DEXA scans
  app.get('/api/users/:userId/scans', isAuthenticated, async (req: any, res) => {
    try {
      const requestedUserId = req.params.userId;
      const currentUserId = req.user.claims.sub;
      
      // Users can only view their own scans
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

  // Create new DEXA scan
  app.post('/api/scans', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const scanData = insertDexaScanSchema.parse({
        ...req.body,
        userId,
        scanDate: new Date(req.body.scanDate),
      });

      const scan = await storage.createDexaScan(scanData);
      
      // Recalculate all scores after new scan
      await storage.recalculateAllScores();
      
      res.json(scan);
    } catch (error) {
      console.error("Error creating scan:", error);
      res.status(500).json({ message: "Failed to create scan" });
    }
  });

  // Object storage endpoints for DEXA scan uploads
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  app.put("/api/scan-images", isAuthenticated, async (req: any, res) => {
    if (!req.body.scanImageURL || !req.body.scanId) {
      return res.status(400).json({ error: "scanImageURL and scanId are required" });
    }

    const userId = req.user?.claims?.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.scanImageURL,
        {
          owner: userId,
          visibility: "private", // DEXA scans are private
        },
      );

      await storage.updateScanImagePath(req.body.scanId, objectPath);

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting scan image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Admin endpoint to recalculate all scores
  app.post('/api/admin/recalculate-scores', isAuthenticated, async (req: any, res) => {
    try {
      await storage.recalculateAllScores();
      res.json({ message: "Scores recalculated successfully" });
    } catch (error) {
      console.error("Error recalculating scores:", error);
      res.status(500).json({ message: "Failed to recalculate scores" });
    }
  });

  // Get user stats
  app.get('/api/users/:userId/stats', async (req, res) => {
    try {
      const userId = req.params.userId;
      const userStats = await storage.getUserWithStats(userId);
      
      if (!userStats) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(userStats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
