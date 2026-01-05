// constants.js

export const FIELD_WIDTH = 600;
export const FIELD_HEIGHT = 800;
export const ENDZONE_HEIGHT = 50;
export const PLAYABLE_HEIGHT = FIELD_HEIGHT - 2 * ENDZONE_HEIGHT;
export const PX_PER_YARD = 7;

export const BASE_FRAME_RATE = 16.67; // ms (approx 60 FPS)
export const STANDARD_PLAYER_SPEED = 0.055; // Approx 5.5 yards per second (fast running)

// Boundary limits
export const LEFT_BOUNDARY = 0;
export const RIGHT_BOUNDARY = FIELD_WIDTH;
export const TOP_ENDZONE_LINE = ENDZONE_HEIGHT;
export const FRONT_BOUNDARY = ENDZONE_HEIGHT - (5 * PX_PER_YARD); 
export const BACK_BOUNDARY = FIELD_HEIGHT + (5 * PX_PER_YARD); 

// DEFENSE CONSTANTS
export const DEFENSIVE_LINE_Y = 540 - 2 * PX_PER_YARD; // Just across the line of scrimmage (LOS)
export const DEFENSIVE_LINE_COUNT = 4;
export const SECONDARY_COUNT = 7;

// THRESHOLDS (in pixels)
export const CATCH_RADIUS = 15; 
export const DEF_INTERCEPTION_RADIUS = 10; 
export const DEFLECTION_RADIUS = 5; 
export const TACKLE_RADIUS = 15; 
export const QB_THROW_TIME = 8000; 

// PASS CONSTANTS
export const BALL_TRAVEL_TIME = 1200; 

// PLAYER LISTS
export const LINE_PLAYERS = ['LT', 'LG', 'C', 'RG', 'RT']; 
export const EDITABLE_PLAYERS = ['QB', 'RB', 'TE', 'WR1', 'WR2', 'WR3']; 
export const ALL_OFFENSE_PLAYERS = [...LINE_PLAYERS, ...EDITABLE_PLAYERS];

export const defaultRouteData = { 
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