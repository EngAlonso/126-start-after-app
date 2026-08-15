import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. If omitted, a default Arabic error screen is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level React Error Boundary.
 *
 * Catches any unhandled runtime error thrown by a descendant component and
 * displays a localised Arabic fallback UI instead of a blank white screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Logged here so error-monitoring integrations (e.g. Sentry) can capture
    // the full stack trace. console.* is stripped from the production bundle
    // by the build pipeline, so this does not leak to end-user DevTools.
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          dir="rtl"
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#fafaf8",
            fontFamily: "'Cairo', 'Segoe UI', sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 20 }}>⚠️</div>

          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#1a1a1a",
              marginBottom: 10,
            }}
          >
            حدث خطأ غير متوقع
          </h1>

          <p
            style={{
              fontSize: 14,
              color: "#666",
              maxWidth: 380,
              lineHeight: 1.9,
              marginBottom: 28,
            }}
          >
            نعتذر عن هذا الخطأ. يرجى إعادة تحميل الصفحة أو العودة إلى
            الصفحة الرئيسية، وإذا استمرت المشكلة تواصل مع الدعم.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={this.handleReload}
              style={{
                background: "#F5C518",
                color: "#1a1a1a",
                border: "none",
                borderRadius: 10,
                padding: "10px 26px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              إعادة تحميل الصفحة
            </button>

            <button
              onClick={this.handleHome}
              style={{
                background: "#fff",
                color: "#1a1a1a",
                border: "1.5px solid #e0e0e0",
                borderRadius: 10,
                padding: "10px 26px",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              الصفحة الرئيسية
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
