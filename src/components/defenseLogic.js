// components/defenseLogic.js

import {
    DEFENSIVE_LINE_X,
    DEFENSIVE_LINE_COUNT,
    SECONDARY_COUNT,
    PX_PER_YARD,
    FIELD_HEIGHT,
    RIGHT_ENDZONE_EDGE,
    TOP_SIDELINE,
    BOTTOM_SIDELINE,
    PLAYER_SPEEDS,
    STANDARD_PLAYER_SPEED
} from './constants';
import { generateMovements, getPlayerPos } from './playerLogic';

const END_PLAY_TIME = 15000;
const PATROL_CYCLES = 4; // Number of back-and-forth patrol cycles for zone defenders

// League-average tendencies (used when no team is selected)
const LEAGUE_AVG_TENDENCIES = {
    coverage: { cover0: 0.04, cover1: 0.20, cover2: 0.22, cover3: 0.28, cover4: 0.12, cover6: 0.06, '2man': 0.08 },
    blitzRate: 0.133,
    avgRushers: 4.3,
    avgDefendersInBox: 5.1
};

// --- Weighted coverage selection from tendency distribution ---
const selectWeightedCoverage = (tendencies) => {
    const dist = tendencies?.coverage || LEAGUE_AVG_TENDENCIES.coverage;
    const entries = Object.entries(dist);
    const rand = Math.random();
    let cumulative = 0;
    for (const [key, weight] of entries) {
        cumulative += weight;
        if (rand <= cumulative) return key;
    }
    return entries[entries.length - 1][0];
};

// --- Helper: build patrol waypoints (drop + multiple cycles) ---
const buildPatrolWaypoints = (dropX, dropY, patrolRange) => {
    const waypoints = [];
    const y1 = Math.max(TOP_SIDELINE + 20, dropY - patrolRange);
    const y2 = Math.min(BOTTOM_SIDELINE - 20, dropY + patrolRange);

    // Initial drop to zone
    waypoints.push([dropX, dropY]);

    // Multiple patrol cycles so defenders never stop
    for (let c = 0; c < PATROL_CYCLES; c++) {
        waypoints.push([dropX, y1]);
        waypoints.push([dropX, y2]);
    }
    waypoints.push([dropX, dropY]);

    return waypoints;
};

