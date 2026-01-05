// components/playerLogic.js

import { 
    STANDARD_PLAYER_SPEED, 
    FIELD_WIDTH, 
    TOP_ENDZONE_LINE, 
    FRONT_BOUNDARY, 
    BACK_BOUNDARY,
    LEFT_BOUNDARY, 
    RIGHT_BOUNDARY, 
    BALL_TRAVEL_TIME,
    LINE_PLAYERS
} from './constants';
import { distToSegment } from './utils';

// --- UTILITY FUNCTION (1) - Generate Movements ---
export const generateMovements = (startPos, waypoints, isOffense = false, playerType = null) => {
    
    // Players defined as 'ol', 'qb', or 'dl' are STATIC and do not move.
    const STATIC_TYPES = ['ol', 'qb', 'dl'];
    if (STATIC_TYPES.includes(playerType)) {
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
        
        // FIX: Handle zero distance to prevent division by zero (resulting in NaN/Infinity velocity)
        if (distance === 0) {
            // Create a nominal 1ms static segment to allow time to advance to the next unique waypoint.
            // This prevents NaN/Infinity from being calculated for Mx/My.
            movements.push({ 
                t_start: prevTime, 
                t_end: prevTime + 1, 
                x_func: (t) => 0, 
                y_func: (t) => 0, 
            });

            prevTime += 1; 
            continue; // Skip the rest of the movement calculation for this zero-distance segment.
        }

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


// --- UTILITY FUNCTION (2) - Get Player Position ---
export const getPlayerPos = (player, elapsed, racTimeOffset = 0, carrierPos = null) => {
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
    if (isRACPhase && player.side === 'defense') { 
        
        const [initialX, initialY] = getPlayerPos(player, racTimeOffset, 0); 

        const pursuitDuration = elapsed - racTimeOffset;
        
        const PURSUIT_SPEED = STANDARD_PLAYER_SPEED * 1.15; 
        const distanceTraveled = PURSUIT_SPEED * pursuitDuration;
        
        let targetX, targetY;
        
        if (carrierPos) {
            targetX = carrierPos[0];
            targetY = carrierPos[1];
        } else {
            targetX = FIELD_WIDTH / 2;
            targetY = TOP_ENDZONE_LINE - 20; 
        }

        const dX = targetX - initialX;
        const dY = targetY - initialY;
        const totalDistance = Math.sqrt(dX * dX + dY * dY);
        
        const normDx = dX / (totalDistance || 1);
        const normDy = dY / (totalDistance || 1);
        
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
                
                // If dx_in_segment or dy_in_segment is NaN (due to prior division by zero), 
                // this check is what prevents the player from moving to the corner.
                // The fix above prevents the NaN, but we keep the logic here.
                if (isNaN(dx_in_segment) || isNaN(dy_in_segment)) {
                     // Safety net: if NaN still occurs, hold position.
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
        
        const distanceTraveled = STANDARD_PLAYER_SPEED * racDuration;
        
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


// --- UTILITY FUNCTION (3) - Calculate Openness Score ---
export const calculateOpennessScore = (receiver, defenders, throwTime) => {
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
    
    if (ry <= TOP_ENDZONE_LINE && minSeparation < 30) {
        return score - 50; 
    }
    
    return score;
};

// --- HELPER FUNCTION: Defines a player object for the main component to use ---
export const getPlayerDefinition = (name, routeData) => {
    const data = routeData[name];
    if (!data) return null;
    let type = 'receiver';
    let side = 'offense';
    if (name === 'QB') type = 'qb';
    if (name === 'RB') type = 'rb'; 
    if (LINE_PLAYERS.includes(name)) type = 'ol';
    if (name === 'TE') type = 'te';
    
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