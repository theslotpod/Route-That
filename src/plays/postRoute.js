const vertical = {
  name: "Post Route",
  qb: {
    start: [400, 200],
    movements: [
      // optional QB dropback
      { delay: 0, duration: 1000, dx: 0, dy: -20 },
    ],
  },
  rb: [
    {
      start: [380, 220],
      movements: [{ delay: 1000, duration: 2000, dx: 0, dy: -40 }],
    },
  ],
  te: [
    {
      start: [420, 180],
      movements: [{ delay: 0, duration: 3000, dx: 50, dy: 0 }],
    },
  ],
  receivers: [
    {
      name: "WR1",
      start: [300, 150],
      movements: [
        { delay: 0, duration: 3000, dx: 0, dy: -200 }, // straight up
      ],
    },
    {
      name: "WR2",
      start: [320, 200],
      movements: [
        { delay: 0, duration: 1500, dx: 20, dy: -80 },
        { delay: 1500, duration: 1500, dx: 30, dy: -120 },
      ],
    },
    {
      name: "WR3",
      start: [340, 250],
      movements: [
        { delay: 0, duration: 1700, dx: 30, dy: -100 },
        { delay: 1700, duration: 1300, dx: 40, dy: -100 },
      ],
    },
  ],
  offensiveLine: [
    { start: [360, 180] },
    { start: [360, 190] },
    { start: [360, 200] },
    { start: [360, 210] },
    { start: [360, 220] },
    { start: [360, 230] },
  ],
};

export default vertical;
