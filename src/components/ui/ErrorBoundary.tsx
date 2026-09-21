import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[OnyxStream Crash Guard] Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center z-[9999]">
          <div className="w-16 h-16 bg-red-600/20 text-red-500 rounded-2xl flex items-center justify-center mb-4 border border-red-500/30 shadow-lg shadow-red-600/20">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something Went Wrong</h1>
          <p className="text-gray-400 text-sm max-w-md mb-6 leading-relaxed">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-indigo-600/30 active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Player
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl text-sm font-semibold transition-colors border border-gray-700 active:scale-95"
            >
              <Home className="w-4 h-4" />
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