// --- UTILITY FUNCTION (4) - Generate Random Defense ---
export const generateRandomDefense = (routeData, teamDefense = null, tendencies = null) => {
    const t = tendencies || LEAGUE_AVG_TENDENCIES;
    const defense = [];
    const DL_names = ['DE1', 'DT1', 'DT2', 'DE2'];
    const secondary_types = ['LB', 'CB', 'S'];
    const secondary_names = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];
    const selected_coverage = selectWeightedCoverage(t);

    const offenseReceivers = ['WR1', 'WR2', 'WR3', 'TE', 'RB']
        .filter(name => routeData[name])
        .map(name => ({ name: name, x: routeData[name].start[0], y: routeData[name].start[1] }));

    // 1. Position Defensive Line (4 players)
    const offenseCenterY = routeData.C ? routeData.C.start[1] : 250;
    const spread = 200;
    for (let i = 0; i < DEFENSIVE_LINE_COUNT; i++) {
        const y = offenseCenterY + (i - 1.5) * (spread / 3);
        const dlName = DL_names[i];
        const rosterName = teamDefense?.[dlName]?.name || null;
        const rosterSpeed = teamDefense?.[dlName]?.speed || null;
        defense.push({
            name: dlName,
            start: [DEFENSIVE_LINE_X, Math.round(y)],
            initialStart: [DEFENSIVE_LINE_X, Math.round(y)],
            type: 'dl',
            side: 'defense',
            assignment: 'rush',
            movements: [],
            rosterName,
            speed: rosterSpeed || PLAYER_SPEEDS.dl,
        });
    }

    // 2. Position Secondary (7 players)
    const randomizedTypes = [];
    for (let i = 0; i < SECONDARY_COUNT; i++) {
        const secName = secondary_names[i];
        if (teamDefense?.[secName]?.type) {
            randomizedTypes.push(teamDefense[secName].type.toUpperCase());
        } else {
            const typeIndex = Math.floor(Math.random() * secondary_types.length);
            randomizedTypes.push(secondary_types[typeIndex]);
        }
    }

    // Man assignments (for man-based coverages)
    const manAssignments = {};
    let secondaryPlayerIndex = 0;
    offenseReceivers.forEach(rec => {
        if (secondaryPlayerIndex < SECONDARY_COUNT) {
            manAssignments[secondary_names[secondaryPlayerIndex]] = rec.name;
            secondaryPlayerIndex++;
        }
    });

    // Determine blitz
    const isBlitz = Math.random() < t.blitzRate;

    // Box positioning
    const extraBoxDefenders = Math.max(0, Math.min(3, Math.round(t.avgDefendersInBox) - 4));

    // Depth tiers
    const shallowX = DEFENSIVE_LINE_X + 5 * PX_PER_YARD;
    const intermediateX = DEFENSIVE_LINE_X + 10 * PX_PER_YARD;
    const deepX = DEFENSIVE_LINE_X + 20 * PX_PER_YARD;

    // Determine which players blitz (prefer LBs first)
    const blitzIndices = new Set();
    if (isBlitz) {
        const lbIndices = [];
        const otherIndices = [];
        for (let i = 0; i < SECONDARY_COUNT; i++) {
            if (randomizedTypes[i] === 'LB') lbIndices.push(i);
            else otherIndices.push(i);
        }
        const candidates = [...lbIndices, ...otherIndices];
        const numBlitzers = Math.random() < 0.5 ? 1 : 2;
        for (let b = 0; b < numBlitzers && b < candidates.length; b++) {
            blitzIndices.add(candidates[b]);
        }
    }

    for (let i = 0; i < SECONDARY_COUNT; i++) {
        const name = secondary_names[i];
        const type = randomizedTypes[i].toLowerCase();

        let initialX, initialY;
        let assignment = manAssignments[name] || null;

        const isBlitzer = blitzIndices.has(i);
        const rosterName = teamDefense?.[name]?.name || null;
        const rosterSpeed = teamDefense?.[name]?.speed || null;

        if (isBlitzer) {
            initialX = DEFENSIVE_LINE_X + 1 * PX_PER_YARD;
            initialY = Math.round(Math.random() * (FIELD_HEIGHT - 60) + 30);
            assignment = 'blitz';
        } else if (isManCoverage(selected_coverage) && assignment) {
            const targetRec = offenseReceivers.find(r => r.name === assignment);
            if (targetRec) {
                const tightOffset = selected_coverage === 'cover0' ? (3 + Math.random() * 5) : (5 + Math.random() * 10);
                initialY = targetRec.y + (targetRec.y < FIELD_HEIGHT / 2 ? tightOffset : -tightOffset);
                initialX = targetRec.x + 10;
            } else {
                initialX = intermediateX;
                initialY = Math.round(Math.random() * (FIELD_HEIGHT - 60) + 30);
            }
        } else {
            if (i < extraBoxDefenders) {
                initialX = shallowX;
            } else if (i < extraBoxDefenders + 2) {
                initialX = intermediateX;
            } else {
                initialX = deepX;
            }
            initialY = Math.round(Math.random() * (FIELD_HEIGHT - 60) + 30);
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
            rosterName,
            speed: rosterSpeed || PLAYER_SPEEDS[type] || STANDARD_PLAYER_SPEED,
        });
    }

    return { players: defense, coverage: selected_coverage };
};

// Helper: is this a man-based coverage?
const isManCoverage = (cov) => ['man', 'cover0', 'cover1', '2man'].includes(cov);

