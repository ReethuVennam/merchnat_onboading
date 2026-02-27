import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught error in component tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
            <p className="mb-2">{this.state.error?.message || 'An unexpected error occurred.'}</p>
            <pre className="text-xs text-left overflow-x-auto bg-gray-100 p-2 rounded">
              {this.state.error?.stack}
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">Check the browser console for more details.</p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
