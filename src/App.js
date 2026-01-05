// App.js

import React, { useState } from "react";
import Field from "./Field";
// Standard plays are no longer imported as the app starts directly into custom mode

// Define the expected unscaled field width (based on Field.js constants)
const FIELD_WIDTH = 500; 

/**
 * Helper to determine dynamic scale factor for responsive design.
 */
const getScaleFactor = () => {
  const windowWidth = window.innerWidth;
  const desktopBreakpoint = 700; 
  const desktopScale = 0.80; 

  if (windowWidth > desktopBreakpoint) {
    return desktopScale;
  } else {
    return Math.min(1.0, (windowWidth * 0.95) / FIELD_WIDTH);
  }
}

export default function App() {
  const [screen, setScreen] = useState("home");
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [isCustom, setIsCustom] = useState(false); // New state to track if we're in custom mode

  const handleStart = () => {
    // New simplified flow: Set to custom mode and go straight to simulation
    setSelectedPlay(null);
    setIsCustom(true); 
    setScreen("simulation");
  };

  const screenStyle = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh", 
    width: "100vw", 
    fontFamily: "'Press Start 2P', cursive", 
    background: "#222",
    color: "#fff",
  };

  const buttonStyle = {
    padding: "20px 40px",
    margin: "10px",
    fontSize: "16px",
    fontFamily: "'Press Start 2P', cursive",
    background: "#ffcc00",
    color: "#222",
    border: "4px solid #fff",
    cursor: "pointer",
    boxShadow: "4px 4px 0 #000",
    transition: "all 0.1s",
  };

  const buttonHover = (e) => {
    e.target.style.transform = "translate(2px,2px)";
    e.target.style.boxShadow = "2px 2px 0 #000";
  };

  const buttonLeave = (e) => {
    e.target.style.transform = "translate(0,0)";
    e.target.style.boxShadow = "4px 4px 0 #000";
  };
  
  // --- Rendering Logic ---

  if (screen === "home") {
    return (
      <div style={screenStyle}>
        <h1 style={{ fontSize: 64, color: "#ffcc00", marginBottom: 40 }}>ROUTE THAT</h1>
        <button
          style={buttonStyle}
          onClick={handleStart} // Now goes directly to simulation setup
          onMouseEnter={buttonHover}
          onMouseLeave={buttonLeave}
        >
          START
        </button>
      </div>
    );
  }

  // The 'selectPlay' screen has been removed

  if (screen === "simulation") {
      const scaleFactor = getScaleFactor();
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center", 
          height: "100vh", 
          width: "100vw", 
          background: "#111", 
          
          // Apply dynamic scaling
          transform: `scale(${scaleFactor})`,
          transformOrigin: 'center center', 
        }}
      >
        <Field selectedPlayProp={selectedPlay} isCustom={isCustom} />
      </div>
    );
  }

  return null;
}