// --- UTILITY FUNCTION (5) - Compile Defense Movement ---
export const compileDefenseMovement = (defPlayer, coverage, routeData) => {
    const defStart = defPlayer.start;
    const playerSpeed = defPlayer.speed || null;

    // DL rushes toward QB (at rush speed, not sprint)
    if (defPlayer.type === 'dl') {
        const qbPos = routeData.QB?.start || [160, 250];
        const waypoints = [[qbPos[0], qbPos[1]]];
        return generateMovements(defStart, waypoints, false, 'dl', playerSpeed, true);
    }

    const secondaryPlayers = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];

    // --- Blitz Movement ---
    if (defPlayer.assignment === 'blitz') {
        const qbPos = routeData.QB?.start || [160, 250];
        const waypoints = [[qbPos[0], qbPos[1]]];
        return generateMovements(defStart, waypoints, false, defPlayer.type, playerSpeed);
    }

    // --- Man Coverage Movement (cover0, cover1, man, 2man) ---
    if (isManCoverage(coverage) && defPlayer.assignment && defPlayer.assignment !== 'blitz') {
        const receiverName = defPlayer.assignment;
        const receiverRouteData = routeData[receiverName];

        if (!receiverRouteData) return generateMovements(defStart, [], false, defPlayer.type, playerSpeed);

        const offensivePlayer = {
            start: receiverRouteData.start,
            movements: generateMovements(receiverRouteData.start, receiverRouteData.waypoints, true, receiverName.startsWith('R') ? 'rb' : 'receiver'),
            initialStart: receiverRouteData.start
        };

        const defenseWaypoints = [];

        const SEPARATION_PIXELS = coverage === 'cover0' ? (3 + Math.random() * 5) : (5 + Math.random() * 10);
        const separationAngle = Math.random() * 2 * Math.PI;

        const fixedOffsetX = SEPARATION_PIXELS * Math.cos(separationAngle);
        const fixedOffsetY = SEPARATION_PIXELS * Math.sin(separationAngle);

        // Sample receiver position at fine even intervals for smooth tracking
        const SAMPLE_INTERVAL = 200; // ms
        const lastRouteTime = receiverRouteData.waypoints.length > 0
            ? receiverRouteData.waypoints[receiverRouteData.waypoints.length - 1][2]
            : 2000;
        const sampleEnd = Math.min(lastRouteTime + 2000, END_PLAY_TIME);

        for (let t = 0; t <= sampleEnd; t += SAMPLE_INTERVAL) {
            const [targetX, targetY] = getPlayerPos(offensivePlayer, t, 0);
            defenseWaypoints.push([targetX + fixedOffsetX, targetY + fixedOffsetY]);
        }

        return generateMovements(defStart, defenseWaypoints, false, defPlayer.type, playerSpeed);
    }

    // --- Cover 0 non-man defenders: extra blitzers ---
    if (coverage === 'cover0' && !defPlayer.assignment) {
        const qbPos = routeData.QB?.start || [160, 250];
        return generateMovements(defStart, [[qbPos[0], qbPos[1]]], false, defPlayer.type, playerSpeed);
    }

    // --- Cover 1: man + 1 deep safety + robber ---
    if (coverage === 'cover1') {
        if (defPlayer.name === 'D6') {
            const deepCenterX = RIGHT_ENDZONE_EDGE - 60;
            const centerY = FIELD_HEIGHT / 2;
            return generateMovements(defStart, buildPatrolWaypoints(deepCenterX, centerY, 60), false, defPlayer.type, playerSpeed);
        }
        if (defPlayer.name === 'D7') {
            const robberX = DEFENSIVE_LINE_X + 15 * PX_PER_YARD;
            const centerY = FIELD_HEIGHT / 2;
            return generateMovements(defStart, buildPatrolWaypoints(robberX, centerY, 30), false, defPlayer.type, playerSpeed);
        }
        return generateMovements(defStart, [], false, defPlayer.type, playerSpeed);
    }

    // --- Cover 2 Zone ---
    if (coverage === 'cover2') {
        return compileZoneCover2or3(defPlayer, 'cover2', defStart, secondaryPlayers, playerSpeed);
    }

    // --- Cover 3 Zone ---
    if (coverage === 'cover3') {
        return compileZoneCover2or3(defPlayer, 'cover3', defStart, secondaryPlayers, playerSpeed);
    }

    // --- Cover 4 (Quarters) ---
    if (coverage === 'cover4') {
        const playerIndex = secondaryPlayers.indexOf(defPlayer.name);
        const deepDropX = RIGHT_ENDZONE_EDGE - 30;
        const underneathX = DEFENSIVE_LINE_X + 15 * PX_PER_YARD;

        if (playerIndex < 4) {
            const quarterY = FIELD_HEIGHT * (0.125 + playerIndex * 0.25);
            return generateMovements(defStart, buildPatrolWaypoints(deepDropX, quarterY, 30), false, defPlayer.type, playerSpeed);
        } else {
            const underIdx = playerIndex - 4;
            const underY = FIELD_HEIGHT * (0.25 + underIdx * 0.25);
            return generateMovements(defStart, buildPatrolWaypoints(underneathX, underY, 20), false, defPlayer.type, playerSpeed);
        }
    }

    // --- Cover 6 (Split field: quarters top, cover2 bottom) ---
    if (coverage === 'cover6') {
        const deepDropX = RIGHT_ENDZONE_EDGE - 30;
        const underneathX = DEFENSIVE_LINE_X + 12 * PX_PER_YARD;
        const shallowX = DEFENSIVE_LINE_X + 8 * PX_PER_YARD;

        if (defPlayer.name === 'D1') {
            return generateMovements(defStart, buildPatrolWaypoints(deepDropX, FIELD_HEIGHT * 0.125, 30), false, defPlayer.type, playerSpeed);
        }
        if (defPlayer.name === 'D2') {
            return generateMovements(defStart, buildPatrolWaypoints(deepDropX, FIELD_HEIGHT * 0.375, 30), false, defPlayer.type, playerSpeed);
        }
        if (defPlayer.name === 'D3') {
            return generateMovements(defStart, buildPatrolWaypoints(deepDropX, FIELD_HEIGHT * 0.75, 30), false, defPlayer.type, playerSpeed);
        }
        if (defPlayer.name === 'D4' || defPlayer.name === 'D5') {
            const idx = defPlayer.name === 'D4' ? 0 : 1;
            const y = FIELD_HEIGHT * (0.33 + idx * 0.33);
            return generateMovements(defStart, buildPatrolWaypoints(underneathX, y, 20), false, defPlayer.type, playerSpeed);
        }
        // D6-D7: shallow
        const idx = defPlayer.name === 'D6' ? 0 : 1;
        const y = FIELD_HEIGHT * (0.33 + idx * 0.33);
        return generateMovements(defStart, buildPatrolWaypoints(shallowX, y, 15), false, defPlayer.type, playerSpeed);
    }

    // --- 2-Man (man + 2 deep safeties) ---
    if (coverage === '2man') {
        if (defPlayer.name === 'D6') {
            const deepDropX = RIGHT_ENDZONE_EDGE - 40;
            return generateMovements(defStart, buildPatrolWaypoints(deepDropX, FIELD_HEIGHT * 0.30, 40), false, defPlayer.type, playerSpeed);
        }
        if (defPlayer.name === 'D7') {
            const deepDropX = RIGHT_ENDZONE_EDGE - 40;
            return generateMovements(defStart, buildPatrolWaypoints(deepDropX, FIELD_HEIGHT * 0.70, 40), false, defPlayer.type, playerSpeed);
        }
        return generateMovements(defStart, [], false, defPlayer.type, playerSpeed);
    }

    // Fallback
    return generateMovements(defStart, [], false, defPlayer.type, playerSpeed);
};

