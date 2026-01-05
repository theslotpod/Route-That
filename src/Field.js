// Field.js

import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Line, Ellipse } from "react-konva";
import { 
    PX_PER_YARD, 
    BASE_FRAME_RATE, 
    CATCH_RADIUS, 
    DEF_INTERCEPTION_RADIUS, 
    DEFLECTION_RADIUS, 
    TACKLE_RADIUS, 
    QB_THROW_TIME, 
    BALL_TRAVEL_TIME, 
    ENDZONE_HEIGHT, 
    PLAYABLE_HEIGHT,
    FIELD_WIDTH,
    FIELD_HEIGHT,
    TOP_ENDZONE_LINE,
    LEFT_BOUNDARY,
    RIGHT_BOUNDARY,
    FRONT_BOUNDARY,
    BACK_BOUNDARY,
    LINE_PLAYERS,
    EDITABLE_PLAYERS,
    ALL_OFFENSE_PLAYERS,
    defaultRouteData
} from "./components/constants"; 
import { distToSegment } from "./components/utils"; 
import { getPlayerPos, calculateOpennessScore, getPlayerDefinition } from "./components/playerLogic"; 
import { generateRandomDefense, compileDefenseMovement } from "./components/defenseLogic"; 
import { loadSavedPlays, savePlay, deletePlay } from "./components/playStorage";


