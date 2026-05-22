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
            fontFamily: "'Figtree', system-ui, sans-serif",
            textAlign: "center",
            color: "var(--ink)",
            background: "var(--cream)",
          }}
        >
          <h1
            style={{
              fontFamily: "'EB Garamond', Georgia, serif",
              fontSize: "1.5rem",
              fontWeight: 500,
              letterSpacing: "-0.015em",
              marginBottom: 8,
            }}
          >
            Something went wrong.
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--ink-soft)", marginBottom: 20, maxWidth: 400, lineHeight: 1.55 }}>
            OSCAR ran into an unexpected error. Restarting usually fixes this.
          </p>
          <pre
            style={{
              fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
              fontSize: "0.75rem",
              color: "var(--ink-faint)",
              background: "var(--cream-200)",
              border: "1px solid var(--cream-300)",
              padding: "12px 16px",
              borderRadius: 8,
              maxWidth: 500,
              overflow: "auto",
              marginBottom: 20,
              textAlign: "left",
            }}
          >
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "8px 20px",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--cream)",
              background: "var(--terra-500)",
              border: "none",
              borderRadius: 999,
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
