import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Line } from "react-konva";
import Konva from "konva";

// ================= FIELD CONSTANTS (Updated QB Time) =================
const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 800;
const ENDZONE_HEIGHT = 50;
const PLAYABLE_HEIGHT = FIELD_HEIGHT - 2 * ENDZONE_HEIGHT;
const PX_PER_YARD = 7;

const BASE_FRAME_RATE = 16.67; // ms (approx 60 FPS)
const STANDARD_PLAYER_SPEED = 0.055; // Approx 5.5 yards per second (fast running)

// Boundary limits
const LEFT_BOUNDARY = 0;
const RIGHT_BOUNDARY = FIELD_WIDTH;
const TOP_ENDZONE_LINE = ENDZONE_HEIGHT;
const FRONT_BOUNDARY = ENDZONE_HEIGHT - (5 * PX_PER_YARD); 
const BACK_BOUNDARY = FIELD_HEIGHT + (5 * PX_PER_YARD); 

// DEFENSE CONSTANTS
const DEFENSIVE_LINE_Y = 540 - 2 * PX_PER_YARD; // Just across the line of scrimmage (LOS)
const DEFENSIVE_LINE_COUNT = 4;
const SECONDARY_COUNT = 7;

// THRESHOLDS (in pixels)
const CATCH_RADIUS = 15; // How close receiver must be to catch the ball
const DEF_INTERCEPTION_RADIUS = 10; // Defender proximity needed for interception
const DEFLECTION_RADIUS = 5; // Defender proximity to the pass line segment needed for deflection. 
const TACKLE_RADIUS = 15; // Tighter tackle radius for slightly harder tackling.
const QB_THROW_TIME = 4000; // ADJUSTED: QB throws at 4.0 seconds (4000ms)

// PASS CONSTANTS
const BALL_TRAVEL_TIME = 1200; // How long the ball is in the air (1.2 seconds)
// ==================================================

// --- UTILITY FUNCTION (0) - Distance to Segment (Unchanged) ---
const distToSegment = (p, a, b) => {
    const [x, y] = p;
    const [x1, y1] = a;
    const [x2, y2] = b;
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) {
        param = (A * C + B * D) / len_sq;
    }
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
};


// --- UTILITY FUNCTION (1) - Generate Movements (Unchanged) ---
const generateMovements = (startPos, waypoints, isOffense = false, playerType = null) => {
    
    // Players defined as 'ol', 'qb', or 'dl' are STATIC and do not move.
    if (playerType === 'ol' || playerType === 'qb' || playerType === 'dl') {
        return [{ 
            t_start: 0, 
            t_end: Infinity, 
            x_func: (t) => 0, 
            y_func: (t) => 0, 
        }];
    }
    
    const movements = [];
    let prevX = startPos[0];
    let prevY = startPos[1];
    let prevTime = 0;

    const validWaypoints = waypoints.filter(wp => wp.length >= 2); 

    if (validWaypoints.length === 0) {
        movements.push({ 
            t_start: 0, 
            t_end: Infinity, 
            x_func: (t) => 0, 
            y_func: (t) => 0, 
        });
        return movements;
    }

    for (let i = 0; i < validWaypoints.length; i++) {
        const [targetX, targetY] = validWaypoints[i]; 
        
        const distance = Math.sqrt(Math.pow(targetX - prevX, 2) + Math.pow(targetY - prevY, 2));
        const duration = distance / STANDARD_PLAYER_SPEED; 
        const targetTime = prevTime + duration;

        const dx = targetX - prevX;
        const dy = targetY - prevY;

        const Mx = dx / duration;
        const My = dy / duration;

        movements.push({ 
            t_start: prevTime, 
            t_end: targetTime, 
            x_func: (t) => Mx * t, 
            y_func: (t) => My * t, 
        });

        prevX = targetX;
        prevY = targetY;
        prevTime = targetTime;

        if (i === validWaypoints.length - 1) {
            movements.push({ 
                t_start: targetTime, 
                t_end: Infinity, 
                x_func: (t) => 0, 
                y_func: (t) => 0,
            });
        }
    }
    return movements;
};


