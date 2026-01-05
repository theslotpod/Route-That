// App.js (Iteration 2 - Slogan Updated, Cursor Removed)

import React, { useState } from "react";
import Field from "./Field";

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
  const [isCustom, setIsCustom] = useState(false); 

  const handleStart = () => {
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
    background: "#000", // Pure black for terminal
    color: "#00ff00", // Green terminal text
    
    // Add subtle scan line effect (optional but nice for retro)
    backgroundImage: 'linear-gradient(rgba(0, 255, 0, 0.05) 1px, transparent 1px)',
    backgroundSize: '100% 4px',
    padding: '20px',
  };

  const titleStyle = {
    fontSize: 48, // Slightly smaller than Iteration 1
    marginBottom: 30, 
    color: "#00ff00", 
    textShadow: '0 0 10px rgba(0, 255, 0, 0.8)', // Strong green glow
    letterSpacing: '3px'
  };
  
  // Custom component for the blinking terminal text effect (Cursor removed)
  const TerminalText = ({ text }) => {
    return (
        <div style={{ fontSize: '18px', marginBottom: '15px' }}>
            <span style={{color: 'yellow'}}>{text}</span>
        </div>
    );
  };

  const buttonStyle = {
    padding: "15px 40px",
    margin: "10px",
    fontSize: "16px",
    fontFamily: "'Press Start 2P', cursive",
    background: "#00ff00",
    color: "#000",
    border: "2px solid #00ff00",
    cursor: "pointer",
    boxShadow: "0 0 8px rgba(0, 255, 0, 0.7)",
    transition: "all 0.1s",
  };

  const buttonHover = (e) => {
    e.target.style.background = "#333";
    e.target.style.color = "#00ff00";
    e.target.style.boxShadow = "0 0 15px #00ff00";
  };

  const buttonLeave = (e) => {
    e.target.style.background = "#00ff00";
    e.target.style.color = "#000";
    e.target.style.boxShadow = "0 0 8px rgba(0, 255, 0, 0.7)";
  };
  
  // --- Rendering Logic ---

  if (screen === "home") {
    return (
      <div style={screenStyle}>
        <h1 style={titleStyle}>ROUTE THAT</h1>
        <TerminalText text="BUILD THE ROUTE. BREAK THE COVERAGE." />
        <button
          style={buttonStyle}
          onClick={handleStart}
          onMouseEnter={buttonHover}
          onMouseLeave={buttonLeave}
        >
          START
        </button>
      </div>
    );
  }

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