// utils.js

// --- UTILITY FUNCTION (0) - Distance to Segment ---
export const distToSegment = (p, a, b) => {
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