// --- UTILITY FUNCTION (2) - Get Player Position (FIXED STATIC PLAYERS & RAC TARGETING) ---
const getPlayerPos = (player, elapsed, racTimeOffset = 0, carrierPos = null) => {
    const startX = player.initialStart ? player.initialStart[0] : player.start[0];
    const startY = player.initialStart ? player.start[1] : player.start[1];
    
    // FIX: Ensure QB, OL, and DL are always static
    const STATIC_TYPES = ['ol', 'qb', 'dl'];
    if (STATIC_TYPES.includes(player.type)) {
        return [startX, startY];
    }
    
    let currentX = startX;
    let currentY = startY;

    let accumulatedDx = 0;
    let accumulatedDy = 0;
    
    const isRACPhase = racTimeOffset > 0;
    
    // === Defensive Pursuit Override: Secondary Defenders in RAC Phase ===
    if (isRACPhase && player.side === 'defense') { // player.type !== 'dl' is redundant due to early return
        
        // Defender's position at the time of the catch (RAC start)
        const [initialX, initialY] = getPlayerPos(player, racTimeOffset, 0); 

        // Time spent in pursuit
        const pursuitDuration = elapsed - racTimeOffset;
        
        // Distance traveled by the defender (slightly faster speed to converge quickly)
        const PURSUIT_SPEED = STANDARD_PLAYER_SPEED * 1.15; // 15% faster pursuit speed
        const distanceTraveled = PURSUIT_SPEED * pursuitDuration;
        
        // --- Target the actual ball carrier's position ---
        let targetX, targetY;
        
        if (carrierPos) {
            targetX = carrierPos[0];
            targetY = carrierPos[1];
        } else {
            // Fallback to endzone target if carrierPos is somehow null (should not happen)
            targetX = FIELD_WIDTH / 2;
            targetY = TOP_ENDZONE_LINE - 20; 
        }

        // Calculate the pursuit direction vector
        const dX = targetX - initialX;
        const dY = targetY - initialY;
        const totalDistance = Math.sqrt(dX * dX + dY * dY);
        
        // Normalize the vector
        const normDx = dX / (totalDistance || 1);
        const normDy = dY / (totalDistance || 1);
        
        // Calculate movement along normalized vector, clamped by the target distance
        const pursuitDx = normDx * Math.min(distanceTraveled, totalDistance);
        const pursuitDy = normDy * Math.min(distanceTraveled, totalDistance);

        currentX = initialX + pursuitDx;
        currentY = initialY + pursuitDy;

    } else if (racTimeOffset === 0) {
        // --- Phase 1: Pre-RAC (Route running) ---
        
        if (!player.movements || player.movements.length === 0) return [currentX, currentY]; 
        
        for (let i = 0; i < player.movements.length; i++) {
            const segment = player.movements[i];
            const t_start = segment.t_start;
            const t_end = segment.t_end;
            
            const t_relative_to_start_of_segment = elapsed - t_start;

            if (elapsed < t_start) {
                break; 
            }

            if (elapsed <= t_end || t_end === Infinity) {
                const dx_in_segment = segment.x_func(t_relative_to_start_of_segment);
                const dy_in_segment = segment.y_func(t_relative_to_start_of_segment);
                
                currentX = startX + accumulatedDx + dx_in_segment;
                currentY = startY + accumulatedDy + dy_in_segment;
                
                break; 
            } 
            
            const duration = t_end - t_start;
            const dx_segment_total = segment.x_func(duration);
            const dy_segment_total = segment.y_func(duration);

            accumulatedDx += dx_segment_total;
            accumulatedDy += dy_segment_total;

            if (i === player.movements.length - 1) {
                currentX = startX + accumulatedDx;
                currentY = startY + accumulatedDy;
            }
        }

    } else {
        // --- Phase 2: Carrier Post-RAC (Offensive Carrier) ---
        const [initialRacX, initialRacY] = getPlayerPos(player, racTimeOffset, 0); 
        
        const racDuration = elapsed - racTimeOffset;
        
        const distanceTraveled = STANDARD_PLAYER_SPEED * racDuration;
        
        // Simple forward progress towards the goal line (Y=0 direction is negative)
        const racDy = -distanceTraveled;
        const racDx = 0; 

        currentX = initialRacX + racDx;
        currentY = initialRacY + racDy;
    }
    
    // Boundary checks
    if (currentY < FRONT_BOUNDARY) { currentY = FRONT_BOUNDARY; } 
    else if (currentY > BACK_BOUNDARY) { currentY = BACK_BOUNDARY; }

    if (currentX < LEFT_BOUNDARY) { currentX = LEFT_BOUNDARY; } 
    else if (currentX > RIGHT_BOUNDARY) { currentX = RIGHT_BOUNDARY; }
    
    return [currentX, currentY];
};


