import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import compression from "compression";
import { registerRoutes } from "./routes.js";
// Vite functions imported dynamically to avoid build issues
import { initializeDatabase } from "./db.js";
import { loadConfig, getConfig, getCorsOrigins } from "./config.js";
import { log } from "./logger.js";

const app = express();

// Load configuration first
const config = loadConfig();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false, // Disable for development compatibility
}));

// CORS configuration with enhanced production support
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = getCorsOrigins();
    
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check exact matches first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In production, allow any *.onrender.com subdomain for this app
    if (config.NODE_ENV === "production" && origin.includes("onrender.com")) {
      if (origin.includes("recomp-100-fitness") || origin.includes("fitness-app")) {
        return callback(null, true);
      }
    }
    
    // Log rejected origins in development for debugging
    if (config.NODE_ENV === "development") {
      log.warn(`CORS: Rejected origin: ${origin}`);
      log.info(`CORS: Allowed origins: ${allowedOrigins.join(', ')}`);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: config.RATE_LIMIT_REQUESTS_PER_MINUTE,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Response compression
app.use(compression());

// Body parsing middleware
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 image uploads
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    log.request(req, res, duration);
  });

  next();
});

(async () => {
  try {
    // Initialize database before setting up routes
    await initializeDatabase();
    
    const server = await registerRoutes(app);

    // Health check endpoints
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Detailed health check for monitoring
    app.get('/api/health', async (req, res) => {
      try {
        const healthChecks: any = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0'
        };

        // Enhanced database health check with persistence verification
        const { getDatabaseHealthStatus } = await import('./db.js');
        
        try {
          healthChecks.database = await getDatabaseHealthStatus();
        } catch (dbError) {
          healthChecks.database = {
            status: 'error',
            path: config.DATABASE_URL,
            error: dbError instanceof Error ? dbError.message : 'Database health check failed'
          };
        }

        // Check file storage
        const { objectStorage } = await import('./objectStorage.js');
        const uploadsDir = objectStorage.getUploadDirectory();
        const fs = await import('fs/promises');
        
        try {
          await fs.access(uploadsDir);
          const files = await fs.readdir(uploadsDir);
          healthChecks.fileStorage = {
            status: 'available',
            directory: uploadsDir,
            filesCount: files.length
          };
        } catch (fsError) {
          healthChecks.fileStorage = {
            status: 'unavailable',
            directory: uploadsDir,
            error: fsError instanceof Error ? fsError.message : 'File system error'
          };
        }

        // Memory and system info
        const memUsage = process.memoryUsage();
        healthChecks.system = {
          memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB'
          },
          platform: process.platform,
          nodeVersion: process.version
        };

        // Competition status
        const startDate = new Date(config.COMPETITION_START_DATE);
        const endDate = new Date(config.COMPETITION_END_DATE);
        const now = new Date();
        
        let competitionStatus = 'upcoming';
        if (now >= startDate && now <= endDate) {
          competitionStatus = 'active';
        } else if (now > endDate) {
          competitionStatus = 'ended';
        }
        
        healthChecks.competition = {
          status: competitionStatus,
          startDate: config.COMPETITION_START_DATE,
          endDate: config.COMPETITION_END_DATE,
          daysRemaining: competitionStatus === 'active' 
            ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : 0
        };

        res.status(200).json(healthChecks);
      } catch (error) {
        log.error('Health check failed:', error);
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Global error handler
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      // Log the error with context
      log.error('Unhandled error:', {
        error: err,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id
      });

      // Don't expose internal errors in production
      const responseMessage = config.NODE_ENV === 'production' && status === 500 
        ? 'Internal Server Error' 
        : message;

      res.status(status).json({ 
        message: responseMessage,
        timestamp: new Date().toISOString(),
        ...(config.NODE_ENV !== 'production' && { stack: err.stack })
      });
    });

    // 404 handler for API routes
    app.use('/api/*', (req, res) => {
      res.status(404).json({ 
        message: 'API endpoint not found',
        timestamp: new Date().toISOString()
      });
    });

    // Setup static file serving - only in production mode
    if (config.NODE_ENV === "production") {
      const { serveStatic } = await import("./vite-production.js");
      serveStatic(app);
    } else {
      log.info("Development mode: Skipping static file serving (expecting Vite dev server)");
    }

    // Enhanced port management with conflict detection
    const startServer = async (preferredPort: number, maxRetries: number = 5): Promise<void> => {
      let currentPort = preferredPort;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          await new Promise<void>((resolve, reject) => {
            const serverInstance = server.listen(currentPort, "0.0.0.0", () => {
              log.info(`🚀 Server running on port ${currentPort}`);
              log.info(`🌍 Environment: ${config.NODE_ENV}`);
              log.info(`🔒 Security: Helmet, CORS, Rate limiting enabled`);
              log.info(`📊 Health check available at: http://localhost:${currentPort}/health`);
              
              if (currentPort !== preferredPort) {
                log.warn(`⚠️  Using fallback port ${currentPort} instead of preferred port ${preferredPort}`);
              }
              resolve();
            });

            serverInstance.on('error', (err: any) => {
              if (err.code === 'EADDRINUSE') {
                log.warn(`⚠️  Port ${currentPort} is already in use (attempt ${attempt + 1}/${maxRetries})`);
                reject(err);
              } else {
                log.error('Server startup error:', err);
                reject(err);
              }
            });
          });
          
          // Success - exit retry loop
          break;
          
        } catch (err: any) {
          if (err.code === 'EADDRINUSE' && attempt < maxRetries - 1) {
            attempt++;
            currentPort = preferredPort + attempt;
            log.info(`🔄 Retrying with port ${currentPort}...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          } else {
            // Final attempt failed or non-port error
            throw new Error(`Failed to start server after ${maxRetries} attempts. Last error: ${err.message}`);
          }
        }
      }
    };

    await startServer(config.PORT);

    // Graceful shutdown handling
    const shutdown = (signal: string) => {
      log.info(`Received ${signal}. Starting graceful shutdown...`);
      server.close((err) => {
        if (err) {
          log.error('Error during server shutdown:', err);
          process.exit(1);
        }
        log.info('Server shut down successfully');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
})();

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
  process.exit(1);
});
