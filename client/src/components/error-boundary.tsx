import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    console.error('🚨 Error Boundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary - Full error details:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });

    // Store error in sessionStorage for debugging
    try {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      };
      sessionStorage.setItem('react-error', JSON.stringify(errorData));
    } catch (e) {
      console.error('Failed to store error in sessionStorage:', e);
    }

    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl w-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-red-800">
                    Application Error
                  </h1>
                  <p className="text-red-600">
                    Something went wrong in the React application
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h2 className="font-medium text-gray-900 mb-2">Error Details:</h2>
                  <div className="bg-gray-100 rounded-md p-3 text-sm font-mono text-red-800">
                    {this.state.error?.message || 'Unknown error'}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    Reload Page
                  </button>
                  <button
                    onClick={() => {
                      // Clear any cached data that might be causing issues
                      sessionStorage.clear();
                      localStorage.clear();
                      window.location.reload();
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Clear Cache & Reload
                  </button>
                </div>

                <details className="mt-6">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    Show Technical Details (for developers)
                  </summary>
                  <div className="mt-3 bg-gray-100 rounded-md p-3 text-xs font-mono text-gray-800 max-h-64 overflow-auto">
                    <div><strong>Stack Trace:</strong></div>
                    <pre className="whitespace-pre-wrap mt-1">
                      {this.state.error?.stack}
                    </pre>
                    {this.state.errorInfo && (
                      <div className="mt-4">
                        <div><strong>Component Stack:</strong></div>
                        <pre className="whitespace-pre-wrap mt-1">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}