// --- UTILITY FUNCTION (3) - Calculate Openness Score (Unchanged) ---
const calculateOpennessScore = (receiver, defenders, throwTime) => {
    const catchTime = throwTime + BALL_TRAVEL_TIME;
    const [rx, ry] = getPlayerPos(receiver, catchTime, 0);

    const secondaryDefenders = defenders.filter(d => d.type !== 'dl');
    if (secondaryDefenders.length === 0) {
        return 1000;
    }

    let minSeparation = Infinity;
    let totalSeparation = 0;

    for (const defender of secondaryDefenders) {
        const [dx, dy] = getPlayerPos(defender, catchTime, 0); 
        const distance = Math.sqrt(Math.pow(rx - dx, 2) + Math.pow(ry - dy, 2));

        minSeparation = Math.min(minSeparation, distance);
        totalSeparation += distance;
    }

    const avgSeparation = totalSeparation / secondaryDefenders.length;

    let separationPenalty = 0;
    if (minSeparation < 15) {
        separationPenalty = (15 - minSeparation) * 50; 
    }
    
    const score = (minSeparation * 3) + (avgSeparation * 1) - separationPenalty;
    
    if (ry <= ENDZONE_HEIGHT && minSeparation < 30) {
        return score - 50; 
    }
    
    return score;
};


// --- UTILITY FUNCTION (4) - Generate Random Defense (Unchanged) ---
const generateRandomDefense = (routeData) => {
    const defense = [];
    const DL_names = ['DE1', 'DT1', 'DT2', 'DE2']; 
    const secondary_types = ['LB', 'CB', 'S'];
    const secondary_names = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
    const coverage_types = ['man', 'cover2', 'cover3'];
    const selected_coverage = coverage_types[Math.floor(Math.random() * coverage_types.length)];
    
    const offenseReceivers = ['WR1', 'WR2', 'WR3', 'TE', 'RB']
        .filter(name => routeData[name])
        .map(name => ({ name: name, x: routeData[name].start[0], y: routeData[name].start[1] }));

    // 1. Position Defensive Line (4 players)
    const offenseCenter = routeData.C ? routeData.C.start[0] : 280;
    const spread = 200; 
    for (let i = 0; i < DEFENSIVE_LINE_COUNT; i++) {
        const x = offenseCenter + (i - 1.5) * (spread / 3); 
        defense.push({
            name: DL_names[i],
            start: [Math.round(x), DEFENSIVE_LINE_Y],
            initialStart: [Math.round(x), DEFENSIVE_LINE_Y], 
            type: 'dl',
            side: 'defense',
            assignment: 'run_gap', 
            // Movements for DL are now ignored by getPlayerPos, but are included for consistency.
            movements: [], 
        });
    }

    // 2. Position Secondary (7 players) 
    const randomizedTypes = [];
    for (let i = 0; i < SECONDARY_COUNT; i++) {
        const typeIndex = Math.floor(Math.random() * secondary_types.length);
        randomizedTypes.push(secondary_types[typeIndex]);
    }

    const manAssignments = {};
    let secondaryPlayerIndex = 0;

    offenseReceivers.forEach(rec => {
        if (secondaryPlayerIndex < SECONDARY_COUNT) {
            manAssignments[secondary_names[secondaryPlayerIndex]] = rec.name;
            secondaryPlayerIndex++;
        }
    });

    const secondaryYPositions = [
        DEFENSIVE_LINE_Y - 5 * PX_PER_YARD, 
        DEFENSIVE_LINE_Y - 10 * PX_PER_YARD, 
        DEFENSIVE_LINE_Y - 20 * PX_PER_YARD, 
    ];
    
    for (let i = 0; i < SECONDARY_COUNT; i++) {
        const name = secondary_names[i];
        const type = randomizedTypes[i].toLowerCase();
        
        let initialY = secondaryYPositions[i % secondaryYPositions.length];
        let initialX = Math.round(Math.random() * (FIELD_WIDTH - 60) + 30); 

        let assignment = manAssignments[name] || null;
        
        if (selected_coverage === 'man' && assignment) {
            const targetRec = offenseReceivers.find(r => r.name === assignment);
            if (targetRec) {
                 initialX = targetRec.x + (targetRec.x < FIELD_WIDTH / 2 ? 15 : -15); 
                 initialY = targetRec.y - 10;
            }
        }

        const startPos = [initialX, initialY];

        defense.push({
            name: name,
            start: startPos,
            initialStart: startPos, 
            type: type, 
            side: 'defense',
            assignment: assignment, 
            movements: [],
        });
    }

    return { players: defense, coverage: selected_coverage };
};

