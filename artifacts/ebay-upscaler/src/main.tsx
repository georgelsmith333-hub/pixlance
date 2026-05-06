import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import App from "./App";
import "./index.css";

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", background: "#0B1120", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚡</div>
          <h1 style={{ color: "#0EA5E9", fontSize: "1.5rem", marginBottom: "0.5rem" }}>Pixlance — App Error</h1>
          <p style={{ maxWidth: "480px", lineHeight: 1.6 }}>
            Something went wrong while loading. Please hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or clear your browser cache.
          </p>
          <pre style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#ef4444", background: "#1e293b", padding: "1rem", borderRadius: "0.5rem", maxWidth: "600px", overflowX: "auto", textAlign: "left" }}>
            {String(this.state.error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "1.5rem", padding: "0.6rem 1.5rem", background: "#0EA5E9", color: "#fff", border: "none", borderRadius: "0.5rem", cursor: "pointer", fontSize: "0.9rem" }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
