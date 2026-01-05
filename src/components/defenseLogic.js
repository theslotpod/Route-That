// components/defenseLogic.js

import { 
    DEFENSIVE_LINE_Y, 
    DEFENSIVE_LINE_COUNT, 
    SECONDARY_COUNT, 
    PX_PER_YARD,
    FIELD_WIDTH,
    TOP_ENDZONE_LINE,
    LEFT_BOUNDARY, // <--- FIX: ADDED
    RIGHT_BOUNDARY // <--- FIX: ADDED
} from './constants';
import { generateMovements, getPlayerPos } from './playerLogic';

const END_PLAY_TIME = 15000; 

// --- UTILITY FUNCTION (4) - Generate Random Defense ---
export const generateRandomDefense = (routeData) => {
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

// --- UTILITY FUNCTION (5) - Compile Defense Movement ---
export const compileDefenseMovement = (defPlayer, coverage, routeData) => {
    const LOS_Y = DEFENSIVE_LINE_Y;
    
    if (defPlayer.type === 'dl') {
        const targetX = defPlayer.start[0];
        const targetY = LOS_Y - 10; 
        return generateMovements(defPlayer.start, [[targetX, targetY]], false, 'dl'); 
    }
    
    const secondaryPlayers = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
    const defStart = defPlayer.start;

    // --- Man Coverage Movement ---
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
                const [targetX, targetY] = getPlayerPos(offensivePlayer, t, 0); 
                
                const chaseX = targetX + fixedOffsetX;
                const chaseY = targetY + fixedOffsetY;
                
                defenseWaypoints.push([chaseX, chaseY]); 
            }
        });

        const [lastX, lastY] = defenseWaypoints[defenseWaypoints.length - 1] || defStart;
        defenseWaypoints.push([lastX, lastY]); 
        
        return generateMovements(defStart, defenseWaypoints, false, defPlayer.type);
    }
    
    // --- Zone Coverage Movement (FIXED DEEPER DROPS) --- 
    if (coverage === 'cover2' || coverage === 'cover3') {
        
        // **FIX: Deeper drop targets for better coverage**
        
        // Intermediate zone drop (LB/CB): 18-20 yards past LOS
        const INTERMEDIATE_DROP_YARDS = 20; 
        const intermediateY = LOS_Y - INTERMEDIATE_DROP_YARDS * PX_PER_YARD; 

        // Deep zone drop (Safety/CB): Close to the Endzone (TOP_ENDZONE_LINE is Y=50)
        const DEEP_DROP_Y = TOP_ENDZONE_LINE + 10; // 10 pixels past the endzone line for aggressive drop
        
        // D1, D2, D3 are typically the deep players in Cover 3 (or the two safeties in Cover 2)
        const deepDefenders = (coverage === 'cover2') ? ['D1', 'D2'] : ['D1', 'D2', 'D3'];
        let assignmentType = deepDefenders.includes(defPlayer.name) ? 'deep' : 'underneath';
        
        const defWaypoints = [];
        
        let initialTargetX, initialTargetY;

        if (assignmentType === 'deep') {
            initialTargetX = defStart[0];
            initialTargetY = DEEP_DROP_Y; // Deep zone target
        } else { 
            // Underneath zone (LB/CB) target
            const playerIndex = secondaryPlayers.indexOf(defPlayer.name);
            
            // Lateral starting position for zone players (left, right, or middle)
            if (playerIndex % 3 === 0) initialTargetX = FIELD_WIDTH / 4; 
            else if (playerIndex % 3 === 1) initialTargetX = FIELD_WIDTH * 3 / 4; 
            else initialTargetX = FIELD_WIDTH / 2; 
            
            initialTargetY = intermediateY; // Intermediate zone target
        }

        defWaypoints.push([initialTargetX, initialTargetY]); 

        let currentX = initialTargetX;
        let currentY = initialTargetY;
        
        // Patrol range: deep players patrol wider than intermediate players
        const sidePatrol = assignmentType === 'deep' ? 80 : 40; 
        
        const holdX1 = Math.max(LEFT_BOUNDARY + 20, currentX - sidePatrol); // Clamp to boundaries
        const holdX2 = Math.min(RIGHT_BOUNDARY - 20, currentX + sidePatrol); // Clamp to boundaries

        // Add patrol points to move laterally in the zone
        defWaypoints.push([holdX1, currentY]); 
        defWaypoints.push([holdX2, currentY]); 
        defWaypoints.push([currentX, currentY]); 

        return generateMovements(defStart, defWaypoints, false, defPlayer.type);
    }
    
    // Fallback: Static movement for any unassigned defender
    return generateMovements(defStart, [], false, defPlayer.type);
};