// --- UTILITY FUNCTION (5) - Compile Defense Movement (Unchanged) ---
const compileDefenseMovement = (defPlayer, coverage, routeData) => {
    const LOS_Y = DEFENSIVE_LINE_Y;
    const END_PLAY_TIME = 5000; 
    
    if (defPlayer.type === 'dl') {
        // DL are now static (movement generation is still here but ignored by getPlayerPos)
        const targetX = defPlayer.start[0];
        const targetY = LOS_Y - 10; 
        return generateMovements(defPlayer.start, [[targetX, targetY]], false, 'dl'); 
    }
    
    const secondaryPlayers = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
    const defStart = defPlayer.start;

    // --- Man Coverage Movement (REALISTIC SEPARATION) ---
    if (coverage === 'man' && defPlayer.assignment) {
        const receiverName = defPlayer.assignment;
        const receiverRouteData = routeData[receiverName];
        
        if (!receiverRouteData) return generateMovements(defStart, [], false);

        const offensivePlayer = {
            start: receiverRouteData.start,
            movements: generateMovements(receiverRouteData.start, receiverRouteData.waypoints, true, receiverName.startsWith('R') ? 'rb' : 'receiver'), 
            initialStart: receiverRouteData.start
        };
        
        const defenseWaypoints = [];
        
        const SEPARATION_PIXELS = 5 + Math.random() * 10; 
        const separationAngle = Math.random() * 2 * Math.PI; 
        
        const fixedOffsetX = SEPARATION_PIXELS * Math.cos(separationAngle);
        const fixedOffsetY = SEPARATION_PIXELS * Math.sin(separationAngle);
        
        const routeTimePoints = receiverRouteData.waypoints.map(wp => wp[2]);
        const timePoints = [0, 500, ...routeTimePoints]; 
        
        const uniqueTimePoints = Array.from(new Set(timePoints)).sort((a, b) => a - b);
        
        uniqueTimePoints.forEach(t => {
            if (t >= 0 && t <= END_PLAY_TIME) {
                // Must call getPlayerPos with 0 racTime to get route position
                const [targetX, targetY] = getPlayerPos(offensivePlayer, t, 0); 
                
                const chaseX = targetX + fixedOffsetX;
                const chaseY = targetY + fixedOffsetY;
                
                defenseWaypoints.push([chaseX, chaseY]); 
            }
        });

        // Add a final static point slightly past the end of the play
        const [lastX, lastY] = defenseWaypoints[defenseWaypoints.length - 1] || defStart;
        defenseWaypoints.push([lastX, lastY]); 
        
        return generateMovements(defStart, defenseWaypoints, false, defPlayer.type);
    }
    
    // --- Zone Coverage Movement (DEEPER DROPS) --- 
    if (coverage === 'cover2' || coverage === 'cover3') {
        const intermediateY = LOS_Y - 15 * PX_PER_YARD; 
        const deepY = LOS_Y - 30 * PX_PER_YARD; 
        
        const deepDefenders = (coverage === 'cover2') ? ['D1', 'D2'] : ['D1', 'D2', 'D3'];
        let assignmentType = deepDefenders.includes(defPlayer.name) ? 'deep' : 'underneath';
        
        const defWaypoints = [];
        
        let initialTargetX, initialTargetY;

        if (assignmentType === 'deep') {
            initialTargetX = defStart[0];
            initialTargetY = deepY;
        } else { 
            const playerIndex = secondaryPlayers.indexOf(defPlayer.name);
            if (playerIndex % 2 === 0) initialTargetX = FIELD_WIDTH / 4; 
            else initialTargetX = FIELD_WIDTH * 3 / 4; 
            initialTargetY = intermediateY;
        }

        defWaypoints.push([initialTargetX, initialTargetY]); 

        let currentX = initialTargetX;
        let currentY = initialTargetY;
        
        const sidePatrol = assignmentType === 'deep' ? 40 : 20; 
        
        const holdX1 = currentX - sidePatrol;
        const holdX2 = currentX + sidePatrol;

        defWaypoints.push([holdX1, currentY]); 
        defWaypoints.push([holdX2, currentY]); 
        defWaypoints.push([currentX, currentY]); 

        return generateMovements(defStart, defWaypoints, false, defPlayer.type);
    }
    
    // Fallback: Static movement for any unassigned defender
    return generateMovements(defStart, [], false, defPlayer.type);
};


