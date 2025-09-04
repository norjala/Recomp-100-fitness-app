import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/error-boundary";

// Enhanced error handling for production debugging
console.log('🚀 Starting React application...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Timestamp:', new Date().toISOString());

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('🚨 Global JavaScript Error:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    timestamp: new Date().toISOString(),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🚨 Unhandled Promise Rejection:', {
    reason: event.reason,
    timestamp: new Date().toISOString(),
  });
});

// Wrap React app initialization in try-catch
try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error("Root element not found - DOM might not be ready");
  }

  console.log('✅ Root element found, creating React root...');
  
  const root = createRoot(rootElement);
  
  console.log('✅ React root created, rendering app...');
  
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
  
  console.log('✅ React app rendered successfully!');
  
} catch (error) {
  console.error('🚨 Critical error during React app initialization:', error);
  
  // Fallback error display
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #fef2f2; font-family: system-ui, sans-serif;">
        <div style="background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px;">
          <h1 style="color: #dc2626; margin: 0 0 1rem 0; font-size: 1.5rem;">⚠️ Application Failed to Load</h1>
          <p style="color: #374151; margin: 0 0 1rem 0;">The React application failed to initialize. This is likely due to a JavaScript error.</p>
          <div style="background: #f3f4f6; padding: 1rem; border-radius: 4px; margin: 1rem 0; font-family: monospace; font-size: 0.875rem; color: #dc2626;">
            ${error instanceof Error ? error.message : String(error)}
          </div>
          <button onclick="window.location.reload()" style="background: #dc2626; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;">
            Reload Page
          </button>
          <button onclick="sessionStorage.clear(); localStorage.clear(); window.location.reload()" style="background: #6b7280; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">
            Clear Cache & Reload
          </button>
        </div>
      </div>
    `;
  }
}
