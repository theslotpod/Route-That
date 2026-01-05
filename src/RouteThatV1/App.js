import React, { useState } from "react"; // <-- CORRECTED THIS LINE
import Field from "./Field";
import vertical from "./plays/vertical";
import comeback from "./plays/comeback";

// Define a placeholder object for the custom play since there is no file to import.
// We give it a recognizable name.
const customPlayPlaceholder = { name: "custom" };

// Combine all selectable plays into a single array, including the custom placeholder.
const allSelectablePlays = [
    { ...vertical, name: "vertical" }, 
    { ...comeback, name: "comeback" },
    customPlayPlaceholder
];

export default function App() {
  const [screen, setScreen] = useState("home");
  const [selectedPlay, setSelectedPlay] = useState(null);
  const [isCustom, setIsCustom] = useState(false); // New state to track if we're in custom mode

  const handleStart = () => setScreen("selectPlay");

  const handlePlaySelect = (play) => {
    // Check if the selected play is the custom placeholder
    const isCustomPlay = play.name === customPlayPlaceholder.name;
    
    // If it's custom, we set isCustom to true and don't pass any static play data.
    if (isCustomPlay) {
        setSelectedPlay(null);
        setIsCustom(true);
    } else {
        // If it's a standard play, set the play data and isCustom to false.
        setSelectedPlay(play);
        setIsCustom(false);
    }
    
    setScreen("simulation");
  };

  const screenStyle = {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontFamily: "'Press Start 2P', cursive", // retro 8-bit font
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
          onClick={handleStart}
          onMouseEnter={buttonHover}
          onMouseLeave={buttonLeave}
        >
          START
        </button>
      </div>
    );
  }

  if (screen === "selectPlay") {
    return (
      <div style={screenStyle}>
        <h2 style={{ fontSize: 32, marginBottom: 30 }}>Choose a Play</h2>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {allSelectablePlays.map((play, i) => (
            <button
              key={i}
              style={{
                ...buttonStyle,
                // Highlight the custom button differently
                background: play.name === 'custom' ? '#00cc66' : '#ffcc00', 
              }}
              onClick={() => handlePlaySelect(play)}
              onMouseEnter={buttonHover}
              onMouseLeave={buttonLeave}
            >
              {play.name.toUpperCase()}
            </button>
          ))}
          
        </div>
      </div>
    );
  }

  if (screen === "simulation") {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          width: "100%",
          background: "#111",
        }}
      >
        {/* Pass both the selected play data and the new isCustom flag to Field */}
        <Field selectedPlayProp={selectedPlay} isCustom={isCustom} />
      </div>
    );
  }

  return null;
}