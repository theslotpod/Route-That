const flood = {
  name: "Verts",
  qb: {
    start: [300, 570],
    movements: [
      // QB dropback duration remains the same
      { delay: 0, duration: 1000, dx: 0, dy: 20 },
    ],
  },
  rb: [
    {
      start: [260, 570],
      // Original total duration: 2500ms + 2500ms = 5000ms. Scale Factor: 5000/5000 = 1.0 (No change)
      movements: [
        { delay: 0, duration: 2500, dx: -50, dy: -100 },
        { delay: 2500, duration: 2500, dx: -200, dy: -50 },
      ],
    },
  ],
  te: [
    {
      start: [140, 540],
      // Original total duration: 2000ms + 3000ms = 5000ms. Scale Factor: 1.0 (No change)
      movements: [
        { delay: 0, duration: 2000, dx: 10, dy: -150 },
        { delay: 2000, duration: 3000, dx: -150, dy: -100 },
      ],
    },
  ],
  receivers: [
    {
      name: "WR1",
      start: [400, 540],
      // Original total duration: 500ms + 3000ms + 1500ms = 5000ms. Scale Factor: 1.0 (No change)
      movements: [
        { delay: 0, duration: 500, dx: -10, dy: -50 },
        { delay: 500, duration: 3000, dx: -300, dy: -10 },
        { delay: 3500, duration: 1500, dx: 10, dy: -500 },
      ],
    },
    {
      name: "WR2",
      start: [60, 540],
      // Original total duration: 3000ms + 2000ms = 5000ms. Scale Factor: 1.0 (No change)
      movements: [
        { delay: 0, duration: 3000, dx: 10, dy: -300 },
        { delay: 3000, duration: 2000, dx: 400, dy: -100 },
      ],
    },
    {
      name: "WR3",
      start: [433, 540],
      // Original total duration: 2000ms + 3000ms = 5000ms. Scale Factor: 1.0 (No change)
      movements: [
        { delay: 0, duration: 2000, dx: -10, dy: -200 },
        { delay: 2000, duration: 3000, dx: -200, dy: -100 },
      ],
    },
  ],
  offensiveLine: [
    { start: [233, 540] },
    { start: [266, 540] },
    { start: [300, 540] },
    { start: [333, 540] },
    { start: [366, 540] },
  ],
};

export default flood;