export default function Field({ selectedPlayProp, isCustom }) {
    
    // --- EDITOR STATE ---
    const [setupPhase, setSetupPhase] = useState('formation'); 
    const [mode, setMode] = useState('setup');
    const [editingPlayer, setEditingPlayer] = useState('WR1');
    const [routeData, setRouteData] = useState(defaultRouteData); 
    
    // --- SIMULATION STATE ---
    const [time, setTime] = useState(0);
    const [players, setPlayers] = useState([]); 
    const [defensePlayers, setDefensePlayers] = useState([]); 
    const [defensiveCoverage, setDefensiveCoverage] = useState(null); 
    const [ball, setBall] = useState(null); 
    const [running, setRunning] = useState(false);
    const [yardsGained, setYardsGained] = useState(0);
    const [passStatus, setPassStatus] = useState("PENDING");
    const [startYardsLine, setStartYardsLine] = useState(null);
    
    // Initial multiplier is set to the slowest speed (1x)
    const [playbackSpeedMultiplier, setPlaybackSpeedMultiplier] = useState(1); 
    
    // --- NEW STATE FOR SAVED PLAYS ---
    const [savedPlaysList, setSavedPlaysList] = useState([]); 
    const [message, setMessage] = useState(''); // Status message for save/load/delete
    
    const timeRef = useRef(0);
    const animationFrameId = useRef(null);

    // Line of Scrimmage Y-coordinate constant
    const LOS_Y = 540; 

    // ================= NEW ROUTE EDITING / UTILITY FUNCTIONS =================
    
    /**
     * Ensures no defensive player is on the offensive side of the line of scrimmage (Y > LOS_Y).
     * @param {Array<Object>} defensePlayers - Array of defense player objects.
     * @returns {Array<Object>} Clamped defense player objects.
     */
    const clampDefensePositions = (defensePlayers) => {
        // LOS_Y = 540. Offensive players are restricted to Y >= 540.
        // Defensive players must be restricted to Y <= 540.
        return defensePlayers.map(player => {
            if (player.side !== 'defense') return player;

            let [startX, startY] = player.start;
            
            // Clamp Y position to be at or above the LOS (towards the top/defense side)
            if (startY > LOS_Y) {
                startY = LOS_Y; 
            }

            return {
                ...player,
                start: [startX, startY]
            };
        });
    };
    
    /**
     * Helper to load saved plays into state.
     */
    const refreshSavedPlays = () => {
        setSavedPlaysList(loadSavedPlays());
    }

    /**
     * Saves the current routeData as a new play preset.
     */
    const handleSavePlay = () => {
        setRunning(false); 
        
        // Simple prompt for the play name
        const playName = prompt("Enter a name for your custom play:");
        
        if (playName && playName.trim()) {
            const result = savePlay(playName.trim(), routeData);
            refreshSavedPlays(); 
            setMessage(result.message);
            // Clear message after 3 seconds
            setTimeout(() => setMessage(''), 3000); 
        } else if (playName !== null) {
            setMessage("Play name cannot be empty.");
            setTimeout(() => setMessage(''), 3000); 
        }
    }
    
    /**
     * Loads a play preset from the savedPlaysList by name.
     */
    const handleLoadPlay = (playName) => {
        const playToLoad = savedPlaysList.find(p => p.name === playName);
        if (playToLoad) {
            setRouteData(playToLoad.routeData);
            // Transition back to setup/formation phase to allow editing or direct running
            setMode('setup'); 
            setSetupPhase('formation');
            setRunning(false);
            
            // Defense state is preserved correctly here
            
            setMessage(`Play '${playName}' loaded successfully.`);
            setTimeout(() => setMessage(''), 3000); 
        }
    }
    
    /**
     * Deletes a play preset by name.
     */
    const handleDeletePlay = (playName) => {
        if (window.confirm(`Are you sure you want to delete the play '${playName}'?`)) {
            const result = deletePlay(playName);
            refreshSavedPlays(); 
            setMessage(result.message);
            setTimeout(() => setMessage(''), 3000); 
        }
    }


    /**
     * Resets the waypoints for a specific player's route to an empty array.
     */
    const resetPlayerRoute = (playerName) => {
        setRouteData(prevData => ({
            ...prevData,
            [playerName]: {
                ...prevData[playerName],
                waypoints: [] // Resetting route means clearing all waypoints
            }
        }));
    };
    
    /**
     * Transitions from Run Mode back to Routes Setup Mode, preserving the defense.
     */
    const backToRouteEditing = () => {
        setMode('setup');
        setSetupPhase('routes');
        setRunning(false);
        // Defense is automatically preserved (defensePlayers and defensiveCoverage state are not reset)
    }

    // ================= HELPER FUNCTIONS (Existing) =================
    
    const compileOffense = () => {
        return ALL_OFFENSE_PLAYERS
            .map(name => getPlayerDefinition(name, routeData))
            .filter(p => p !== null);
    }
    
    const compilePlay = () => {
        const compiledOffense = compileOffense();
        
        const compiledDefense = defensePlayers.map(def => ({
            ...def,
            movements: compileDefenseMovement(def, defensiveCoverage, routeData) 
        }));

        setPlayers([...compiledOffense, ...compiledDefense]);
        
        // Set startYardsLine to the Line of Scrimmage (C position Y), which is 540 by default.
        setStartYardsLine(routeData.C.start[1]);
        setPassStatus("PENDING");
        setYardsGained(0);
        timeRef.current = 0;
        setTime(0);
        
        setBall({ 
            thrown: false, 
            caught: false, 
            carrier: null, 
            pos: routeData.QB.start, 
            t: 0, 
            target: null, 
            interception: false, 
            catchTime: 0, 
            finalX: null, 
            finalY: null 
        });
        setRunning(false); 
    }

    const resetToFormation = () => {
        setMode('setup');
        setSetupPhase('formation');
        setRunning(false);
        
        // Reset routes to default when clicking NEW PLAY (and randomize defense)
        if (isCustom) {
            setRouteData(defaultRouteData); 
            const { players: newDefense, coverage } = generateRandomDefense(defaultRouteData); 
            
            // --- FIX: Clamp defense initial position ---
            const clampedDefense = clampDefensePositions(newDefense);

            setDefensePlayers(clampedDefense);
            setDefensiveCoverage(coverage);
        } else {
             // For standard plays, we still reset defense and coverage
             const dataToUse = selectedPlayProp ? selectedPlayProp.routeData : defaultRouteData;
             const { players: newDefense, coverage } = generateRandomDefense(dataToUse); 
             
             // --- FIX: Clamp defense initial position ---
             const clampedDefense = clampDefensePositions(newDefense);
             
             setDefensePlayers(clampedDefense);
             setDefensiveCoverage(coverage);
        }
    }
    
    const handleFieldClick = (e) => {
        if (mode !== 'setup' || setupPhase !== 'routes' || !editingPlayer) return;
        const stage = e.target.getStage();
        const pointerPos = stage.getPointerPosition();
        const x = pointerPos.x;
        const y = pointerPos.y;

        setRouteData(prevData => {
            const currentRoute = prevData[editingPlayer];
            if (!currentRoute) return prevData;
            const lastTime = currentRoute.waypoints.length > 0 ? currentRoute.waypoints[currentRoute.waypoints.length - 1][2] : 0;
            const newTime = lastTime + 1000; 
            const newWaypoint = [Math.round(x), Math.round(y), newTime];
            return {
                ...prevData,
                [editingPlayer]: {
                    ...currentRoute,
                    waypoints: [...currentRoute.waypoints, newWaypoint]
                }
            };
        });
    };

    const handleWaypointDrag = (player, index, newPos) => {
        setRouteData(prevData => {
            const currentRoute = prevData[player];
            if (!currentRoute) return prevData;
            const updatedWaypoints = currentRoute.waypoints.map((wp, i) => {
                if (i === index) {
                    return [Math.round(newPos.x), Math.round(newPos.y), wp[2]]; 
                }
                return wp;
            });
            return {
                ...prevData,
                [player]: {
                    ...currentRoute,
                    waypoints: updatedWaypoints
                }
            };
        });
    };
    
    /**
     * Updates the player's start position in routeData and clamps the Y position 
     * to prevent crossing the line of scrimmage (Y=540).
     */
    const updateStartPos = (player, newPos) => {
        setRouteData(prevData => {
            const currentRoute = prevData[player];
            
            // --- CLAMP Y-POSITION ---
            let newY = Math.round(newPos.y);
            if (newY < LOS_Y) {
                newY = LOS_Y; 
            }
            // ------------------------
            
            return {
                ...prevData,
                [player]: {
                    ...currentRoute,
                    start: [Math.round(newPos.x), newY] // Use the clamped Y-value
                }
            };
        });
    }

    /**
     * Konva's onDragMove handler for offensive players in formation setup.
     * Prevents the player circle from visually crossing the LOS (Y=540)
     */
    const handlePlayerDragMove = (e) => {
        const node = e.target;
        const newY = node.y(); 
        
        // If the circle's new Y position is less than the LOS, force it to stay at the LOS
        if (newY < LOS_Y) {
            node.y(LOS_Y);
        }
        
        // Use the current position to update the state immediately on drag
        updateStartPos(node.name(), node.position());
    }

    const loadPlayData = (play) => {
        // This function is for loading pre-defined, complex play objects (if they exist).
        // It's ignored for user-made plays (which use the simpler handleLoadPlay).
        const newRouteData = {};
        const playersToLoad = [
            { name: 'QB', data: play.qb },
            ...(play.receivers || []).filter(r => EDITABLE_PLAYERS.includes(r.name)),
        ];
        let dummyTime = 0; 
        playersToLoad.forEach(p => {
            let prevX = p.data.start[0];
            let prevY = p.data.start[1];
            
            const waypoints = p.data.movements
                .filter(segment => segment.t_end !== Infinity) 
                .map(segment => {
                    const duration = segment.t_end - segment.t_start;
                    const dx = segment.x_func(duration);
                    const dy = segment.y_func(duration);
                    
                    prevX += dx;
                    prevY += dy;
                    
                    dummyTime += 1000; 
                    return [Math.round(prevX), Math.round(prevY), dummyTime]; 
                });

            newRouteData[p.name] = { 
                start: p.data.start, 
                waypoints: waypoints 
            };
        });
        
        ALL_OFFENSE_PLAYERS.forEach(name => {
            if (!newRouteData[name] && defaultRouteData[name]) {
                 newRouteData[name] = { ...defaultRouteData[name], waypoints: [] };
            }
        });

        setRouteData(prev => ({ ...defaultRouteData, ...newRouteData }));
        setMode('run'); 
        setSetupPhase('formation'); 
    };

    // --- EFFECT: Handle play loading and randomization ---
    useEffect(() => {
        // Load saved plays on mount
        refreshSavedPlays(); 
        
        if (isCustom) {
            setMode('setup');
            setSetupPhase('formation'); 
            const dataToUse = Object.keys(routeData).length > 0 ? routeData : defaultRouteData;
            const { players: initialDefense, coverage } = generateRandomDefense(dataToUse);
            
            // --- FIX: Clamp defense initial position ---
            const clampedDefense = clampDefensePositions(initialDefense);
            
            setDefensePlayers(clampedDefense);
            setDefensiveCoverage(coverage);
        } else if (selectedPlayProp) {
            loadPlayData(selectedPlayProp);
            setDefensePlayers([]); 
            setDefensiveCoverage(null);
        } else {
            setMode('run');
            compilePlay();
        }
    }, [selectedPlayProp, isCustom]);

    // --- EFFECT: Recompile on offense changes or defense randomization ---
    useEffect(() => {
        compilePlay();
    }, [routeData, defensePlayers, defensiveCoverage]); 

    // ================= SIMULATION LOOP =================
    
    useEffect(() => {
        if (mode !== 'run' || !running) { 
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
            }
            return; 
        }
        
        const effectiveFrameRate = BASE_FRAME_RATE * playbackSpeedMultiplier; 
        
        const loop = () => {
            timeRef.current += effectiveFrameRate;
            const elapsed = timeRef.current;
            setTime(elapsed); 
            
            setBall(prevBall => {
                if (!prevBall) return null;
                
                // --- PHASE 3: Ball Caught / Intercepted (Run After Catch) ---
                if (prevBall.caught || prevBall.interception) {
                    const carrierPlayer = players.find(p => p.name === prevBall.carrier);
                    if (!carrierPlayer) return prevBall;

                    const [cx, cy] = getPlayerPos(carrierPlayer, elapsed, prevBall.catchTime, null);
                    
                    const isOutOfBounds = (cx <= LEFT_BOUNDARY || cx >= RIGHT_BOUNDARY || cy <= FRONT_BOUNDARY || cy >= BACK_BOUNDARY);
                    const isTouchdown = cy <= TOP_ENDZONE_LINE;
                    
                    const defenders = players.filter(p => p.side === 'defense');
                    
                    let isTackled = false;
                    
                    if (prevBall.caught) {
                        isTackled = defenders.some(d => {
                            const [dx, dy] = getPlayerPos(d, elapsed, prevBall.catchTime, [cx, cy]); 
                            const distance = Math.sqrt(Math.pow(cx - dx, 2) + Math.pow(cy - dy, 2));
                            
                            return distance <= TACKLE_RADIUS; 
                        });
                    } else if (prevBall.interception) {
                        const offensivePlayers = players.filter(p => p.side === 'offense' && p.type !== 'dl');
                        isTackled = offensivePlayers.some(o => {
                            const [ox, oy] = getPlayerPos(o, elapsed, prevBall.catchTime, [cx, cy]); 
                            const distance = Math.sqrt(Math.pow(cx - ox, 2) + Math.pow(cy - oy, 2));
                            return distance <= TACKLE_RADIUS; 
                        });
                    }
                    
                    let playIsTerminatingInThisFrame = false; 

                    if (isTackled || isOutOfBounds || isTouchdown) {
                        playIsTerminatingInThisFrame = true; 
                        setRunning(false); 
                        
                        if (isTouchdown) {
                            setPassStatus("TOUCHDOWN"); 
                        } else if (isTackled) {
                            if (prevBall.caught) {
                                setPassStatus("COMPLETE - TACKLED"); 
                            } else if (prevBall.interception) {
                                setPassStatus("INTERCEPTION - TACKLED");
                            }
                        } else if (isOutOfBounds) {
                            if (prevBall.caught) {
                                setPassStatus("COMPLETE - OUT OF BOUNDS");
                            } else if (prevBall.interception) {
                                setPassStatus("INTERCEPTION - OUT OF BOUNDS");
                            }
                        }
                    } 
                    
                    if (running && !playIsTerminatingInThisFrame) {
                        if (prevBall.caught) {
                            setPassStatus("COMPLETE");
                        } else if (prevBall.interception) {
                            setPassStatus("INTERCEPTION");
                        }
                    }

                    const pxDiff = startYardsLine - cy;
                    const yards = Math.round(pxDiff / PX_PER_YARD); 
                    setYardsGained(yards);

                    return { ...prevBall, pos: [cx, cy] };
                }

                // --- PHASE 1: QB Decision Phase ---
                if (!prevBall.thrown) { 
                    
                    if (elapsed >= QB_THROW_TIME) { 
                        setRunning(false);
                        setPassStatus("SACK");
                        return prevBall; 
                    }
                    
                    if (elapsed >= 3000) { 
                        
                        const allPlayers = players;
                        const eligibleReceivers = allPlayers.filter(p => p.side === 'offense' && (p.type === "receiver" || p.type === "te" || p.type === "rb")); 
                        const defenders = allPlayers.filter(p => p.side === 'defense');

                        if (!eligibleReceivers.length) {
                            setRunning(false);
                            setPassStatus("INCOMPLETE - NO TARGET");
                            return prevBall;
                        }

                        // --- QB TARGET PRIORITY LOGIC ---
                        const priorityOrder = ['WR1', 'WR2', 'WR3', 'TE', 'RB'];
                        const maxPriorityBonus = 200; 
                        const priorityMap = {};
                        priorityOrder.forEach((name, index) => {
                            priorityMap[name] = maxPriorityBonus - (index * (maxPriorityBonus / (priorityOrder.length - 1))); 
                        });
                        
                        let bestScore = -Infinity;
                        let bestTargetName = null;
                        
                        for (const receiver of eligibleReceivers) {
                            let score = calculateOpennessScore(receiver, defenders, elapsed); 
                            
                            const priorityBonus = priorityMap[receiver.name] || 0;
                            score += priorityBonus;

                            if (score > bestScore) {
                                bestScore = score;
                                bestTargetName = receiver.name;
                            }
                        }
                        
                        if (bestTargetName) {
                            const targetPlayer = allPlayers.find(p => p.name === bestTargetName);
                            
                            const [finalX, finalY] = getPlayerPos(targetPlayer, elapsed + BALL_TRAVEL_TIME, 0); 

                            setPassStatus("THROWN");
                            return { 
                                ...prevBall, 
                                thrown: true, 
                                target: bestTargetName, 
                                t: 0, 
                                finalX: finalX, 
                                finalY: finalY  
                            };
                        }
                        
                        return prevBall;
                    }
                    return prevBall;
                }


                // --- PHASE 2: Ball in Air (Interception/Incompletion Check) ---
                if (prevBall.thrown && prevBall.target && !prevBall.caught && !prevBall.interception) {
                    const targetPlayer = players.find(p => p.name === prevBall.target);
                    const qbData = routeData.QB;
                    
                    if (!targetPlayer || !qbData || prevBall.finalX === null) return prevBall; 
                    
                    const tx = prevBall.finalX; 
                    const ty = prevBall.finalY; 
                    
                    const [sx, sy] = qbData.start; 
                    
                    const t = prevBall.t + effectiveFrameRate; 
                    const progress = Math.min(t / BALL_TRAVEL_TIME, 1); 
                    
                    const x = sx + (tx - sx) * progress;
                    const arcHeight = 30;
                    const y = sy + (ty - sy) * progress - arcHeight * Math.sin(Math.PI * progress);
                    
                    const ballPos = [x, y];
                    
                    const defenders = players.filter(p => p.side === 'defense' && p.type !== 'dl');

                    let interceptionHappened = false;
                    let interceptingDefender = null;
                    let deflectionHappened = false; 

                    for (const defender of defenders) {
                        const [dx, dy] = getPlayerPos(defender, elapsed, 0); 
                        
                        const distanceToBall = Math.sqrt(Math.pow(x - dx, 2) + Math.pow(y - dy, 2));
                        const distanceToTrajectory = distToSegment([dx, dy], [sx, sy], [tx, ty]);
                        
                        if (distanceToBall <= DEF_INTERCEPTION_RADIUS && progress >= 0.7) {
                            interceptionHappened = true;
                            interceptingDefender = defender.name;
                            break; 
                        }
                        
                        if (distanceToTrajectory <= DEFLECTION_RADIUS && distanceToBall <= CATCH_RADIUS) { 
                            deflectionHappened = true;
                            break;
                        }
                    }
                    
                    if (progress >= 1) {
                        
                        if (interceptionHappened) {
                            setPassStatus("INTERCEPTION");
                            return { 
                                ...prevBall, 
                                caught: false, 
                                interception: true, 
                                carrier: interceptingDefender, 
                                catchTime: elapsed,
                                pos: ballPos 
                            };
                        }

                        const [rx, ry] = getPlayerPos(targetPlayer, elapsed, 0); 
                        const finalDistance = Math.sqrt(Math.pow(tx - rx, 2) + Math.pow(ty - ry, 2));
                        
                        if (deflectionHappened || finalDistance > CATCH_RADIUS) {
                            setRunning(false); 
                            setPassStatus("INCOMPLETE");
                            return { ...prevBall, pos: ballPos }; 
                        } else {
                            setPassStatus("COMPLETE");
                            return { 
                                ...prevBall, 
                                caught: true, 
                                carrier: prevBall.target, 
                                catchTime: elapsed,
                                pos: ballPos 
                            };
                        }

                    }
                    
                    return { ...prevBall, t: t, pos: ballPos }; 
                }
                
                return prevBall;
            });
            
            animationFrameId.current = requestAnimationFrame(loop);
        };
        animationFrameId.current = requestAnimationFrame(loop);
        return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }, [running, players, mode, routeData, startYardsLine, playbackSpeedMultiplier, QB_THROW_TIME]); 

    // ================= RENDER =================

    const yardNumbers = [0, 10, 20, 30, 40, 50, 40, 30, 20, 10, 0];
    const stageCursor = mode === 'setup' && editingPlayer ? 'crosshair' : 'default';
    
    // Map the playbackSpeedMultiplier (1.0 to 10.0) to a slider value (1 to 10)
    const sliderValue = Math.round(playbackSpeedMultiplier);
    const speedLabel = sliderValue + "x";

    const playerOrderMap = {};
    const ALL_PLAYERS_NAMES = [...ALL_OFFENSE_PLAYERS, ...defensePlayers.map(p => p.name)];
    ALL_PLAYERS_NAMES.forEach((name, index) => {
        playerOrderMap[name] = index; 
    });
    
    let carrierPosForRender = null;
    if (ball?.carrier && (ball.caught || ball.interception)) {
        const carrierPlayer = players.find(cp => cp.name === ball.carrier);
        if (carrierPlayer) {
            const racTime = ball.catchTime;
            carrierPosForRender = getPlayerPos(carrierPlayer, time, racTime, null); 
        }
    }


    return (
        // --- NEW OUTER CONTAINER: Column layout to place header above content ---
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px" }}>
            
            {/* --- NEW TITLE: ROUTE THAT --- */}
            <div style={{ 
                fontFamily: "'Press Start 2P', cursive", 
                fontSize: "36px", 
                color: "#ffcc00", // Yellow/Gold
                textShadow: '0 0 10px #00ff00, 0 0 20px #00ff00', // Neon Green Glow
                marginBottom: '20px',
                padding: '10px 20px',
                border: '2px solid #ffcc00',
                backgroundColor: 'rgba(0,0,0,0.5)',
                letterSpacing: '5px'
            }}>
                ROUTE THAT
            </div>
            
            {/* --- MAIN CONTENT CONTAINER (Horizontal Flex for Controls & Field) --- */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: '20px' }}>
                
                {/* --- CONTROL COLUMN (LEFT SIDE) --- */}
                <div style={{ width: 250, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    
                    {/* --- SAVE/LOAD PLAY CONTROLS --- */}
                    <div style={{ padding: '10px', background: '#444', color: 'white', borderRadius: '5px', border: '1px solid #666' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'lime' }}>Manage Plays</h4>
                        
                        <button 
                            onClick={handleSavePlay}
                            style={{ padding: '8px', background: 'gold', color: 'black', fontWeight: 'bold', width: '100%', marginBottom: '10px' }}
                            disabled={mode !== 'setup'}
                        >
                            SAVE CURRENT PLAY
                        </button>
                        
                        {/* Display Status Message */}
                        {message && <p style={{ fontSize: '12px', margin: '5px 0', color: message.includes('Error') || message.includes('empty') ? 'red' : 'yellow' }}>{message}</p>}
                        
                        <h5 style={{ margin: '10px 0 5px 0' }}>Load Saved Plays:</h5>
                        
                        {savedPlaysList.length === 0 ? (
                            <p style={{ fontSize: '12px', color: 'lightgray' }}>No custom plays saved locally.</p>
                        ) : (
                            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #555', padding: '5px', background: '#333' }}>
                                {savedPlaysList.map(play => (
                                    <div key={play.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dotted #555' }}>
                                        <span style={{ fontSize: '14px', flexGrow: 1 }}>{play.name}</span>
                                        <button 
                                            onClick={() => handleLoadPlay(play.name)}
                                            style={{ marginLeft: '5px', padding: '2px 8px', fontSize: '10px', background: 'blue', color: 'white' }}
                                        >
                                            LOAD
                                        </button>
                                        <button 
                                            onClick={() => handleDeletePlay(play.name)}
                                            style={{ marginLeft: '5px', padding: '2px 8px', fontSize: '10px', background: 'red', color: 'white' }}
                                        >
                                            DEL
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* --- CONTROLS / MODE TOGGLE (Includes speed slider and setup phase controls) --- */}
                    <div style={{ padding: '10px', background: '#333', color: 'white' }}>
                        
                        {/* --- PLAYBACK SPEED SLIDER --- */}
                        <div style={{ padding: '10px', border: '1px solid gray', borderRadius: '5px' }}>
                            <label htmlFor="speed-slider" style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                                Play Speed: <span style={{ color: 'yellow' }}>{speedLabel}</span>
                            </label>
                            <input
                                type="range"
                                id="speed-slider"
                                min="1"
                                max="10"
                                // Slider value is now equal to the multiplier (1 to 10)
                                value={sliderValue}
                                onChange={(e) => {
                                    // The multiplier is now directly the slider value, which makes 1 the slowest and 10 the fastest
                                    const newMultiplier = parseInt(e.target.value, 10);
                                    setPlaybackSpeedMultiplier(newMultiplier);
                                }}
                                style={{ width: '100%' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                                <span>1x (Slowest)</span>
                                <span>10x (Fastest)</span>
                            </div>
                        </div>


                        {/* EDITOR CONTROLS (Only visible in Setup Mode) */}
                        {mode === 'setup' && (
                            <div style={{ marginTop: '5px' }}>
                                {/* PHASE STATUS AND BUTTON */}
                                <h4 style={{ marginBottom: 5, color: setupPhase === 'formation' ? 'lime' : 'yellow' }}>
                                    Phase: {setupPhase.toUpperCase()}
                                </h4>

                                {setupPhase === 'formation' ? (
                                    <>
                                        <p style={{ fontSize: '12px', margin: '5px 0' }}>
                                            Drag the player circles to set your formation.
                                        </p>
                                        <button 
                                            onClick={() => setSetupPhase('routes')}
                                            style={{ padding: '8px 15px', background: 'lime', color: 'black', fontWeight: 'bold' }}
                                        >
                                            CONFIRM FORMATION (START ROUTES)
                                        </button>
                                        {/* Display LOS to the user for clarification */}
                                        <p style={{ fontSize: '10px', margin: '5px 0', color: 'red' }}>
                                            (Offensive players cannot cross the visible red line)
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        **Editing Player:** {EDITABLE_PLAYERS.map(role => (
                                            <button 
                                                key={role}
                                                onClick={() => setEditingPlayer(role)}
                                                style={{ margin: '0 5px', background: editingPlayer === role ? 'yellow' : 'gray' }}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                        {/* RESET ROUTE BUTTON */}
                                        <button 
                                            onClick={() => resetPlayerRoute(editingPlayer)} 
                                            style={{ margin: '0 5px', background: 'red', color: 'white' }}
                                        >
                                            RESET {editingPlayer} ROUTE
                                        </button>
                                        <p style={{ fontSize: '12px', margin: '5px 0' }}>
                                            Click field to draw points for **{editingPlayer}**. (Time is now calculated by speed)
                                        </p>
                                    </>
                                )}
                                
                                {/* START SIMULATION BUTTON (visible when ready to run) */}
                                <button 
                                    onClick={() => {
                                        setMode('run');
                                        compilePlay(); 
                                        setRunning(false); // Set to false to prevent immediate start
                                    }}
                                    style={{ marginTop: '10px' }}
                                >
                                    START CUSTOM SIMULATION
                                </button>
                            </div>
                        )}
                    </div>

                    {/* --- SCOREBOARD & RUN BUTTONS (RUN MODE ONLY) --- */}
                    {mode === 'run' && (
                        <>
                            <div 
                                // Scoreboard height kept at 80 (from previous request)
                                style={{ height: 80, background: "#000", border: "4px solid #00ff00", color: "#00ff00", fontFamily: "'Press Start 2P', cursive", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "5px 0", fontSize: "14px" }}
                            >
                                <div style={{ textAlign: "center" }}><div style={{ fontSize: "10px" }}>STATUS</div><div style={{ fontSize: "18px", marginTop: "4px", color: (passStatus.includes("TOUCHDOWN") || passStatus.includes("INTERCEPTION") || passStatus.includes("INCOMPLETE") || passStatus.includes("TACKLED") || passStatus === "SACK") ? "yellow" : (passStatus === "THROWN" || passStatus === "COMPLETE" ? "#00ff00" : "white") }}>{passStatus.toUpperCase()}</div></div>
                                <div style={{ height: "100%", borderLeft: "2px solid #00ff00" }}></div>
                                <div style={{ textAlign: "center" }}><div style={{ fontSize: "10px" }}>YARDS GAINED</div><div style={{ fontSize: "18px", marginTop: "4px" }}>{yardsGained}</div></div>
                            </div>

                            {/* GAMEPLAY BUTTONS */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                                {/* START/PAUSE BUTTON */}
                                <button onClick={() => setRunning(!running)} style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", padding: "10px 10px", border: "2px solid #fff", background: running ? 'darkred' : 'green', color: "white" }}>
                                    {running ? "PAUSE" : "START"}
                                </button>
                                
                                {/* REPLAY BUTTON */}
                                <button onClick={compilePlay} style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", padding: "10px 10px", border: "2px solid #fff", background: "#555", color: "white" }}>
                                    REPLAY
                                </button>
                                
                                {/* NEW PLAY BUTTON (REPLACING OLD RESET) */}
                                <button onClick={resetToFormation} style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", padding: "10px 10px", border: "2px solid #fff", background: "orange", color: "black" }}>
                                    NEW PLAY
                                </button>

                                {/* BACK TO ROUTES BUTTON (Visible when simulation is stopped) */}
                                {!running && (
                                    <button 
                                        onClick={backToRouteEditing} 
                                        style={{ fontFamily: "'Press Start 2P', cursive", fontSize: "10px", padding: "10px 10px", border: "2px solid #fff", background: "blue", color: "white" }}
                                    >
                                        EDIT ROUTES
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* --- FIELD STAGE (RIGHT SIDE) --- */}
                <div style={{ width: FIELD_WIDTH, flexShrink: 0 }}>
                    <Stage 
                        width={FIELD_WIDTH} 
                        height={FIELD_HEIGHT} 
                        // Using onClick/onTap for unified desktop/mobile route drawing
                        onClick={mode === 'setup' && setupPhase === 'routes' ? handleFieldClick : undefined} 
                        onTap={mode === 'setup' && setupPhase === 'routes' ? handleFieldClick : undefined} 
                        style={{ cursor: stageCursor }}
                    >
                        <Layer>
                            {/* FIELD BACKGROUND & LINES */}
                            <Rect width={FIELD_WIDTH} height={ENDZONE_HEIGHT} fill="#1e90ff" />
                            <Rect y={FIELD_HEIGHT - ENDZONE_HEIGHT} width={FIELD_WIDTH} height={ENDZONE_HEIGHT} fill="#ff4500" />
                            <Rect y={ENDZONE_HEIGHT} width={FIELD_WIDTH} height={PLAYABLE_HEIGHT} fill="#4caf50" />
                            
                            {/* Line of Scrimmage Visual Marker (Y = 540) - Only visible in formation setup */}
                            {mode === 'setup' && setupPhase === 'formation' && (
                                <Line 
                                    points={[0, LOS_Y, FIELD_WIDTH, LOS_Y]} 
                                    stroke="red" 
                                    strokeWidth={3} 
                                    dash={[10, 5]}
                                    opacity={0.7}
                                />
                            )}
                            
                            {yardNumbers.map((num, i) => {
                                const y = ENDZONE_HEIGHT + i * (PLAYABLE_HEIGHT / 10);
                                return (
                                    <React.Fragment key={i}>
                                        <Line points={[0, y, FIELD_WIDTH, y]} stroke="white" strokeWidth={2} />
                                        <Text text={num} x={5} y={y - 10} fill="white" /><Text text={num} x={FIELD_WIDTH - 30} y={y - 10} fill="white" />
                                    </React.Fragment>
                                );
                            })}
                            <Text text="R" fontSize={72} fill="yellow" x={FIELD_WIDTH / 2 - 24} y={FIELD_HEIGHT / 2 - 36} fontFamily="'Press Start 2P', cursive" />
                            
                            {/* --- ROUTE EDITOR LINES & POINTS (SETUP MODE ONLY) --- */}
                            {mode === 'setup' && EDITABLE_PLAYERS.map(name => {
                                const data = routeData[name];
                                const allPoints = [data.start, ...data.waypoints.map(wp => [wp[0], wp[1]])]; 
                                const flatPoints = allPoints.flat();
                                
                                return (
                                    <React.Fragment key={`route-${name}`}>
                                        <Line 
                                            points={flatPoints} 
                                            stroke={name === editingPlayer ? 'yellow' : 'rgba(255,255,255,0.5)'}
                                            strokeWidth={3}
                                            lineJoin="round"
                                            dash={[10, 5]}
                                        />
                                        {/* Draw Waypoints (Only draggable in 'routes' phase) */}
                                        {data.waypoints.map((wp, index) => (
                                            <Circle
                                                key={`${name}-wp-${index}`}
                                                x={wp[0]}
                                                y={wp[1]}
                                                radius={name === editingPlayer ? 8 : 5}
                                                fill={name === editingPlayer ? 'red' : 'rgba(255,255,255,0.8)'}
                                                draggable={setupPhase === 'routes'} 
                                                onDragMove={(e) => handleWaypointDrag(name, index, e.target.position())}
                                                onDblClick={() => {
                                                    if (setupPhase === 'routes') {
                                                        alert("Time for route segments is now calculated automatically based on distance and standard player speed.");
                                                    }
                                                }}
                                            />
                                        ))}
                                    </React.Fragment>
                                );
                            })}

                            {/* --- PLAYERS (ALL PLAYERS: OFFENSE + DEFENSE) --- */}
                            {players.map((p, i) => {
                                const racTime = ball?.carrier ? ball.catchTime : 0;
                                
                                const [x, y] = getPlayerPos(p, time, racTime, carrierPosForRender); 
                                
                                const isDraggableInSetup = mode === 'setup' && setupPhase === 'formation' && p.side === 'offense';
                                
                                const index = playerOrderMap[p.name] || 0;
                                const offset_magnitude = 3; 
                                const offset_x = (index % 3) * offset_magnitude - offset_magnitude; 
                                const offset_y = Math.floor(index / 3) * offset_magnitude - offset_magnitude; 
                                
                                const finalX = x + offset_x * 0.5;
                                const finalY = y + offset_y * 0.5;
                                
                                let fill;
                                if (p.side === 'defense') {
                                    fill = p.type === 'dl' ? 'darkred' : 
                                        p.type === 'lb' ? 'red' : 
                                        p.type === 'cb' ? 'maroon' : 'purple'; 
                                } else {
                                    fill = p.type === "qb" ? "blue" : 
                                        p.type === "rb" ? "green" : 
                                        p.type === "receiver" || p.type === "te" ? "orange" : 
                                        p.type === "ol" ? "gray" : "white";
                                }
                                
                                const isCarrier = ball?.carrier === p.name && (ball?.caught || ball?.interception);
                                const displayFill = isCarrier ? 'yellow' : fill;


                                return (
                                    <React.Fragment key={p.name}>
                                        <Circle
                                            // Give the Circle a name prop so we can retrieve it in handlePlayerDragMove
                                            name={p.name} 
                                            x={finalX}
                                            y={finalY}
                                            radius={p.side === 'offense' && p.type === "ol" ? 10 : 8}
                                            fill={displayFill}
                                            draggable={isDraggableInSetup} 
                                            // Use onDragMove to actively restrict the Y position and update state
                                            onDragMove={handlePlayerDragMove} 
                                        />
                                        {/* Player Name/Type */}
                                        <Text
                                            text={p.side === 'defense' ? p.type.toUpperCase() : p.name}
                                            fontSize={p.side === 'defense' ? 8 : 12}
                                            fill="white"
                                            x={p.side === 'defense' ? finalX - 10 : finalX - 14}
                                            y={finalY - 22}
                                        />
                                    </React.Fragment>
                                );
                            })}

                            {/* --- THE BALL (Ellipse Football) --- */}
                            {ball && (ball.thrown || ball.caught || ball.interception) && (
                                <React.Fragment>
                                    {/* Brown Oval Football Shape (Ellipse) */}
                                    <Ellipse
                                        x={ball.pos[0]}
                                        y={ball.pos[1]}
                                        radiusX={10} // Width of the football
                                        radiusY={6}  // Height of the football
                                        fill={'#8B4513'} // Saddle Brown color
                                        stroke={'black'}
                                        strokeWidth={1}
                                    />
                                    {/* Simple white line for laces */}
                                    <Line
                                        points={[
                                            ball.pos[0] - 2, ball.pos[1], 
                                            ball.pos[0] + 2, ball.pos[1]
                                        ]}
                                        stroke="white"
                                        strokeWidth={3}
                                    />
                                </React.Fragment>
                            )}
                        </Layer>
                    </Stage>
                </div>
            </div>
        </div>
    );
}