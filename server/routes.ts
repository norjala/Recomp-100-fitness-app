import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage.js";
import { setupAuth } from "./auth.js";
import { requireAuth, hashPassword } from "./auth.js";
import { ObjectStorageService, ObjectNotFoundError, objectStorage } from "./objectStorage.js";
import { insertUserSchema, insertDexaScanSchema } from "../shared/schema.js";
import { getAdminUsernames, getConfig } from "./config.js";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth system
  setupAuth(app);

  // Configure multer for file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: getConfig().MAX_FILE_SIZE, // Use config for file size limit
    },
    fileFilter: (req, file, cb) => {
      const isValidType = objectStorage.validateFileType(file.mimetype);
      if (isValidType) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type: ${file.mimetype}`));
      }
    }
  });

  // User registration for competition with enhanced error handling
  app.post('/api/users/register', requireAuth, async (req: any, res) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
      console.log(`🎆 [${requestId}] POST /api/users/register - User competition registration`);
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
      const duration = Date.now() - startTime;
      console.error(`❌ [${requestId}] Error registering user after ${duration}ms:`, error);
      
      if (res.headersSent) {
        console.error(`⚠️ [${requestId}] Response already sent, cannot send error response`);
        return;
      }
      
      let statusCode = 500;
      let userMessage = "Failed to register for competition";
      let errorCode = "REGISTRATION_FAILED";
      
      if (error instanceof Error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          statusCode = 409;
          userMessage = "User already registered or duplicate data detected";
          errorCode = "DUPLICATE_REGISTRATION";
        }
      }
      
      res.status(statusCode).json({ 
        message: userMessage,
        error: errorCode,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
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

  // Get leaderboard with caching and error handling
  app.get('/api/leaderboard', async (req, res) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
      console.log(`🏆 [${requestId}] GET /api/leaderboard - Fetching competition leaderboard`);
      const leaderboard = await storage.getLeaderboard();
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${requestId}] Leaderboard fetched successfully in ${duration}ms (${leaderboard.length} contestants)`);
      
      res.json({
        ...leaderboard,
        _meta: {
          requestId: requestId,
          timestamp: new Date().toISOString(),
          processingTimeMs: duration,
          totalContestants: Array.isArray(leaderboard) ? leaderboard.length : 0
        }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${requestId}] Error fetching leaderboard after ${duration}ms:`, error);
      
      if (res.headersSent) {
        return;
      }
      
      res.status(500).json({ 
        message: "Failed to fetch leaderboard",
        error: "LEADERBOARD_FETCH_FAILED",
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
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

  // Create new DEXA scan with comprehensive error handling
  app.post('/api/scans', requireAuth, async (req: any, res) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
      console.log(`📊 [${requestId}] POST /api/scans - Creating new DEXA scan`);
      console.log(`📊 [${requestId}] Request body:`, JSON.stringify(req.body, null, 2));
      console.log(`📊 [${requestId}] User from session:`, JSON.stringify(req.user, null, 2));
      
      // Pre-flight database health check
      try {
        const { getDatabaseHealthStatus } = await import('./db.js');
        const dbHealth = await getDatabaseHealthStatus();
        if (dbHealth.status !== 'healthy') {
          console.error(`❌ [${requestId}] Database health check failed:`, dbHealth);
          return res.status(503).json({
            message: "Database is currently unavailable",
            error: "DATABASE_UNHEALTHY",
            details: dbHealth.issues || ['Database connection issues']
          });
        }
        console.log(`✅ [${requestId}] Database health check passed`);
      } catch (healthError) {
        console.error(`⚠️ [${requestId}] Could not perform database health check:`, healthError);
        // Continue - don't block on health check failure
      }
      
      const userId = req.user.id;
      
      // Enhanced user verification with database connection diagnostics
      let userExists;
      try {
        console.log(`🔍 [${requestId}] Verifying user exists in database...`);
        userExists = await storage.getUser(userId);
        if (!userExists) {
          console.error(`❌ [${requestId}] User ${userId} exists in session but not in database!`);
          console.error(`❌ [${requestId}] This typically happens when:`);
          console.error(`   - Database was reset but session persisted`);
          console.error(`   - Database connection is pointing to wrong file`);
          console.error(`   - User was deleted but session remains active`);
          console.error(`❌ [${requestId}] User should clear browser data and create new account`);
          
          // Additional diagnostics
          const sessionInfo = {
            userId: userId,
            username: req.user.username,
            sessionAge: req.session?.cookie?.maxAge,
            sessionCreated: req.session?.cookie?.originalMaxAge
          };
          console.error(`❌ [${requestId}] Session diagnostics:`, sessionInfo);
          
          return res.status(401).json({ 
            message: "User session is invalid. Please clear browser data and create a new account.",
            error: "USER_NOT_IN_DATABASE",
            diagnostics: {
              sessionUserId: userId,
              sessionUsername: req.user.username,
              suggestion: "Clear browser cookies and localStorage, then create a new account"
            }
          });
        }
        console.log(`✅ [${requestId}] User verified in database:`, userExists.username);
      } catch (userCheckError) {
        console.error(`❌ [${requestId}] Database connection error during user verification:`, userCheckError);
        
        // Enhanced database connection diagnostics
        const dbError = userCheckError as any;
        let errorCategory = 'DATABASE_CONNECTION_FAILED';
        let userMessage = 'Database connection failed. Please try again in a moment.';
        
        if (dbError.code === 'SQLITE_CANTOPEN') {
          errorCategory = 'DATABASE_FILE_INACCESSIBLE';
          userMessage = 'Database file is inaccessible. Please contact support.';
          console.error(`❌ [${requestId}] Database file cannot be opened - check file permissions`);
        } else if (dbError.code === 'SQLITE_BUSY') {
          errorCategory = 'DATABASE_LOCKED';
          userMessage = 'Database is temporarily locked. Please try again.';
          console.error(`❌ [${requestId}] Database is locked - possible concurrent access issue`);
        } else if (dbError.message?.includes('no such table')) {
          errorCategory = 'DATABASE_NOT_INITIALIZED';
          userMessage = 'Database tables missing. Please contact support.';
          console.error(`❌ [${requestId}] Database tables are missing - database not properly initialized`);
        }
        
        return res.status(503).json({ 
          message: userMessage,
          error: errorCategory,
          requestId: requestId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Enhanced scan data parsing and validation
      let scanData;
      try {
        console.log(`🔍 [${requestId}] Parsing and validating scan data...`);
        
        // Pre-validate critical fields before schema validation
        const { scanDate, bodyFatPercent, leanMass, totalWeight } = req.body;
        
        if (!scanDate) {
          throw new Error('Scan date is required');
        }
        
        const parsedDate = new Date(scanDate);
        if (isNaN(parsedDate.getTime())) {
          throw new Error('Invalid scan date format');
        }
        
        // Check for reasonable date range (not too far in past/future)
        const now = new Date();
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        if (parsedDate < yearAgo || parsedDate > monthFromNow) {
          console.warn(`⚠️ [${requestId}] Scan date seems unusual: ${parsedDate.toISOString()}`);
        }
        
        scanData = insertDexaScanSchema.parse({
          ...req.body,
          userId,
          scanDate: parsedDate,
        });
        console.log(`✅ [${requestId}] Scan data validated successfully`);
        
        // Log key metrics for debugging
        console.log(`📊 [${requestId}] Scan metrics: BF ${scanData.bodyFatPercent}%, Lean ${scanData.leanMass}lbs, Total ${scanData.totalWeight}lbs`);
        
      } catch (validationError) {
        console.error(`❌ [${requestId}] Validation error:`, validationError);
        if (validationError instanceof z.ZodError) {
          console.error(`❌ [${requestId}] Detailed validation issues:`);
          validationError.errors.forEach((err, index) => {
            console.error(`   ${index + 1}. ${err.path.join('.')}: ${err.message}`);
          });
          
          return res.status(400).json({ 
            message: "Invalid scan data provided",
            errors: validationError.errors,
            error: "VALIDATION_FAILED",
            requestId: requestId
          });
        }
        
        return res.status(400).json({
          message: validationError instanceof Error ? validationError.message : "Invalid scan data",
          error: "VALIDATION_FAILED",
          requestId: requestId
        });
      }
      
      // Create the scan with retry mechanism for transient failures
      let scan;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount <= maxRetries) {
        try {
          console.log(`💾 [${requestId}] Creating scan in database (attempt ${retryCount + 1}/${maxRetries + 1})...`);
          
          scan = await storage.createDexaScan(scanData);
          console.log(`✅ [${requestId}] Scan created successfully: ${scan.id}`);
          break;
          
        } catch (dbError) {
          console.error(`❌ [${requestId}] Database error creating scan (attempt ${retryCount + 1}):`, dbError);
          
          const error = dbError as any;
          
          // Handle specific database errors
          if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            console.error(`❌ [${requestId}] Duplicate scan detected - user already has scan for this date`);
            return res.status(409).json({ 
              message: "You already have a scan for this date. Please use a different date or edit the existing scan.",
              error: "DUPLICATE_SCAN",
              requestId: requestId
            });
          }
          
          // Retry logic for transient errors
          const retryableErrors = ['SQLITE_BUSY', 'SQLITE_LOCKED', 'SQLITE_IOERR'];
          const isRetryable = retryableErrors.includes(error.code);
          
          if (isRetryable && retryCount < maxRetries) {
            retryCount++;
            const delayMs = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
            console.log(`⏳ [${requestId}] Retrying in ${delayMs}ms due to transient error: ${error.code}`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          
          // Non-retryable error or max retries exceeded
          console.error(`❌ [${requestId}] Non-retryable database error:`, {
            code: error.code,
            message: error.message,
            retryCount: retryCount
          });
          
          let errorMessage = 'Failed to save scan data';
          let errorCode = 'DATABASE_ERROR';
          
          if (error.code === 'SQLITE_CANTOPEN') {
            errorMessage = 'Database file is inaccessible';
            errorCode = 'DATABASE_FILE_ERROR';
          } else if (error.code === 'SQLITE_CORRUPT') {
            errorMessage = 'Database corruption detected';
            errorCode = 'DATABASE_CORRUPT';
          } else if (error.code === 'SQLITE_FULL') {
            errorMessage = 'Database storage is full';
            errorCode = 'DATABASE_FULL';
          }
          
          return res.status(503).json({
            message: errorMessage,
            error: errorCode,
            requestId: requestId,
            timestamp: new Date().toISOString()
          });
        }
      }
      
      // Update user profile with name if provided (non-critical)
      if (req.body.firstName && req.body.lastName) {
        try {
          console.log(`👤 [${requestId}] Updating user profile with name...`);
          await storage.updateUser(userId, {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            name: `${req.body.firstName} ${req.body.lastName}`,
          });
          console.log(`✅ [${requestId}] User profile updated with name`);
        } catch (error) {
          console.error(`⚠️ [${requestId}] Non-critical error updating user name:`, error);
          // Don't fail the whole request for this - it's not critical
        }
      }
      
      // Recalculate scores with timeout protection
      try {
        console.log(`📊 [${requestId}] Recalculating competition scores...`);
        
        // Set timeout for score calculation to prevent hanging
        const scorePromise = storage.recalculateAllScores();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Score calculation timeout')), 30000)
        );
        
        await Promise.race([scorePromise, timeoutPromise]);
        console.log(`✅ [${requestId}] Scores recalculated successfully`);
      } catch (scoreError) {
        console.error(`⚠️ [${requestId}] Non-critical error recalculating scores:`, scoreError);
        // Don't fail the whole request for this - scores can be recalculated later
        // The scan was successfully created, which is the critical part
      }
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${requestId}] Scan creation completed successfully in ${duration}ms`);
      
      res.json({ 
        ...scan,
        _meta: {
          requestId: requestId,
          processingTimeMs: duration,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`💥 [${requestId}] Unexpected error creating scan after ${duration}ms:`, error);
      
      // Comprehensive error logging for debugging
      if (error instanceof Error) {
        console.error(`💥 [${requestId}] Error details:`);
        console.error(`   Message: ${error.message}`);
        console.error(`   Stack: ${error.stack}`);
        if ((error as any).code) {
          console.error(`   Code: ${(error as any).code}`);
        }
        if ((error as any).errno) {
          console.error(`   Errno: ${(error as any).errno}`);
        }
      }
      
      // Check if response was already sent (to avoid "Cannot set headers after they are sent" error)
      if (res.headersSent) {
        console.error(`⚠️ [${requestId}] Response already sent, cannot send error response`);
        return;
      }
      
      // Categorize error for better user experience
      let statusCode = 500;
      let userMessage = "An unexpected error occurred while creating your scan";
      let errorCode = "INTERNAL_SERVER_ERROR";
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          statusCode = 408;
          userMessage = "Request timed out. Please try again.";
          errorCode = "REQUEST_TIMEOUT";
        } else if (error.message.includes('network')) {
          statusCode = 503;
          userMessage = "Network error occurred. Please check your connection.";
          errorCode = "NETWORK_ERROR";
        } else if (error.message.includes('memory') || error.message.includes('heap')) {
          statusCode = 507;
          userMessage = "Server is temporarily overloaded. Please try again.";
          errorCode = "INSUFFICIENT_STORAGE";
        }
      }
      
      const errorResponse: any = {
        message: userMessage,
        error: errorCode,
        requestId: requestId,
        timestamp: new Date().toISOString(),
        processingTimeMs: duration
      };
      
      // Include debug details in non-production environments
      if (process.env.NODE_ENV !== 'production') {
        errorResponse.debug = {
          originalError: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          code: (error as any)?.code,
          errno: (error as any)?.errno
        };
      }
      
      res.status(statusCode).json(errorResponse);
    }
  });

  // Update DEXA scan with enhanced error handling
  app.put('/api/scans/:scanId', requireAuth, async (req: any, res) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
      console.log(`📊 [${requestId}] PUT /api/scans/${req.params.scanId} - Updating DEXA scan`);
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
      const duration = Date.now() - startTime;
      console.error(`❌ [${requestId}] Error updating scan after ${duration}ms:`, error);
      
      if (res.headersSent) {
        return;
      }
      
      res.status(500).json({ 
        message: "Failed to update scan",
        error: "SCAN_UPDATE_FAILED",
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
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

  // Real file upload endpoint with enhanced error handling
  app.post("/api/objects/upload", requireAuth, upload.single('file'), async (req: any, res) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    try {
      console.log(`📋 [${requestId}] POST /api/objects/upload - File upload request`);
      
      if (!req.file) {
        console.log(`❌ [${requestId}] No file provided in upload request`);
        return res.status(400).json({ 
          error: "No file provided",
          requestId: requestId
        });
      }
      
      console.log(`📎 [${requestId}] File details: ${req.file.originalname} (${req.file.size} bytes, ${req.file.mimetype})`);

      // Validate file size (multer already checks, but double-check)
      if (!objectStorage.validateFileSize(req.file.size)) {
        return res.status(413).json({ error: "File too large" });
      }

      // Store the file using our object storage service
      const objectPath = await objectStorage.storeFile(req.file.originalname, req.file.buffer);
      
      res.json({ 
        objectPath,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      const duration = Date.now() - startTime;
      console.log(`✅ [${requestId}] File uploaded successfully in ${duration}ms: ${objectPath}`);
      
      res.json({ 
        objectPath,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        _meta: {
          requestId: requestId,
          timestamp: new Date().toISOString(),
          processingTimeMs: duration
        }
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${requestId}] Error uploading file after ${duration}ms:`, error);
      
      if (res.headersSent) {
        return;
      }
      
      let statusCode = 500;
      let errorMessage = "Failed to upload file";
      let errorCode = "FILE_UPLOAD_FAILED";
      
      if (error instanceof Error) {
        if (error.message.includes('ENOSPC')) {
          statusCode = 507;
          errorMessage = "Insufficient storage space";
          errorCode = "INSUFFICIENT_STORAGE";
        } else if (error.message.includes('EACCES')) {
          statusCode = 403;
          errorMessage = "Permission denied accessing storage";
          errorCode = "STORAGE_PERMISSION_DENIED";
        }
      }
      
      res.status(statusCode).json({ 
        error: errorMessage,
        code: errorCode,
        requestId: requestId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // File download endpoint
  app.get("/api/objects/uploads/:filename", requireAuth, async (req, res) => {
    try {
      const objectPath = `/objects/uploads/${req.params.filename}`;
      await objectStorage.downloadObject(objectPath, res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ message: "File not found" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // DEXA data extraction with file upload support
  app.post("/api/extract-dexa-data", requireAuth, upload.single('file'), async (req: any, res) => {
    try {
      let extractedData;
      const { extractDexaScanFromImage, extractDexaScanFromPDF } = await import("./openai.js");
      
      if (req.file) {
        // Handle uploaded file
        const fileBuffer = req.file.buffer;
        const mimetype = req.file.mimetype;
        
        if (mimetype === 'application/pdf') {
          // Convert buffer to base64 for PDF processing
          const base64 = `data:application/pdf;base64,${fileBuffer.toString('base64')}`;
          extractedData = await extractDexaScanFromPDF(base64);
        } else if (mimetype.startsWith('image/')) {
          // Convert buffer to base64 for image processing
          const base64 = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;
          extractedData = await extractDexaScanFromImage(base64);
        } else {
          return res.status(400).json({ error: "Unsupported file type" });
        }
      } else if (req.body.imageBase64) {
        // Handle base64 data (backward compatibility)
        const { imageBase64 } = req.body;
        
        if (imageBase64.startsWith('data:application/pdf')) {
          extractedData = await extractDexaScanFromPDF(imageBase64);
        } else {
          extractedData = await extractDexaScanFromImage(imageBase64);
        }
      } else {
        return res.status(400).json({ error: "No file or imageBase64 provided" });
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


  // Backup status endpoint for monitoring
  app.get('/api/admin/backup-status', requireAuth, requireAdmin, async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const { getConfig } = await import('./config.js');
      
      const config = getConfig();
      const backupDir = config.BACKUP_PATH;
      
      try {
        // Check if backup directory exists
        await fs.access(backupDir);
        const backupFiles = await fs.readdir(backupDir);
        
        // Filter for database backup files
        const dbBackups = backupFiles.filter(file => 
          file.startsWith('fitness_challenge_backup_') && file.endsWith('.db')
        );
        
        // Get details of most recent backup
        let latestBackup = null;
        if (dbBackups.length > 0) {
          const sortedBackups = dbBackups.sort().reverse(); // Most recent first
          const latestFile = sortedBackups[0];
          const filePath = path.default.join(backupDir, latestFile);
          const stats = await fs.stat(filePath);
          
          latestBackup = {
            filename: latestFile,
            created: stats.birthtime,
            size: Math.round(stats.size / 1024) + 'KB',
            ageHours: Math.round((Date.now() - stats.birthtime.getTime()) / (1000 * 60 * 60))
          };
        }
        
        res.json({
          status: 'available',
          backupDirectory: backupDir,
          totalBackups: dbBackups.length,
          latestBackup,
          allBackups: dbBackups.slice(0, 10) // Last 10 backups
        });
        
      } catch (fsError) {
        res.json({
          status: 'unavailable',
          backupDirectory: backupDir,
          error: fsError instanceof Error ? fsError.message : 'Backup directory inaccessible',
          totalBackups: 0
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Backup status check failed'
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}