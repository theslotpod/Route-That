"use client";

import dynamic from "next/dynamic";

// Load the CRA game app with SSR disabled (Konva requires browser APIs)
const RouteApp = dynamic(() => import("../../src/App"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "calc(100vh - 60px)",
        background: "#0a0a0a",
        fontFamily: "monospace",
        fontSize: 11,
        color: "rgba(0,255,80,0.4)",
        letterSpacing: "0.2em",
      }}
    >
      LOADING...
    </div>
  ),
});

export default function GameClient() {
  return (
    <div style={{ height: "calc(100vh - 60px)", overflow: "auto" }}>
      <style>{`
        /* Adjust game height to account for nav */
        .entry-screen { height: calc(100vh - 60px) !important; }
      `}</style>
      <RouteApp />
    </div>
  );
}
