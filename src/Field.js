// Field.js — Horizontal TV-style field, smart QB, fixed RAC & tackling

import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Rect, Circle, Text, Line, Ellipse, Ring } from "react-konva";
import {
    PX_PER_YARD,
    BASE_FRAME_RATE,
    CATCH_RADIUS,
    DEF_INTERCEPTION_RADIUS,
    DEFLECTION_RADIUS,
    TACKLE_RADIUS,
    MIN_QB_THROW_TIME,
    BALL_TRAVEL_TIME,
    ENDZONE_WIDTH,
    PLAYABLE_WIDTH,
    FIELD_WIDTH,
    FIELD_HEIGHT,
    LOS_X,
    RIGHT_ENDZONE_EDGE,
    FIELD_LEFT_BOUND,
    FIELD_RIGHT_BOUND,
    TOP_SIDELINE,
    BOTTOM_SIDELINE,
    OPEN_THRESHOLD,
    EDITABLE_PLAYERS,
    ALL_OFFENSE_PLAYERS,
    defaultRouteData
} from "./components/constants";
import { distToSegment } from "./components/utils";
import { getPlayerPos, calculateOpennessScore, calculateBallTravelTime, getPlayerDefinition } from "./components/playerLogic";
import { generateRandomDefense, compileDefenseMovement, compileOLMovement } from "./components/defenseLogic";
import { loadSavedPlays, savePlay, deletePlay } from "./components/playStorage";

// --- Player & Route Colors ---
const OFFENSE_COLORS = {
    QB: '#3b82f6', WR1: '#ef4444', WR2: '#3b82f6', WR3: '#22c55e',
    TE: '#f97316', RB: '#a855f7',
    LT: '#6b7280', LG: '#6b7280', C: '#6b7280', RG: '#6b7280', RT: '#6b7280'
};
const DEFENSE_COLORS = { dl: '#dc2626', lb: '#f87171', cb: '#fbbf24', s: '#fcd34d' };
const ROUTE_COLORS = { WR1: '#ef4444', WR2: '#3b82f6', WR3: '#22c55e', TE: '#f97316', RB: '#a855f7' };

