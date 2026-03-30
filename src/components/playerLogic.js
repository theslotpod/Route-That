// components/playerLogic.js

import {
    STANDARD_PLAYER_SPEED,
    PLAYER_SPEEDS,
    DL_RUSH_FACTOR,
    FIELD_HEIGHT,
    RIGHT_ENDZONE_EDGE,
    FIELD_LEFT_BOUND,
    FIELD_RIGHT_BOUND,
    TOP_SIDELINE,
    BOTTOM_SIDELINE,
    BALL_TRAVEL_TIME,
    BALL_SPEED,
    MIN_BALL_TRAVEL_TIME,
    MAX_BALL_TRAVEL_TIME,
    LINE_PLAYERS
} from './constants';

// --- UTILITY FUNCTION (1) - Generate Movements ---
// playerSpeed: optional per-player speed override (px/ms)
// isDLRush: if true, use DL_RUSH_FACTOR to slow down (pass rush, not sprinting)
export const generateMovements = (startPos, waypoints, isOffense = false, playerType = null, playerSpeed = null, isDLRush = false) => {

    // QB and OL are truly static (stay in place)
    const STATIC_TYPES = ['qb', 'ol', 'dl'];
    if (STATIC_TYPES.includes(playerType)) {
        return [{
            t_start: 0,
            t_end: Infinity,
            x_func: (t) => 0,
            y_func: (t) => 0,
        }];
    }

    // Get speed: per-player override → position default → standard
    let speed = playerSpeed || PLAYER_SPEEDS[playerType] || STANDARD_PLAYER_SPEED;

    // DL rush uses a fraction of sprint speed
    if (isDLRush) {
        speed = speed * DL_RUSH_FACTOR;
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

        if (distance === 0) {
            movements.push({
                t_start: prevTime,
                t_end: prevTime + 1,
                x_func: (t) => 0,
                y_func: (t) => 0,
            });
            prevTime += 1;
            continue;
        }

        const duration = distance / speed;
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


// --- UTILITY FUNCTION (2) - Get Player Position ---
export const getPlayerPos = (player, elapsed, racTimeOffset = 0, carrierPos = null) => {
    const startX = player.initialStart ? player.initialStart[0] : player.start[0];
    const startY = player.initialStart ? player.start[1] : player.start[1];

    // QB and OL are truly static (stay in place)
    const STATIC_TYPES = ['qb', 'ol', 'dl'];
    if (STATIC_TYPES.includes(player.type)) {
        return [startX, startY];
    }

    let currentX = startX;
    let currentY = startY;

    let accumulatedDx = 0;
    let accumulatedDy = 0;

    const isRACPhase = racTimeOffset > 0;

    // === Defensive Pursuit: defenders chase carrier in RAC Phase ===
    if (isRACPhase && player.side === 'defense') {

        const [initialX, initialY] = getPlayerPos(player, racTimeOffset, 0);

        const pursuitDuration = elapsed - racTimeOffset;

        // Use per-player speed if available, otherwise position default
        const baseSpeed = player.speed || PLAYER_SPEEDS[player.type] || STANDARD_PLAYER_SPEED;
        // Full speed pursuit immediately (no ramp-up)
        const PURSUIT_SPEED = baseSpeed * 1.15;

        let targetX, targetY;

        if (carrierPos) {
            targetX = carrierPos[0];
            targetY = carrierPos[1];
        } else {
            targetX = RIGHT_ENDZONE_EDGE;
            targetY = FIELD_HEIGHT / 2;
        }

        const dX = targetX - initialX;
        const dY = targetY - initialY;
        const totalDistance = Math.sqrt(dX * dX + dY * dY);
        const maxTravel = PURSUIT_SPEED * pursuitDuration;

        if (totalDistance > 0) {
            const travel = Math.min(maxTravel, totalDistance);
            currentX = initialX + (dX / totalDistance) * travel;
            currentY = initialY + (dY / totalDistance) * travel;
        } else {
            currentX = initialX;
            currentY = initialY;
        }

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

                if (isNaN(dx_in_segment) || isNaN(dy_in_segment)) {
                     currentX = startX + accumulatedDx;
                     currentY = startY + accumulatedDy;
                } else {
                    currentX = startX + accumulatedDx + dx_in_segment;
                    currentY = startY + accumulatedDy + dy_in_segment;
                }

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
        const carrierSpeed = player.speed || PLAYER_SPEEDS[player.type] || STANDARD_PLAYER_SPEED;
        const distanceTraveled = carrierSpeed * racDuration;

        // Run straight RIGHTWARD toward opponent endzone (+X)
        currentX = initialRacX + distanceTraveled;
        currentY = initialRacY;
    }

    // Boundary checks (horizontal field: sidelines top/bottom, endzones left/right)
    if (currentX < FIELD_LEFT_BOUND) { currentX = FIELD_LEFT_BOUND; }
    else if (currentX > FIELD_RIGHT_BOUND) { currentX = FIELD_RIGHT_BOUND; }

    if (currentY < TOP_SIDELINE) { currentY = TOP_SIDELINE; }
    else if (currentY > BOTTOM_SIDELINE) { currentY = BOTTOM_SIDELINE; }

    return [currentX, currentY];
};


// --- UTILITY: Calculate dynamic ball travel time based on distance ---
export const calculateBallTravelTime = (qbPos, targetPos) => {
    const dx = targetPos[0] - qbPos[0];
    const dy = targetPos[1] - qbPos[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const travelTime = distance / BALL_SPEED;
    return Math.max(MIN_BALL_TRAVEL_TIME, Math.min(MAX_BALL_TRAVEL_TIME, travelTime));
};

// --- UTILITY FUNCTION (3) - Calculate Openness Score ---
export const calculateOpennessScore = (receiver, defenders, throwTime, qbPos) => {
    // Use dynamic ball travel time
    const [futureRx, futureRy] = getPlayerPos(receiver, throwTime + 1000, 0);
    const ballTravelTime = qbPos ? calculateBallTravelTime(qbPos, [futureRx, futureRy]) : BALL_TRAVEL_TIME;
    const catchTime = throwTime + ballTravelTime;
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

    // Penalize throws into crowded endzone (receiver past right endzone edge)
    if (rx >= RIGHT_ENDZONE_EDGE && minSeparation < 30) {
        return score - 50;
    }

    return score;
};

// --- HELPER FUNCTION: Defines a player object for the main component to use ---
export const getPlayerDefinition = (name, routeData, rosterSpeed = null) => {
    const data = routeData[name];
    if (!data) return null;
    let type = 'receiver';
    let side = 'offense';
    if (name === 'QB') type = 'qb';
    if (name === 'RB') type = 'rb';
    if (LINE_PLAYERS.includes(name)) type = 'ol';
    if (name === 'TE') type = 'te';

    const movements = generateMovements(data.start, data.waypoints, true, type, rosterSpeed);
    return {
        name,
        start: data.start,
        initialStart: data.start,
        type,
        side,
        movements,
        speed: rosterSpeed || PLAYER_SPEEDS[type] || STANDARD_PLAYER_SPEED,
    };
};