// ==================================================

export default function Field({ selectedPlayProp, isCustom }) {
    
    // --- OFFENSE PLAYER LISTS ---
    const defaultRouteData = { 
        LT: { start: [200, 540], waypoints: [] },
        LG: { start: [240, 540], waypoints: [] },
        C:  { start: [280, 540], waypoints: [] },
        RG: { start: [320, 540], waypoints: [] },
        RT: { start: [360, 540], waypoints: [] },
        QB:  { start: [280, 580], waypoints: [] },
        RB:  { start: [320, 580], waypoints: [] }, 
        TE:  { start: [420, 540], waypoints: [] }, 
        WR1: { start: [520, 540], waypoints: [] }, 
        WR2: { start: [80, 540], waypoints: [] },  
        WR3: { start: [10, 540], waypoints: [] },  
    };
    
    const LINE_PLAYERS = ['LT', 'LG', 'C', 'RG', 'RT']; 
    const EDITABLE_PLAYERS = ['QB', 'RB', 'TE', 'WR1', 'WR2', 'WR3']; 
    const ALL_OFFENSE_PLAYERS = [...LINE_PLAYERS, ...EDITABLE_PLAYERS];

    // --- EDITOR STATE (Unchanged) ---
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
    
    const [playbackSpeedMultiplier, setPlaybackSpeedMultiplier] = useState(0.2); 
    
    const timeRef = useRef(0);
    const animationFrameId = useRef(null);

    // ================= HELPER FUNCTIONS (Unchanged) =================
    const getPlayerDefinition = (name) => {
        const data = routeData[name];
        if (!data) return null;
        let type = 'receiver';
        let side = 'offense';
        if (name === 'QB') type = 'qb';
        if (name === 'RB') type = 'rb'; 
        if (LINE_PLAYERS.includes(name)) type = 'ol';
        if (name === 'TE') type = 'te';
        // Note: The playerType parameter here ensures static players get zero-movement segments
        const movements = generateMovements(data.start, data.waypoints, true, type); 
        return {
            name,
            start: data.start,
            initialStart: data.start,
            type,
            side, 
            movements,
        };
    };

    const compilePlay = () => {
        const compiledOffense = ALL_OFFENSE_PLAYERS.map(getPlayerDefinition).filter(p => p !== null);
        
        const compiledDefense = defensePlayers.map(def => ({
            ...def,
            movements: compileDefenseMovement(def, defensiveCoverage, routeData)
        }));

        setPlayers([...compiledOffense, ...compiledDefense]);
        
        setStartYardsLine(routeData.QB.start[1]);
        setPassStatus("PENDING");
        setYardsGained(0);
        timeRef.current = 0;
        setTime(0);
        // Reset Ball State for a new play
        setBall({ 
            thrown: false, 
            caught: false, 
            carrier: null, 
            pos: routeData.QB.start, 
            t: 0, 
            target: null, 
            interception: false, 
            catchTime: 0 
        });
        setRunning(false); 
    }

    const resetToFormation = () => {
        setMode('setup');
        setSetupPhase('formation');
        setRunning(false);
        
        if (isCustom) {
            const dataToUse = Object.keys(routeData).length > 0 ? routeData : defaultRouteData;
            const { players: newDefense, coverage } = generateRandomDefense(dataToUse);
            setDefensePlayers(newDefense);
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

    // --- EFFECT: Handle play loading and randomization (Unchanged) ---
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

    // --- EFFECT: Recompile on offense changes or defense randomization (Unchanged) ---
    useEffect(() => {
        compilePlay();
    }, [routeData, defensePlayers, defensiveCoverage]); 

    // ================= SIMULATION LOOP (FIXED RAC CONTINUITY) =================
    
    useEffect(() => {
        if (mode !== 'run' || !running) { 
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
                animationFrameId.current = null;
            }
            return; 
        }
        
        const effectiveFrameRate = BASE_FRAME_RATE / playbackSpeedMultiplier; 
        
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

                    // Get Carrier's position
                    // We call getPlayerPos with the current ball's RAC phase status (prevBall.catchTime) 
                    // and also provide the carrier's future position (null) since the defender's logic
                    // is now handled by the RAC phase flag and the defensive pursuit logic in getPlayerPos.
                    const [cx, cy] = getPlayerPos(carrierPlayer, elapsed, prevBall.catchTime, null);
                    
                    const isOutOfBounds = (cx <= LEFT_BOUNDARY || cx >= RIGHT_BOUNDARY || cy <= FRONT_BOUNDARY || cy >= BACK_BOUNDARY);
                    const isTouchdown = cy <= TOP_ENDZONE_LINE;
                    
                    const defenders = players.filter(p => p.side === 'defense');
                    
                    // The tackling check
                    const isTackled = defenders.some(d => {
                        // Defender position is calculated using dynamic pursuit logic in getPlayerPos
                        const [dx, dy] = getPlayerPos(d, elapsed, prevBall.catchTime, [cx, cy]); 
                        const distance = Math.sqrt(Math.pow(cx - dx, 2) + Math.pow(cy - dy, 2));
                        
                        return distance <= TACKLE_RADIUS; 
                    });
                    
                    // Terminal Condition Checks (These are the ONLY conditions that stop the play)
                    if (isTackled || isOutOfBounds || isTouchdown) {
                        setRunning(false); 
                        
                        if (isTouchdown) {
                            setPassStatus(prevBall.interception ? "DEFENSIVE TD" : "TOUCHDOWN");
                        } else if (prevBall.interception) {
                            setPassStatus("INTERCEPTION - TACKLE");
                        } else if (isTackled) {
                            setPassStatus("COMPLETE - TACKLE");
                        } else if (isOutOfBounds) {
                            setPassStatus("COMPLETE - OUT OF BOUNDS");
                        }
                    } 
                    
                    // Ensure status shows RAC phase if still running
                    if (running) {
                        if (prevBall.caught) {
                            setPassStatus("COMPLETE (RAC)"); 
                        } else if (prevBall.interception) {
                            setPassStatus("INTERCEPTION (RAC)");
                        }
                    }

                    const pxDiff = startYardsLine - cy;
                    const yards = Math.round(pxDiff / PX_PER_YARD);
                    setYardsGained(yards);

                    return { ...prevBall, pos: [cx, cy] };
                }

                // --- PHASE 1: QB Decision Phase ---
                if (!prevBall.thrown && elapsed >= QB_THROW_TIME) { 
                    
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
                        let score = calculateOpennessScore(receiver, defenders, QB_THROW_TIME);
                        
                        const priorityBonus = priorityMap[receiver.name] || 0;
                        score += priorityBonus;

                        if (score > bestScore) {
                            bestScore = score;
                            bestTargetName = receiver.name;
                        }
                    }
                    
                    if (bestTargetName) {
                        setPassStatus("THROWN");
                        return { 
                            ...prevBall, 
                            thrown: true, 
                            target: bestTargetName, 
                            t: 0, 
                        };
                    }
                    
                    // Fallback if no target found
                    setRunning(false);
                    setPassStatus("INCOMPLETE - NO TARGET");
                    return prevBall; 
                }


                // --- PHASE 2: Ball in Air (Interception/Incompletion Check) ---
                if (prevBall.thrown && prevBall.target && !prevBall.caught && !prevBall.interception) {
                    const targetPlayer = players.find(p => p.name === prevBall.target);
                    const qbData = routeData.QB;
                    if (!targetPlayer || !qbData) return prevBall;

                    // Target position (where the receiver *will be* when the ball arrives)
                    const [tx, ty] = getPlayerPos(targetPlayer, QB_THROW_TIME + BALL_TRAVEL_TIME, 0); 
                    // Starting position (QB position at throw time)
                    const [sx, sy] = qbData.start; 
                    
                    const t = prevBall.t + effectiveFrameRate; 
                    const progress = Math.min(t / BALL_TRAVEL_TIME, 1); 
                    
                    // Calculate current ball position (X, Y - using parabolic arc for visual effect)
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
                        
                        // Check for Interception (close proximity to ball, late in the play)
                        if (distanceToBall <= DEF_INTERCEPTION_RADIUS && progress >= 0.7) {
                            interceptionHappened = true;
                            interceptingDefender = defender.name;
                            break; 
                        }
                        
                        // Check for Deflection (close proximity to trajectory)
                        if (distanceToTrajectory <= DEFLECTION_RADIUS && distanceToBall <= CATCH_RADIUS) { 
                            deflectionHappened = true;
                            break;
                        }
                    }
                    
                    // Check if ball has reached the target point (progress >= 1)
                    if (progress >= 1) {
                        
                        if (interceptionHappened) {
                            setPassStatus("INTERCEPTION (RAC)");
                            return { 
                                ...prevBall, 
                                caught: false, 
                                interception: true, 
                                carrier: interceptingDefender, 
                                catchTime: elapsed,
                                pos: ballPos 
                            };
                        }

                        // Receiver position at catch time
                        const [rx, ry] = getPlayerPos(targetPlayer, QB_THROW_TIME + BALL_TRAVEL_TIME, 0); 
                        const finalDistance = Math.sqrt(Math.pow(x - rx, 2) + Math.pow(y - ry, 2));
                        
                        if (deflectionHappened || finalDistance > CATCH_RADIUS) {
                            // Incomplete: STOP SIMULATION
                            setRunning(false); 
                            setPassStatus("INCOMPLETE");
                            return { ...prevBall, pos: ballPos }; 
                        } else {
                            // Complete Pass: CONTINUE SIMULATION
                            setPassStatus("COMPLETE (RAC)");
                            return { 
                                ...prevBall, 
                                caught: true, 
                                carrier: prevBall.target, 
                                catchTime: elapsed,
                                pos: ballPos 
                            };
                        }

                    }
                    
                    // Ball still in air
                    return { ...prevBall, t: t, pos: ballPos }; 
                }
                
                // Default return for QB decision phase (waiting for QB_THROW_TIME)
                return prevBall;
            });
            
            animationFrameId.current = requestAnimationFrame(loop);
        };
        animationFrameId.current = requestAnimationFrame(loop);
        return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }, [running, players, mode, routeData, startYardsLine, playbackSpeedMultiplier]); 

    // ================= RENDER (Visual Offset & Ball Fix) =================

    const yardNumbers = [0, 10, 20, 30, 40, 50, 40, 30, 20, 10, 0];
    const stageCursor = mode === 'setup' && editingPlayer ? 'crosshair' : 'default';
    
    const sliderValue = Math.round(playbackSpeedMultiplier * 10);
    const speedLabel = sliderValue + "x";

    // --- Player Order Map for Deterministic Offset ---
    const playerOrderMap = {};
    const ALL_PLAYERS_NAMES = [...ALL_OFFENSE_PLAYERS, ...defensePlayers.map(p => p.name)];
    ALL_PLAYERS_NAMES.forEach((name, index) => {
        playerOrderMap[name] = index;
    });
    
    // --- RENDER LOGIC: Determine carrier position for defender targeting ---
    let carrierPosForRender = null;
    if (ball?.carrier && (ball.caught || ball.interception)) {
        // Find the carrier object from the player list
        const carrierPlayer = players.find(cp => cp.name === ball.carrier);
        // Get their position (must call getPlayerPos with racTime and null carrierPos to get the carrier's true position)
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
                        value={sliderValue}
                        onChange={(e) => {
                            const newMultiplier = parseInt(e.target.value, 10) / 10;
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
                                    Click field to draw points for **{editingPlayer}**. (Time is now calculated by speed)
                                </p>
                            </>
                        )}
                        
                        {/* START SIMULATION BUTTON (visible when ready to run) */}
                         <button 
                            onClick={() => {
                                setMode('run');
                                compilePlay(); 
                                setRunning(true); // Automatically start running upon compiling play
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
                        <div style={{ textAlign: "center" }}><div style={{ fontSize: "10px" }}>STATUS</div><div style={{ fontSize: "18px", marginTop: "4px", color: (passStatus.includes("TOUCHDOWN") || passStatus.includes("INTERCEPTION") || passStatus.includes("INCOMPLETE") || passStatus.includes("TACKLE")) ? "yellow" : (passStatus === "THROWN" || passStatus === "COMPLETE (RAC)" ? "#00ff00" : "white") }}>{passStatus.toUpperCase()}</div></div>
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
                onClick={mode === 'setup' && setupPhase === 'routes' ? handleFieldClick : undefined} 
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
                        
                        // Pass the carrier's true position (carrierPosForRender) to getPlayerPos for dynamic defense targeting
                        const [x, y] = getPlayerPos(p, time, racTime, carrierPosForRender); 
                        
                        const isDraggableInSetup = mode === 'setup' && setupPhase === 'formation' && p.side === 'offense';
                        
                        // --- Apply a larger, more explicit visual offset to prevent overlap ---
                        const index = playerOrderMap[p.name] || 0;
                        const offset_magnitude = 3; // 3 pixel offset
                        // Alternating small offset based on player index to ensure separation
                        const offset_x = (index % 3) * offset_magnitude - offset_magnitude; // -3, 0, 3
                        const offset_y = Math.floor(index / 3) * offset_magnitude - offset_magnitude; // -3, 0, 3
                        
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
                        
                        // Player is the carrier (change color temporarily for emphasis)
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
                            // The ball should only be visible when thrown and not yet caught/intercepted
                            fill={ball.thrown && !ball.caught && !ball.interception ? 'white' : 'transparent'} 
                            stroke={ball.thrown && !ball.caught && !ball.interception ? 'black' : 'transparent'}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    );
}