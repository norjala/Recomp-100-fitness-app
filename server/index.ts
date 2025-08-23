import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import compression from "compression";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log as viteLog } from "./vite";
import { initializeDatabase } from "./db";
import { loadConfig, getConfig, getCorsOrigins } from "./config";
import { log } from "./logger";

const app = express();

// Load configuration first
const config = loadConfig();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
  crossOriginEmbedderPolicy: false, // Disable for development compatibility
}));

// CORS configuration
app.use(cors({
  origin: getCorsOrigins(),
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
        // Test database connection
        const { db } = await import('./db');
        await db.select().from((await import('../shared/schema')).users).limit(1);
        
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: config.NODE_ENV,
          version: process.env.npm_package_version || '1.0.0',
          database: {
            status: 'connected',
            path: config.DATABASE_URL
          },
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
          }
        });
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

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (config.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Use configured port
    const port = config.PORT;
    server.listen(port, "0.0.0.0", () => {
      log.info(`🚀 Server running on port ${port}`);
      log.info(`🌍 Environment: ${config.NODE_ENV}`);
      log.info(`🔒 Security: Helmet, CORS, Rate limiting enabled`);
      log.info(`📊 Health check available at: http://localhost:${port}/health`);
    });

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
