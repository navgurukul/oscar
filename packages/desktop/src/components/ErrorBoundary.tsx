import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            padding: 32,
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            color: "#334155",
            background: "#f8fafc",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: 20, maxWidth: 400 }}>
            OSCAR ran into an unexpected error. Restarting usually fixes this.
          </p>
          <pre
            style={{
              fontSize: "0.75rem",
              color: "#94a3b8",
              background: "#f1f5f9",
              padding: "12px 16px",
              borderRadius: 8,
              maxWidth: 500,
              overflow: "auto",
              marginBottom: 20,
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 20px",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "#fff",
              background: "#0891b2",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Reload OSCAR
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