export default function Field({ isCustom }) {

    // --- EDITOR STATE ---
    const [mode, setMode] = useState('setup'); // 'setup' or 'run'
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
    const [playbackSpeedMultiplier, setPlaybackSpeedMultiplier] = useState(1);

    // --- SAVED PLAYS ---
    const [savedPlaysList, setSavedPlaysList] = useState([]);
    const [message, setMessage] = useState('');

    // --- NFL ROSTER STATE ---
    const [rosterData, setRosterData] = useState(null);
    const [offenseTeam, setOffenseTeam] = useState(null);   // null = Custom
    const [defenseTeam, setDefenseTeam] = useState(null);   // null = Random

    // --- GAME STATE ---
    const [qbReadTarget, setQbReadTarget] = useState(null);
    const [revealedCoverage, setRevealedCoverage] = useState(false);
    const [playHistory, setPlayHistory] = useState([]);
    // --- COLLAPSIBLE STATE ---
    const [historyOpen, setHistoryOpen] = useState(false);
    const [savedPlaysOpen, setSavedPlaysOpen] = useState(false);

    const timeRef = useRef(0);
    const animationFrameId = useRef(null);

    // ================= UTILITY FUNCTIONS =================

    const clampDefensePositions = (defPlayers) => {
        return defPlayers.map(player => {
            if (player.side !== 'defense') return player;
            let [startX, startY] = player.start;
            // Defense must be to the RIGHT of LOS
            if (startX < LOS_X) startX = LOS_X;
            return { ...player, start: [startX, startY] };
        });
    };

    const refreshSavedPlays = () => setSavedPlaysList(loadSavedPlays());

    const handleSavePlay = () => {
        setRunning(false);
        const playName = prompt("Enter a name for your custom play:");
        if (playName && playName.trim()) {
            const result = savePlay(playName.trim(), routeData);
            refreshSavedPlays();
            setMessage(result.message);
            setTimeout(() => setMessage(''), 3000);
        } else if (playName !== null) {
            setMessage("Play name cannot be empty.");
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleLoadPlay = (playName) => {
        const playToLoad = savedPlaysList.find(p => p.name === playName);
        if (playToLoad) {
            setRouteData(playToLoad.routeData);
            setMode('setup');
            setRunning(false);
            setMessage(`Play '${playName}' loaded.`);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const handleDeletePlay = (playName) => {
        if (window.confirm(`Delete play '${playName}'?`)) {
            const result = deletePlay(playName);
            refreshSavedPlays();
            setMessage(result.message);
            setTimeout(() => setMessage(''), 3000);
        }
    };

    const resetPlayerRoute = (playerName) => {
        setRouteData(prevData => ({
            ...prevData,
            [playerName]: { ...prevData[playerName], waypoints: [] }
        }));
    };

    const compileOffense = () => {
        const offRoster = (offenseTeam && rosterData?.[offenseTeam]?.offense) || null;
        return ALL_OFFENSE_PLAYERS
            .map(name => {
                const rosterSpeed = offRoster?.[name]?.speed || null;
                return getPlayerDefinition(name, routeData, rosterSpeed);
            })
            .filter(p => p !== null);
    };

    const compilePlay = () => {
        const compiledOffense = compileOffense();
        const compiledDefense = defensePlayers.map(def => ({
            ...def,
            movements: compileDefenseMovement(def, defensiveCoverage, routeData)
        }));
        const dlPlayers = compiledDefense.filter(d => d.type === 'dl');
        const finalOffense = compiledOffense.map(p => {
            if (p.type === 'ol') return { ...p, movements: compileOLMovement(p, dlPlayers) };
            return p;
        });
        setPlayers([...finalOffense, ...compiledDefense]);
        // startYardsLine is now X of center (downfield axis)
        setStartYardsLine(routeData.C.start[0]);
        setPassStatus("PENDING");
        setYardsGained(0);
        setQbReadTarget(null);
        setRevealedCoverage(false);
        timeRef.current = 0;
        setTime(0);
        setBall({
            thrown: false, caught: false, carrier: null, pos: routeData.QB.start,
            t: 0, target: null, interception: false, catchTime: 0,
            finalX: null, finalY: null, travelTime: BALL_TRAVEL_TIME
        });
        setRunning(false);
    };

    // --- RUN PLAY: compile + auto-start ---
    const handleRunPlay = () => {
        const compiledOffense = compileOffense();
        const compiledDefense = defensePlayers.map(def => ({
            ...def,
            movements: compileDefenseMovement(def, defensiveCoverage, routeData)
        }));
        const dlPlayers = compiledDefense.filter(d => d.type === 'dl');
        const finalOffense = compiledOffense.map(p => {
            if (p.type === 'ol') return { ...p, movements: compileOLMovement(p, dlPlayers) };
            return p;
        });
        setPlayers([...finalOffense, ...compiledDefense]);
        setStartYardsLine(routeData.C.start[0]);
        setPassStatus("PENDING");
        setYardsGained(0);
        setQbReadTarget(null);
        setRevealedCoverage(false);
        timeRef.current = 0;
        setTime(0);
        setBall({
            thrown: false, caught: false, carrier: null, pos: routeData.QB.start,
            t: 0, target: null, interception: false, catchTime: 0,
            finalX: null, finalY: null, travelTime: BALL_TRAVEL_TIME
        });
        setMode('run');
        setTimeout(() => setRunning(true), 50);
    };

    const resetToSetup = () => {
        setMode('setup');
        setRunning(false);
        setRouteData(defaultRouteData);
        const teamDef = (defenseTeam && rosterData?.[defenseTeam]?.defense) || null;
        const teamTendencies = (defenseTeam && rosterData?.[defenseTeam]?.tendencies) || null;
        const { players: newDefense, coverage } = generateRandomDefense(defaultRouteData, teamDef, teamTendencies);
        setDefensePlayers(clampDefensePositions(newDefense));
        setDefensiveCoverage(coverage);
    };

    const backToEditing = () => {
        setMode('setup');
        setRunning(false);
    };

    const handleReplay = () => {
        handleRunPlay();
    };

    // --- FIELD CLICK: draw route waypoints ---
    const handleFieldClick = (e) => {
        if (mode !== 'setup' || !editingPlayer) return;
        const stage = e.target.getStage();
        const pointerPos = stage.getPointerPosition();
        const x = pointerPos.x;
        const y = pointerPos.y;

        setRouteData(prevData => {
            const currentRoute = prevData[editingPlayer];
            if (!currentRoute) return prevData;
            const lastTime = currentRoute.waypoints.length > 0 ? currentRoute.waypoints[currentRoute.waypoints.length - 1][2] : 0;
            const newTime = lastTime + 1000;
            return {
                ...prevData,
                [editingPlayer]: {
                    ...currentRoute,
                    waypoints: [...currentRoute.waypoints, [Math.round(x), Math.round(y), newTime]]
                }
            };
        });
    };

    const handleWaypointDrag = (player, index, newPos) => {
        setRouteData(prevData => {
            const currentRoute = prevData[player];
            if (!currentRoute) return prevData;
            const updatedWaypoints = currentRoute.waypoints.map((wp, i) => {
                if (i === index) return [Math.round(newPos.x), Math.round(newPos.y), wp[2]];
                return wp;
            });
            return { ...prevData, [player]: { ...currentRoute, waypoints: updatedWaypoints } };
        });
    };

    const updateStartPos = (player, newPos) => {
        setRouteData(prevData => {
            const currentRoute = prevData[player];
            let newX = Math.round(newPos.x);
            // Offense can't start to the RIGHT of LOS (they're behind it)
            if (newX > LOS_X) newX = LOS_X;
            return { ...prevData, [player]: { ...currentRoute, start: [newX, Math.round(newPos.y)] } };
        });
    };

    const handlePlayerDragMove = (e) => {
        const node = e.target;
        // Clamp offense to left of LOS
        if (node.x() > LOS_X) node.x(LOS_X);
        updateStartPos(node.name(), node.position());
    };

    const handleUndoWaypoint = () => {
        setRouteData(prevData => {
            const currentRoute = prevData[editingPlayer];
            if (!currentRoute || currentRoute.waypoints.length === 0) return prevData;
            return {
                ...prevData,
                [editingPlayer]: { ...currentRoute, waypoints: currentRoute.waypoints.slice(0, -1) }
            };
        });
    };

    // --- ROSTER HELPERS ---
    const getDisplayName = (playerName, side) => {
        if (side === 'offense' && offenseTeam && rosterData?.[offenseTeam]?.offense?.[playerName]) {
            const full = rosterData[offenseTeam].offense[playerName].name;
            const parts = full.split(' ');
            if (parts.length >= 2) return parts[0][0] + '. ' + parts.slice(1).join(' ');
            return full;
        }
        if (side === 'defense') {
            // For defense, check the rosterName property on the player object
            return null; // handled inline via player.rosterName
        }
        return playerName;
    };

    const getDefenseDisplayName = (player) => {
        if (defenseTeam && player.rosterName) {
            const full = player.rosterName;
            const parts = full.split(' ');
            if (parts.length >= 2) return parts[0][0] + '. ' + parts.slice(1).join(' ');
            return full;
        }
        return player.type.toUpperCase();
    };

    // --- EFFECTS ---
    useEffect(() => {
        fetch(process.env.PUBLIC_URL + '/nfl_rosters.json')
            .then(r => r.json())
            .then(setRosterData)
            .catch(() => {}); // graceful fail
    }, []);

    // Regenerate defense when defenseTeam changes
    useEffect(() => {
        if (mode !== 'setup') return;
        const dataToUse = Object.keys(routeData).length > 0 ? routeData : defaultRouteData;
        const teamDef = (defenseTeam && rosterData?.[defenseTeam]?.defense) || null;
        const teamTendencies = (defenseTeam && rosterData?.[defenseTeam]?.tendencies) || null;
        const { players: newDefense, coverage } = generateRandomDefense(dataToUse, teamDef, teamTendencies);
        setDefensePlayers(clampDefensePositions(newDefense));
        setDefensiveCoverage(coverage);
    }, [defenseTeam]);

    useEffect(() => {
        refreshSavedPlays();
        if (isCustom) {
            setMode('setup');
            const dataToUse = Object.keys(routeData).length > 0 ? routeData : defaultRouteData;
            const teamDef = (defenseTeam && rosterData?.[defenseTeam]?.defense) || null;
            const teamTendencies = (defenseTeam && rosterData?.[defenseTeam]?.tendencies) || null;
            const { players: initialDefense, coverage } = generateRandomDefense(dataToUse, teamDef, teamTendencies);
            setDefensePlayers(clampDefensePositions(initialDefense));
            setDefensiveCoverage(coverage);
        }
    }, [isCustom]);

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

                // --- Ball Caught / Intercepted (Run After Catch) ---
                if (prevBall.caught || prevBall.interception) {
                    const carrierPlayer = players.find(p => p.name === prevBall.carrier);
                    if (!carrierPlayer) return prevBall;
                    const [cx, cy] = getPlayerPos(carrierPlayer, elapsed, prevBall.catchTime, null);
                    // Out of bounds: sidelines (top/bottom Y) or past endzones (X)
                    const isOutOfBounds = (cy <= TOP_SIDELINE || cy >= BOTTOM_SIDELINE || cx <= FIELD_LEFT_BOUND || cx >= FIELD_RIGHT_BOUND);
                    // Touchdown: carrier reaches right endzone
                    const isTouchdown = cx >= RIGHT_ENDZONE_EDGE;
                    const defenders = players.filter(p => p.side === 'defense');

                    let isTackled = false;
                    if (prevBall.caught) {
                        isTackled = defenders.some(d => {
                            // All defenders pursue carrier (DL included now that they rush)
                            const defRacTime = prevBall.catchTime;
                            const [dx, dy] = getPlayerPos(d, elapsed, defRacTime, [cx, cy]);
                            return Math.sqrt(Math.pow(cx - dx, 2) + Math.pow(cy - dy, 2)) <= TACKLE_RADIUS;
                        });
                    } else if (prevBall.interception) {
                        const offensivePlayers = players.filter(p => p.side === 'offense' && p.type !== 'ol');
                        isTackled = offensivePlayers.some(o => {
                            // Non-carrier offense stays at route position
                            const [ox, oy] = getPlayerPos(o, elapsed, 0, null);
                            return Math.sqrt(Math.pow(cx - ox, 2) + Math.pow(cy - oy, 2)) <= TACKLE_RADIUS;
                        });
                    }

                    let playIsTerminating = false;
                    if (isTackled || isOutOfBounds || isTouchdown) {
                        playIsTerminating = true;
                        setRunning(false);
                        let resultStatus = "";
                        if (isTouchdown) resultStatus = "TOUCHDOWN";
                        else if (isTackled) resultStatus = prevBall.caught ? "COMPLETE - TACKLED" : "INTERCEPTION - TACKLED";
                        else if (isOutOfBounds) resultStatus = prevBall.caught ? "COMPLETE - OUT OF BOUNDS" : "INTERCEPTION - OUT OF BOUNDS";
                        setPassStatus(resultStatus);

                        // Yards gained using actual field scale (PLAYABLE_WIDTH px = 100 yards)
                        const pxDiffFinal = cx - startYardsLine;
                        const yardsFinal = Math.round(pxDiffFinal / (PLAYABLE_WIDTH / 100));
                        const isInterception = prevBall.interception;

                        setPlayHistory(prev => [{ result: resultStatus, yards: yardsFinal, coverage: defensiveCoverage || '???', target: prevBall.target || 'N/A' }, ...prev].slice(0, 10));
                    }

                    if (running && !playIsTerminating) {
                        if (prevBall.caught) setPassStatus("COMPLETE");
                        else if (prevBall.interception) setPassStatus("INTERCEPTION");
                    }

                    // Yards gained using actual field scale
                    const pxDiff = cx - startYardsLine;
                    setYardsGained(Math.round(pxDiff / (PLAYABLE_WIDTH / 100)));
                    return { ...prevBall, pos: [cx, cy] };
                }

                // --- QB Decision Phase (Smart QB: openness-based) ---
                if (!prevBall.thrown) {
                    const qbPos = routeData.QB.start;

                    const allPlayers = players;
                    const eligibleReceivers = allPlayers.filter(p => p.side === 'offense' && (p.type === "receiver" || p.type === "te" || p.type === "rb"));
                    const defenders = allPlayers.filter(p => p.side === 'defense');

                    if (!eligibleReceivers.length) {
                        setRunning(false);
                        setPassStatus("INCOMPLETE - NO TARGET");
                        return prevBall;
                    }

                    const priorityOrder = ['WR1', 'WR2', 'WR3', 'TE', 'RB'];
                    const maxPriorityBonus = 200;
                    const priorityMap = {};
                    priorityOrder.forEach((name, index) => {
                        priorityMap[name] = maxPriorityBonus - (index * (maxPriorityBonus / (priorityOrder.length - 1)));
                    });

                    let bestScore = -Infinity;
                    let bestTargetName = null;
                    for (const receiver of eligibleReceivers) {
                        let score = calculateOpennessScore(receiver, defenders, elapsed, qbPos);
                        score += priorityMap[receiver.name] || 0;
                        if (score > bestScore) { bestScore = score; bestTargetName = receiver.name; }
                    }

                    if (bestTargetName) setQbReadTarget(bestTargetName);

                    // Smart QB: wait for routes to develop, then throw when open
                    if (elapsed >= MIN_QB_THROW_TIME && bestTargetName) {
                        const shouldThrow = bestScore >= OPEN_THRESHOLD || elapsed >= 4000;

                        if (shouldThrow) {
                            const targetPlayer = allPlayers.find(p => p.name === bestTargetName);
                            const [futureX, futureY] = getPlayerPos(targetPlayer, elapsed + 1000, 0);
                            const travelTime = calculateBallTravelTime(qbPos, [futureX, futureY]);
                            const [finalX, finalY] = getPlayerPos(targetPlayer, elapsed + travelTime, 0);
                            setRevealedCoverage(true);
                            setPassStatus("THROWN");
                            return { ...prevBall, thrown: true, target: bestTargetName, t: 0, finalX, finalY, travelTime };
                        }
                    }
                    return prevBall;
                }

                // --- Ball in Air ---
                if (prevBall.thrown && prevBall.target && !prevBall.caught && !prevBall.interception) {
                    const targetPlayer = players.find(p => p.name === prevBall.target);
                    const qbData = routeData.QB;
                    if (!targetPlayer || !qbData || prevBall.finalX === null) return prevBall;

                    const tx = prevBall.finalX;
                    const ty = prevBall.finalY;
                    const [sx, sy] = qbData.start;
                    const ballTravelTime = prevBall.travelTime || BALL_TRAVEL_TIME;
                    const t = prevBall.t + effectiveFrameRate;
                    const progress = Math.min(t / ballTravelTime, 1);
                    const x = sx + (tx - sx) * progress;
                    const throwDist = Math.sqrt(Math.pow(tx - sx, 2) + Math.pow(ty - sy, 2));
                    const arcHeight = Math.min(60, 15 + throwDist * 0.1);
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

                        if (distanceToBall <= DEF_INTERCEPTION_RADIUS) {
                            const intProbability = 0.15 + 0.70 * progress;
                            if (Math.random() < intProbability) { interceptionHappened = true; interceptingDefender = defender.name; break; }
                        }
                        if (distanceToTrajectory <= DEFLECTION_RADIUS && distanceToBall <= CATCH_RADIUS) { deflectionHappened = true; break; }
                    }

                    if (interceptionHappened) {
                        setPassStatus("INTERCEPTION");
                        return { ...prevBall, caught: false, interception: true, carrier: interceptingDefender, catchTime: elapsed, pos: ballPos };
                    }

                    if (progress >= 1) {
                        const [rx, ry] = getPlayerPos(targetPlayer, elapsed, 0);
                        const finalDistance = Math.sqrt(Math.pow(tx - rx, 2) + Math.pow(ty - ry, 2));
                        if (deflectionHappened || finalDistance > CATCH_RADIUS) {
                            setRunning(false);
                            setPassStatus("INCOMPLETE");
                            setPlayHistory(prev => [{ result: 'INCOMPLETE', yards: 0, coverage: defensiveCoverage || '???', target: prevBall.target || 'N/A' }, ...prev].slice(0, 10));
                            return { ...prevBall, pos: ballPos };
                        } else {
                            setPassStatus("COMPLETE");
                            return { ...prevBall, caught: true, carrier: prevBall.target, catchTime: elapsed, pos: ballPos };
                        }
                    }
                    return { ...prevBall, t, pos: ballPos };
                }

                return prevBall;
            });

            animationFrameId.current = requestAnimationFrame(loop);
        };
        animationFrameId.current = requestAnimationFrame(loop);
        return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
    }, [running, players, mode, routeData, startYardsLine, playbackSpeedMultiplier]);

    // ================= RENDER HELPERS =================

    const getStatusClass = () => {
        if (passStatus.includes("TOUCHDOWN")) return "status-td";
        if (passStatus.includes("INTERCEPTION") || passStatus === "SACK" || passStatus === "TURNOVER ON DOWNS" || passStatus === "INCOMPLETE") return "status-bad";
        if (passStatus === "COMPLETE" || passStatus.includes("COMPLETE")) return "status-complete";
        if (passStatus === "THROWN") return "status-thrown";
        return "status-pending";
    };

    const getHistoryClass = (result) => {
        if (result.includes('TOUCHDOWN')) return 'td';
        if (result.includes('INT')) return 'int';
        if (result.includes('SACK')) return 'sack';
        if (result.includes('COMPLETE')) return 'complete';
        return 'incomplete';
    };

    const formatCoverage = (cov) => {
        const map = { cover0:'COVER 0', cover1:'COVER 1', cover2:'COVER 2', cover3:'COVER 3',
                      cover4:'COVER 4', cover6:'COVER 6', '2man':'2-MAN', man:'MAN' };
        return map[cov] || cov?.toUpperCase() || '???';
    };

    const stageCursor = mode === 'setup' && editingPlayer ? 'crosshair' : 'default';

    let carrierPosForRender = null;
    if (ball?.carrier && (ball.caught || ball.interception)) {
        const carrierPlayer = players.find(cp => cp.name === ball.carrier);
        if (carrierPlayer) {
            carrierPosForRender = getPlayerPos(carrierPlayer, time, ball.catchTime, null);
        }
    }

    const playerOrderMap = {};
    const ALL_PLAYERS_NAMES = [...ALL_OFFENSE_PLAYERS, ...defensePlayers.map(p => p.name)];
    ALL_PLAYERS_NAMES.forEach((name, index) => { playerOrderMap[name] = index; });

    // Field stripe colors for alternating 5-yard sections
    const STRIPE_DARK = '#2d6a2e';
    const STRIPE_LIGHT = '#348a37';

    // ================= JSX =================

    return (
        <div className="game-container">

            {/* === SCOREBOARD BAR === */}
            <div className="scoreboard-bar">
                <div className="scoreboard-item">
                    <span className="scoreboard-label">Status</span>
                    <span className={`scoreboard-value ${getStatusClass()}`}>
                        {passStatus}
                    </span>
                </div>
                <div className="scoreboard-item">
                    <span className="scoreboard-label">Yards</span>
                    <span className="scoreboard-value">
                        {yardsGained > 0 ? '+' : ''}{yardsGained}
                    </span>
                </div>
                <div className="scoreboard-item">
                    <span className="scoreboard-label">Coverage</span>
                    <span className="scoreboard-value status-coverage">
                        {revealedCoverage ? formatCoverage(defensiveCoverage) : '???'}
                    </span>
                </div>
                <div className="scoreboard-item">
                    <span className="scoreboard-label">Speed</span>
                    <div className="speed-pills">
                        {[1, 2, 3].map(s => (
                            <button
                                key={s}
                                className={`speed-pill ${playbackSpeedMultiplier === s ? 'active' : ''}`}
                                onClick={() => setPlaybackSpeedMultiplier(s)}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* === TEAM SELECTOR (setup mode) === */}
            {mode === 'setup' && rosterData && (
                <div className="team-selector-bar">
                    <label className="team-select-label">OFF</label>
                    <select
                        className="team-select"
                        value={offenseTeam || ''}
                        onChange={e => setOffenseTeam(e.target.value || null)}
                    >
                        <option value="">Custom</option>
                        {rosterData.teams.map(t => (
                            <option key={t.abbr} value={t.abbr}>{t.abbr} - {t.name}</option>
                        ))}
                    </select>
                    <label className="team-select-label">DEF</label>
                    <select
                        className="team-select"
                        value={defenseTeam || ''}
                        onChange={e => setDefenseTeam(e.target.value || null)}
                    >
                        <option value="">Random</option>
                        {rosterData.teams.map(t => (
                            <option key={t.abbr} value={t.abbr}>{t.abbr} - {t.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* === FIELD (Horizontal TV-style) === */}
            <div className="field-wrapper">
                <Stage
                    width={FIELD_WIDTH}
                    height={FIELD_HEIGHT}
                    onClick={mode === 'setup' ? handleFieldClick : undefined}
                    onTap={mode === 'setup' ? handleFieldClick : undefined}
                    style={{ cursor: stageCursor }}
                >
                    <Layer>
                        {/* --- ENDZONES: LEFT and RIGHT --- */}
                        <Rect x={0} y={0} width={ENDZONE_WIDTH} height={FIELD_HEIGHT} fill="#1a237e" />
                        <Text text="E\nN\nD\n\nZ\nO\nN\nE" fontSize={16} fill="white" opacity={0.2}
                            x={ENDZONE_WIDTH / 2 - 6} y={FIELD_HEIGHT / 2 - 70}
                            fontFamily="'Inter', sans-serif" fontStyle="bold" lineHeight={1.2} />
                        <Rect x={FIELD_WIDTH - ENDZONE_WIDTH} y={0} width={ENDZONE_WIDTH} height={FIELD_HEIGHT} fill="#7f1d1d" />
                        <Text text="E\nN\nD\n\nZ\nO\nN\nE" fontSize={16} fill="white" opacity={0.2}
                            x={FIELD_WIDTH - ENDZONE_WIDTH / 2 - 6} y={FIELD_HEIGHT / 2 - 70}
                            fontFamily="'Inter', sans-serif" fontStyle="bold" lineHeight={1.2} />

                        {/* --- FIELD SURFACE: alternating 5-yard vertical stripes --- */}
                        {Array.from({ length: 20 }).map((_, i) => {
                            const stripeW = PLAYABLE_WIDTH / 20;
                            return (
                                <Rect
                                    key={`stripe-${i}`}
                                    x={ENDZONE_WIDTH + i * stripeW}
                                    y={0}
                                    width={stripeW}
                                    height={FIELD_HEIGHT}
                                    fill={i % 2 === 0 ? STRIPE_DARK : STRIPE_LIGHT}
                                />
                            );
                        })}

                        {/* --- SIDELINE BORDER --- */}
                        <Rect x={ENDZONE_WIDTH} y={0} width={PLAYABLE_WIDTH} height={FIELD_HEIGHT}
                            stroke="white" strokeWidth={2} fill="transparent" />

                        {/* --- YARD LINES (vertical) + NUMBERS + HASH MARKS --- */}
                        {[0, 10, 20, 30, 40, 50, 40, 30, 20, 10, 0].map((num, i) => {
                            const x = ENDZONE_WIDTH + i * (PLAYABLE_WIDTH / 10);
                            return (
                                <React.Fragment key={`yard-${i}`}>
                                    <Line points={[x, 0, x, FIELD_HEIGHT]} stroke="white" strokeWidth={2} />
                                    <Text text={String(num)} x={x - 7} y={10} fill="white" fontSize={14}
                                        opacity={0.4} fontFamily="'Inter', sans-serif" fontStyle="bold" />
                                    <Text text={String(num)} x={x - 7} y={FIELD_HEIGHT - 24} fill="white" fontSize={14}
                                        opacity={0.4} fontFamily="'Inter', sans-serif" fontStyle="bold" />
                                </React.Fragment>
                            );
                        })}

                        {/* Hash marks at 1/3 and 2/3 height (short horizontal ticks) */}
                        {Array.from({ length: 100 }).map((_, i) => {
                            const x = ENDZONE_WIDTH + i * (PLAYABLE_WIDTH / 100);
                            return (
                                <React.Fragment key={`hash-${i}`}>
                                    <Line points={[x, FIELD_HEIGHT / 3 - 3, x, FIELD_HEIGHT / 3 + 3]}
                                        stroke="white" strokeWidth={1} opacity={0.3} />
                                    <Line points={[x, 2 * FIELD_HEIGHT / 3 - 3, x, 2 * FIELD_HEIGHT / 3 + 3]}
                                        stroke="white" strokeWidth={1} opacity={0.3} />
                                </React.Fragment>
                            );
                        })}

                        {/* --- LINE OF SCRIMMAGE (vertical yellow line) --- */}
                        <Line points={[LOS_X, 0, LOS_X, FIELD_HEIGHT]}
                            stroke="#fbbf24" strokeWidth={3} opacity={0.8} />
                        <Text text="LOS" x={LOS_X - 25} y={5}
                            fill="#fbbf24" fontSize={10} opacity={0.7}
                            fontFamily="'Inter', sans-serif" fontStyle="bold" />

                        {/* --- ROUTE LINES (setup mode) --- */}
                        {mode === 'setup' && EDITABLE_PLAYERS.map(name => {
                            const data = routeData[name];
                            const allPoints = [data.start, ...data.waypoints.map(wp => [wp[0], wp[1]])];
                            const flatPoints = allPoints.flat();
                            const isActive = name === editingPlayer;
                            const routeColor = isActive ? '#ffffff' : (ROUTE_COLORS[name] || 'rgba(255,255,255,0.5)');

                            return (
                                <React.Fragment key={`route-${name}`}>
                                    <Line points={flatPoints} stroke={routeColor}
                                        strokeWidth={isActive ? 3 : 2} lineJoin="round" dash={[10, 5]} />
                                    {data.waypoints.map((wp, index) => (
                                        <Circle
                                            key={`${name}-wp-${index}`}
                                            x={wp[0]} y={wp[1]}
                                            radius={isActive ? 7 : 4}
                                            fill={isActive ? ROUTE_COLORS[name] || '#fff' : (ROUTE_COLORS[name] || 'rgba(255,255,255,0.8)')}
                                            stroke={isActive ? '#fff' : undefined}
                                            strokeWidth={isActive ? 2 : 0}
                                            draggable={true}
                                            onDragMove={(e) => handleWaypointDrag(name, index, e.target.position())}
                                        />
                                    ))}
                                </React.Fragment>
                            );
                        })}

                        {/* --- ROUTE GHOST LINES (run mode) --- */}
                        {mode === 'run' && EDITABLE_PLAYERS.map(name => {
                            const data = routeData[name];
                            if (!data || data.waypoints.length === 0) return null;
                            const allPoints = [data.start, ...data.waypoints.map(wp => [wp[0], wp[1]])];
                            return (
                                <Line key={`ghost-${name}`} points={allPoints.flat()}
                                    stroke={ROUTE_COLORS[name] || 'white'} strokeWidth={2}
                                    lineJoin="round" dash={[5, 5]} opacity={0.2} />
                            );
                        })}

                        {/* --- QB READ LINE --- */}
                        {mode === 'run' && !ball?.thrown && qbReadTarget && (() => {
                            const qbPos = routeData.QB.start;
                            const targetPlayer = players.find(p => p.name === qbReadTarget);
                            if (!targetPlayer) return null;
                            const [tX, tY] = getPlayerPos(targetPlayer, time, 0);
                            return (
                                <Line points={[qbPos[0], qbPos[1], tX, tY]}
                                    stroke="cyan" strokeWidth={2} dash={[8, 4]} opacity={0.6} />
                            );
                        })()}

                        {/* --- PLAYERS --- */}
                        {players.map((p) => {
                            const racTime = ball?.carrier ? ball.catchTime : 0;
                            // Carrier and all defenders get RAC time; other offense freezes at route position
                            const isCarrierPlayer = ball?.carrier === p.name;
                            const isDefender = p.side === 'defense';
                            const playerRacTime = (isCarrierPlayer || isDefender) ? racTime : 0;
                            const [x, y] = getPlayerPos(p, time, playerRacTime, carrierPosForRender);

                            const isDraggable = mode === 'setup' && p.side === 'offense';
                            const index = playerOrderMap[p.name] || 0;
                            const offset_x = (index % 3) * 3 - 3;
                            const offset_y = Math.floor(index / 3) * 3 - 3;
                            const finalX = x + offset_x * 0.5;
                            const finalY = y + offset_y * 0.5;

                            let fill;
                            if (p.side === 'defense') {
                                fill = DEFENSE_COLORS[p.type] || '#f87171';
                            } else {
                                fill = OFFENSE_COLORS[p.name] || '#6b7280';
                            }

                            const isCarrier = ball?.carrier === p.name && (ball?.caught || ball?.interception);
                            const isActiveEdit = mode === 'setup' && p.name === editingPlayer;
                            const radius = (p.side === 'offense' && p.type === 'ol') ? 12 : 8;

                            return (
                                <React.Fragment key={p.name}>
                                    {isActiveEdit && (
                                        <Ring x={finalX} y={finalY}
                                            innerRadius={radius + 2} outerRadius={radius + 5}
                                            fill="rgba(255,255,255,0.3)" />
                                    )}
                                    {isCarrier && (
                                        <Ring x={finalX} y={finalY}
                                            innerRadius={radius + 2} outerRadius={radius + 6}
                                            fill="#fbbf24" opacity={0.6 + 0.4 * Math.sin(time / 150)} />
                                    )}
                                    <Circle
                                        name={p.name}
                                        x={finalX} y={finalY}
                                        radius={radius}
                                        fill={isCarrier ? '#fbbf24' : fill}
                                        stroke={p.name === 'QB' ? 'white' : undefined}
                                        strokeWidth={p.name === 'QB' ? 2 : 0}
                                        draggable={isDraggable}
                                        onDragMove={handlePlayerDragMove}
                                    />
                                    <Text
                                        text={p.side === 'defense'
                                            ? getDefenseDisplayName(p)
                                            : (getDisplayName(p.name, 'offense') || p.name)}
                                        fontSize={p.side === 'defense'
                                            ? (defenseTeam && p.rosterName ? 9 : 8)
                                            : (offenseTeam && rosterData?.[offenseTeam]?.offense?.[p.name] ? 9 : 11)}
                                        fill="white"
                                        fontFamily="'Inter', sans-serif"
                                        fontStyle="bold"
                                        x={p.side === 'defense' ? finalX - 14 : finalX - 14}
                                        y={finalY - 20}
                                    />
                                </React.Fragment>
                            );
                        })}

                        {/* --- BALL --- */}
                        {ball && (ball.thrown || ball.caught || ball.interception) && (
                            <React.Fragment>
                                <Ellipse x={ball.pos[0]} y={ball.pos[1]}
                                    radiusX={10} radiusY={6} fill="#8B4513"
                                    stroke="black" strokeWidth={1} />
                                <Line points={[ball.pos[0] - 2, ball.pos[1], ball.pos[0] + 2, ball.pos[1]]}
                                    stroke="white" strokeWidth={3} />
                            </React.Fragment>
                        )}
                    </Layer>
                </Stage>
            </div>

            {/* === PLAYER TABS (setup mode) === */}
            {mode === 'setup' && (
                <div className="player-tabs">
                    {EDITABLE_PLAYERS.map(name => (
                        <button
                            key={name}
                            className={`player-tab ${editingPlayer === name ? 'active' : ''}`}
                            onClick={() => setEditingPlayer(name)}
                        >
                            <span className="player-tab-dot" style={{ backgroundColor: ROUTE_COLORS[name] }} />
                            {name}
                        </button>
                    ))}
                    <div className="route-helpers">
                        <button className="btn btn-secondary btn-sm" onClick={handleUndoWaypoint}>UNDO</button>
                        <button className="btn btn-danger btn-sm" onClick={() => resetPlayerRoute(editingPlayer)}>CLEAR</button>
                    </div>
                </div>
            )}

            {/* === ACTION BAR === */}
            <div className="action-bar">
                {mode === 'setup' && (
                    <>
                        <button className="btn btn-primary" onClick={handleRunPlay}>
                            &#9654; RUN PLAY
                        </button>
                        <button className="btn btn-secondary" onClick={handleSavePlay}>
                            SAVE
                        </button>
                        <button className="btn btn-secondary" onClick={resetToSetup}>
                            NEW PLAY
                        </button>
                    </>
                )}
                {mode === 'run' && (
                    <>
                        {running ? (
                            <button className="btn btn-danger" onClick={() => setRunning(false)}>
                                PAUSE
                            </button>
                        ) : (
                            <button className="btn btn-primary" onClick={() => setRunning(true)}>
                                &#9654; RESUME
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={handleReplay}>
                            REPLAY
                        </button>
                        <button className="btn btn-secondary" onClick={backToEditing}>
                            EDIT
                        </button>
                        <button className="btn btn-secondary" onClick={resetToSetup}>
                            NEW PLAY
                        </button>
                    </>
                )}
            </div>

            {/* === STATUS MESSAGE === */}
            {message && (
                <div className={`status-message ${message.includes('Error') || message.includes('empty') ? 'error' : ''}`}>
                    {message}
                </div>
            )}

            {/* === COLLAPSIBLE: PLAY HISTORY === */}
            <div className="collapsible">
                <div className="collapsible-header" onClick={() => setHistoryOpen(!historyOpen)}>
                    <span className={`arrow ${historyOpen ? 'open' : ''}`}>&#9654;</span>
                    History ({playHistory.length})
                </div>
                <div className={`collapsible-body ${historyOpen ? 'open' : ''}`}>
                    <div className="collapsible-body-inner">
                        {playHistory.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#6b7280' }}>No plays yet.</div>
                        ) : (
                            playHistory.map((entry, i) => (
                                <div key={i} className="history-entry">
                                    <span className={`history-result ${getHistoryClass(entry.result)}`}>
                                        {entry.result}
                                    </span>
                                    <span>{entry.yards > 0 ? '+' : ''}{entry.yards}y</span>
                                    <span style={{ color: '#06b6d4' }}>{formatCoverage(entry.coverage)}</span>
                                    <span>{entry.target}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* === COLLAPSIBLE: SAVED PLAYS === */}
            <div className="collapsible">
                <div className="collapsible-header" onClick={() => setSavedPlaysOpen(!savedPlaysOpen)}>
                    <span className={`arrow ${savedPlaysOpen ? 'open' : ''}`}>&#9654;</span>
                    Saved Plays ({savedPlaysList.length})
                </div>
                <div className={`collapsible-body ${savedPlaysOpen ? 'open' : ''}`}>
                    <div className="collapsible-body-inner">
                        {savedPlaysList.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#6b7280' }}>No saved plays.</div>
                        ) : (
                            savedPlaysList.map(play => (
                                <div key={play.name} className="saved-play-entry">
                                    <span>{play.name}</span>
                                    <div className="saved-play-actions">
                                        <button className="btn btn-secondary btn-sm" onClick={() => handleLoadPlay(play.name)}>LOAD</button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeletePlay(play.name)}>DEL</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
