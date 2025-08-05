import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { requireAuth, requireVerifiedEmail } from "./auth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { insertUserSchema, insertDexaScanSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup new auth system
  setupAuth(app);

  // User registration for competition
  app.post('/api/users/register', requireVerifiedEmail, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      const registrationData = insertUserSchema.extend({
        scanDate: z.string(),
        bodyFat: z.number(),
        leanMass: z.number(),
        scanImagePath: z.string().optional(),
      }).parse(req.body);

      // Update with competition data
      const competitionUser = await storage.createCompetitionUser({
        id: userId,
        email: req.user.email, // Add required email field
        password: req.user.password, // Add required password field
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
  app.get('/api/users/:userId/scans', requireAuth, async (req: any, res) => {
    try {
      const requestedUserId = req.params.userId;
      const currentUserId = req.user.id;
      
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

  // Get user's scoring data
  app.get('/api/scoring/:userId', requireAuth, async (req: any, res) => {
    try {
      const requestedUserId = req.params.userId;
      const currentUserId = req.user.id;
      
      // Users can only view their own scoring data
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
  app.post('/api/scans', requireVerifiedEmail, async (req: any, res) => {
    try {
      const userId = req.user.id;
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

  // Update DEXA scan
  app.put('/api/scans/:scanId', requireAuth, async (req: any, res) => {
    try {
      const scanId = req.params.scanId;
      const userId = req.user.id;
      
      // Verify scan belongs to user
      const existingScan = await storage.getDexaScan(scanId);
      if (!existingScan || existingScan.userId !== userId) {
        return res.status(404).json({ message: "Scan not found" });
      }

      const updateData = insertDexaScanSchema.partial().parse({
        ...req.body,
        scanDate: req.body.scanDate ? new Date(req.body.scanDate) : undefined,
      });

      const updatedScan = await storage.updateDexaScan(scanId, updateData);
      
      // Recalculate all scores after scan update
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
      
      // Verify scan belongs to user
      const existingScan = await storage.getDexaScan(scanId);
      if (!existingScan || existingScan.userId !== userId) {
        return res.status(404).json({ message: "Scan not found" });
      }

      await storage.deleteDexaScan(scanId);
      
      // Recalculate all scores after scan deletion
      await storage.recalculateAllScores();
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scan:", error);
      res.status(500).json({ message: "Failed to delete scan" });
    }
  });

  // Object storage endpoints for DEXA scan uploads
  app.get("/objects/:objectPath(*)", requireAuth, async (req: any, res) => {
    const userId = req.user?.id;
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

  app.post("/api/objects/upload", requireAuth, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  });

  // Extract DEXA scan data from uploaded image
  app.post("/api/extract-dexa-data", requireAuth, async (req: any, res) => {
    try {
      const { imageBase64 } = req.body;
      
      if (!imageBase64) {
        return res.status(400).json({ error: "imageBase64 is required" });
      }

      // Remove data URL prefix if present
      const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      
      const { extractDexaScanData } = await import("./openai");
      const extractedData = await extractDexaScanData(base64Data);
      
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

    const userId = req.user?.id;

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
  app.post('/api/admin/recalculate-scores', requireAuth, async (req: any, res) => {
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
