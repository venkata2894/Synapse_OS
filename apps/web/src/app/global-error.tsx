"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#07090f",
          color: "#e2e8f0",
          fontFamily: "system-ui, sans-serif",
          padding: "32px",
        }}
      >
        <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "#64748b" }}>
          Fatal error
        </p>
        <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "8px 0 16px" }}>
          The application stopped responding
        </h1>
        <p style={{ maxWidth: 480, textAlign: "center", color: "#94a3b8" }}>
          {error.message || "An unexpected error occurred at the root of the app."}
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 24,
            padding: "8px 16px",
            background: "#22d3a8",
            color: "#07090f",
            border: 0,
            borderRadius: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