// --- Helper: Cover 2 / Cover 3 zone logic (shared) ---
const compileZoneCover2or3 = (defPlayer, coverage, defStart, secondaryPlayers, playerSpeed) => {
    const INTERMEDIATE_DROP_YARDS = 20;
    const intermediateX = DEFENSIVE_LINE_X + INTERMEDIATE_DROP_YARDS * PX_PER_YARD;
    const DEEP_DROP_X = RIGHT_ENDZONE_EDGE - 10;

    const deepDefenders = (coverage === 'cover2') ? ['D1', 'D2'] : ['D1', 'D2', 'D3'];
    const assignmentType = deepDefenders.includes(defPlayer.name) ? 'deep' : 'underneath';

    let targetX, targetY;

    if (assignmentType === 'deep') {
        targetX = DEEP_DROP_X;
        targetY = defStart[1];
    } else {
        const playerIndex = secondaryPlayers.indexOf(defPlayer.name);
        if (playerIndex % 3 === 0) targetY = FIELD_HEIGHT / 4;
        else if (playerIndex % 3 === 1) targetY = FIELD_HEIGHT * 3 / 4;
        else targetY = FIELD_HEIGHT / 2;
        targetX = intermediateX;
    }

    const patrolRange = assignmentType === 'deep' ? 80 : 40;
    const waypoints = buildPatrolWaypoints(targetX, targetY, patrolRange);

    return generateMovements(defStart, waypoints, false, defPlayer.type, playerSpeed);
};

// --- UTILITY FUNCTION: Compile OL Blocking Movement ---
export const compileOLMovement = (olPlayer, dlPlayers) => {
    if (!dlPlayers || dlPlayers.length === 0) {
        return generateMovements(olPlayer.start, [], true, 'ol');
    }

    // Find nearest DL rusher
    let nearestDL = null;
    let nearestDist = Infinity;
    for (const dl of dlPlayers) {
        const dx = dl.start[0] - olPlayer.start[0];
        const dy = dl.start[1] - olPlayer.start[1];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearestDL = dl;
        }
    }

    if (!nearestDL) {
        return generateMovements(olPlayer.start, [], true, 'ol');
    }

    // OL stays in place (stagnant)
    return generateMovements(olPlayer.start, [], true, 'ol');
};
