import React, { useState } from "react";
import Field from "./Field";
import "./App.css";

const FIELD_WIDTH = 900;

const getScaleFactor = () => {
  const windowWidth = window.innerWidth;
  if (windowWidth > 1000) return 1.0;
  return Math.min(1.0, (windowWidth * 0.95) / FIELD_WIDTH);
};

export default function App() {
  const [screen, setScreen] = useState("home");

  const handleStart = () => {
    setScreen("simulation");
  };

  if (screen === "home") {
    return (
      <div className="entry-screen">
        <h1 className="entry-title">ROUTE THAT</h1>
        <div className="pixel-football" />
        <p className="entry-tagline">Draw the play. Read the defense. Score.</p>
        <p className="entry-subtitle">A football route-drawing simulator</p>
        <button className="btn-cta" onClick={handleStart}>
          START
        </button>
        <div className="entry-footer">TAP TO DRAW. CLICK TO SCORE.</div>
      </div>
    );
  }

  if (screen === "simulation") {
    const scaleFactor = getScaleFactor();
    return (
      <div
        style={{
          transform: scaleFactor < 1 ? `scale(${scaleFactor})` : undefined,
          transformOrigin: "top center",
        }}
      >
        <Field isCustom={true} />
      </div>
    );
  }

  return null;
}
