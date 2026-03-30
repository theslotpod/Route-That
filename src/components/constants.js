// constants.js — Horizontal field (TV-style): offense attacks left-to-right

export const FIELD_WIDTH = 900;
export const FIELD_HEIGHT = 500;
export const ENDZONE_WIDTH = 40;
export const PLAYABLE_WIDTH = FIELD_WIDTH - 2 * ENDZONE_WIDTH; // 820
export const PX_PER_YARD = 7;

export const BASE_FRAME_RATE = 16.67; // ms (approx 60 FPS)
export const STANDARD_PLAYER_SPEED = 0.055; // Approx 5.5 yards per second (fast running)

// Position-based speed map (pixels per ms)
// Calibrated from NFL Combine 40-yard dash averages:
// speed = PX_PER_YARD * 40 / (forty * 1000) * 0.95
// These are fallback defaults — per-player speeds from combine data override these
export const PLAYER_SPEEDS = {
    receiver: 0.0593, // WR avg 4.50s forty
    cb: 0.0596,       // CB avg 4.48s forty
    rb: 0.0587,       // RB avg 4.55s forty
    s: 0.0588,        // S avg 4.54s forty
    te: 0.0563,       // TE avg 4.74s forty
    lb: 0.0575,       // LB avg 4.64s forty
    qb: 0.0557,       // QB avg 4.79s forty
    dl: 0.0529,       // DE/DT avg ~4.95s forty (sprint speed)
    ol: 0.0513,       // OL avg ~5.22s forty
};

// DL rush speed is slower than sprint (power moves through blocks)
export const DL_RUSH_FACTOR = 0.50;

// Dynamic ball travel: base speed in pixels per ms
export const BALL_SPEED = 0.6;
export const MIN_BALL_TRAVEL_TIME = 400;
export const MAX_BALL_TRAVEL_TIME = 2000;

// Horizontal field boundaries
export const LOS_X = 200;
export const DEFENSIVE_LINE_X = LOS_X + 2 * PX_PER_YARD; // 214

export const TOP_SIDELINE = 0;
export const BOTTOM_SIDELINE = FIELD_HEIGHT; // 500
export const LEFT_ENDZONE_EDGE = ENDZONE_WIDTH; // 40
export const RIGHT_ENDZONE_EDGE = FIELD_WIDTH - ENDZONE_WIDTH; // 860

// Extended boundaries for ball/player clamping
export const FIELD_LEFT_BOUND = LEFT_ENDZONE_EDGE - 5 * PX_PER_YARD;
export const FIELD_RIGHT_BOUND = RIGHT_ENDZONE_EDGE + 5 * PX_PER_YARD;

// DEFENSE CONSTANTS
export const DEFENSIVE_LINE_COUNT = 4;
export const SECONDARY_COUNT = 7;

// THRESHOLDS (in pixels)
export const CATCH_RADIUS = 15;
export const DEF_INTERCEPTION_RADIUS = 10;
export const DEFLECTION_RADIUS = 5;
export const TACKLE_RADIUS = 15;
export const QB_THROW_TIME = 8000;
export const MIN_QB_THROW_TIME = 1500; // QB holds ball at least 1.5s to let routes develop
export const OPEN_THRESHOLD = 40;

// PASS CONSTANTS
export const BALL_TRAVEL_TIME = 1200;

// PLAYER LISTS
export const LINE_PLAYERS = ['LT', 'LG', 'C', 'RG', 'RT'];
export const EDITABLE_PLAYERS = ['RB', 'TE', 'WR1', 'WR2', 'WR3'];
export const ALL_OFFENSE_PLAYERS = [...LINE_PLAYERS, 'QB', ...EDITABLE_PLAYERS];

// Default positions: offense at/behind LOS_X=200, spread vertically (Y)
export const defaultRouteData = {
    LT:  { start: [200, 170], waypoints: [] },
    LG:  { start: [200, 210], waypoints: [] },
    C:   { start: [200, 250], waypoints: [] },
    RG:  { start: [200, 290], waypoints: [] },
    RT:  { start: [200, 330], waypoints: [] },
    QB:  { start: [160, 250], waypoints: [] },
    RB:  { start: [160, 290], waypoints: [] },
    TE:  { start: [200, 370], waypoints: [] },
    WR1: { start: [200, 450], waypoints: [] },
    WR2: { start: [200, 50], waypoints: [] },
    WR3: { start: [200, 20], waypoints: [] },
};
