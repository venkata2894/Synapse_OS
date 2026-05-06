import type { NextPageContext } from "next";

interface ErrorProps {
  statusCode?: number;
}

function ErrorPage({ statusCode }: ErrorProps) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", color: "#64748b" }}>
        {statusCode ?? "Error"}
      </p>
      <h1 style={{ fontSize: "24px", fontWeight: 700, margin: "8px 0 16px" }}>
        {statusCode === 404 ? "Route not found" : "Something went wrong"}
      </h1>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
