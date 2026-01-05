// Field.js

import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Line } from "react-konva";
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
    
    const timeRef = useRef(0);
    const animationFrameId = useRef(null);

    // ================= HELPER FUNCTIONS =================
    
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
        
        // Reset routes to default when clicking NEW PLAY
        if (isCustom) {
            setRouteData(defaultRouteData); 
            // The defense must be regenerated based on the now-reset routes
            const { players: newDefense, coverage } = generateRandomDefense(defaultRouteData); 
            setDefensePlayers(newDefense);
            setDefensiveCoverage(coverage);
        } else {
             // For standard plays, we still reset defense and coverage
             const dataToUse = selectedPlayProp ? selectedPlayProp.routeData : defaultRouteData;
             const { players: newDefense, coverage } = generateRandomDefense(dataToUse); 
             setDefensePlayers(newDefense);
             setDefensiveCoverage(coverage);
        }
    }
    
    // This handler now works for both mouse click and finger tap
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
    
    const handleStartDrag = (player, newPos) => {
        setRouteData(prevData => {
            const currentRoute = prevData[player];
            return {
                ...prevData,
                [player]: {
                    ...currentRoute,
                    start: [Math.round(newPos.x), Math.round(newPos.y)]
                }
            };
        });
    };

    const loadPlayData = (play) => {
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
        if (isCustom) {
            setMode('setup');
            setSetupPhase('formation'); 
            const dataToUse = Object.keys(routeData).length > 0 ? routeData : defaultRouteData;
            const { players: initialDefense, coverage } = generateRandomDefense(dataToUse);
            setDefensePlayers(initialDefense);
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
                // FIX: Corrected typo from animationFrameFrameId to animationFrameId
                cancelAnimationFrame(animationFrameId.current); 
                animationFrameId.current = null;
            }
            return; 
        }
        
        // FIX: The effective frame rate is now BASE_FRAME_RATE * MULTIPLIER.
        // Higher multiplier (10x) means a larger time step, resulting in faster play.
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
                    
                    // Check for tackle only if the carrier is an offensive player (prevBall.caught is true)
                    if (prevBall.caught) {
                        isTackled = defenders.some(d => {
                            const [dx, dy] = getPlayerPos(d, elapsed, prevBall.catchTime, [cx, cy]); 
                            const distance = Math.sqrt(Math.pow(cx - dx, 2) + Math.pow(cy - dy, 2));
                            
                            return distance <= TACKLE_RADIUS; 
                        });
                    } else if (prevBall.interception) {
                         // Check for tackle if the carrier is a defensive player (interception is true)
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
                        
                        // --- SCOREBOARD UPDATE (TOUCHDOWN/TACKLE) ---
                        if (isTouchdown) {
                            setPassStatus("TOUCHDOWN"); 
                        } else if (isTackled) {
                            // Updated logic for TACKLED status
                            if (prevBall.caught) {
                                setPassStatus("COMPLETE - TACKLED"); // Requested Status
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
                    
                    // Only set intermediate status if the play is still running AND it didn't terminate in this specific frame
                    if (running && !playIsTerminatingInThisFrame) {
                        // Display base status while RAC is ongoing
                        if (prevBall.caught) {
                            setPassStatus("COMPLETE");
                        } else if (prevBall.interception) {
                            setPassStatus("INTERCEPTION");
                        }
                    }

                    // Correct calculation for Yards Gained
                    const pxDiff = startYardsLine - cy;
                    const yards = Math.round(pxDiff / PX_PER_YARD); 
                    setYardsGained(yards);

                    return { ...prevBall, pos: [cx, cy] };
                }

                // --- PHASE 1: QB Decision Phase ---
                if (!prevBall.thrown) { 
                    
                    // --- SACK LOGIC ---
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
                            
                            // Calculate and store the fixed target spot for the throw
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
        <div style={{ position: "relative", width: FIELD_WIDTH }}>
            {/* --- CONTROLS / MODE TOGGLE --- */}
            <div style={{ padding: '10px', background: '#333', color: 'white' }}>
                <h3 style={{ margin: 0, color: mode === 'setup' ? 'yellow' : 'cyan' }}>
                    Mode: {mode.toUpperCase()}
                </h3>
                {defensiveCoverage && (
                    <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: 'red' }}>
                        DEFENSE: **{defensiveCoverage.toUpperCase().replace('COVER', 'COVER ')}**
                    </p>
                )}
                
                {/* --- PLAYBACK SPEED SLIDER --- */}
                <div style={{ marginTop: '10px', padding: '10px', border: '1px solid gray', borderRadius: '5px' }}>
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
                                <p style={{ fontSize: '12px', margin: '5px 0' }}>
                                    Click/Tap field to draw points for **{editingPlayer}**. (Time is now calculated by speed)
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

            {/* --- SCOREBOARD & RUN BUTTONS --- */}
            {mode === 'run' && (
                <>
                    <div 
                        style={{ height: 60, background: "#000", border: "4px solid #00ff00", color: "#00ff00", fontFamily: "'Press Start 2P', cursive", display: "flex", justifyContent: "space-around", alignItems: "center", padding: "5px 0", fontSize: "14px", marginTop: '5px' }}
                    >
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: "10px" }}>STATUS</div><div style={{ fontSize: "18px", marginTop: "4px", color: (passStatus.includes("TOUCHDOWN") || passStatus.includes("INTERCEPTION") || passStatus.includes("INCOMPLETE") || passStatus.includes("TACKLED") || passStatus === "SACK") ? "yellow" : (passStatus === "THROWN" || passStatus === "COMPLETE" ? "#00ff00" : "white") }}>{passStatus.toUpperCase()}</div></div>
                        <div style={{ height: "100%", borderLeft: "2px solid #00ff00" }}></div>
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: "10px" }}>YARDS GAINED</div><div style={{ fontSize: "18px", marginTop: "4px" }}>{yardsGained}</div></div>
                    </div>
                    
                    {/* START/PAUSE BUTTON */}
                    <button onClick={() => setRunning(!running)} style={{ position: "absolute", top: 270, left: 10, zIndex: 10, fontFamily: "'Press Start 2P', cursive", fontSize: "10px", padding: "5px 10px", border: "2px solid #fff", background: running ? 'darkred' : 'green', color: "white" }}>
                        {running ? "PAUSE" : "START"}
                    </button>
                    
                    {/* REPLAY BUTTON */}
                    <button onClick={compilePlay} style={{ position: "absolute", top: 270, left: 110, zIndex: 10, fontFamily: "'Press Start 2P', cursive", fontSize: "10px", padding: "5px 10px", border: "2px solid #fff", background: "#555", color: "white" }}>
                        REPLAY
                    </button>
                    
                    {/* NEW PLAY BUTTON (REPLACING OLD RESET) */}
                    <button onClick={resetToFormation} style={{ position: "absolute", top: 270, left: 210, zIndex: 10, fontFamily: "'Press Start 2P', cursive", fontSize: "10px", padding: "5px 10px", border: "2px solid #fff", background: "orange", color: "black" }}>
                        NEW PLAY
                    </button>
                </>
            )}

            {/* --- FIELD STAGE --- */}
            <Stage 
                width={FIELD_WIDTH} 
                height={FIELD_HEIGHT} 
                // Enable click (desktop) and tap (mobile) for route drawing
                onClick={mode === 'setup' && setupPhase === 'routes' ? handleFieldClick : undefined} 
                onTap={mode === 'setup' && setupPhase === 'routes' ? handleFieldClick : undefined} 
                style={{ cursor: stageCursor }}
            >
                <Layer>
                    {/* FIELD BACKGROUND & LINES */}
                    <Rect width={FIELD_WIDTH} height={ENDZONE_HEIGHT} fill="#1e90ff" />
                    <Rect y={FIELD_HEIGHT - ENDZONE_HEIGHT} width={FIELD_WIDTH} height={ENDZONE_HEIGHT} fill="#ff4500" />
                    <Rect y={ENDZONE_HEIGHT} width={FIELD_WIDTH} height={PLAYABLE_HEIGHT} fill="#4caf50" />
                    
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
                                    x={finalX}
                                    y={finalY}
                                    radius={p.side === 'offense' && p.type === "ol" ? 10 : 8}
                                    fill={displayFill}
                                    draggable={isDraggableInSetup} 
                                    onDragMove={(e) => handleStartDrag(p.name, e.target.position())}
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

                    {/* --- THE BALL --- */}
                    {ball && (ball.thrown || ball.caught || ball.interception) && (
                        <Circle
                            x={ball.pos[0]}
                            y={ball.pos[1]}
                            radius={4}
                            fill={ball.thrown && !ball.caught && !ball.interception ? 'white' : 'transparent'} 
                            stroke={ball.thrown && !ball.caught && !ball.interception ? 'black' : 'transparent'}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    );
}