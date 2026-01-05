const flood = {
  name: "Flood",
  qb: {
    start: [300, 570],
    movements: [
      // QB dropback
      { 
        t_start: 0, 
        t_end: 1000, 
        x_func: (t) => 0, 
        y_func: (t) => (20 / 1000) * t 
      },
    ],
  },
  rb: [
    {
      start: [260, 570],
      movements: [
        // Segment 1: (0ms - 2500ms). Dx: -50, Dy: -100
        { 
          t_start: 0, 
          t_end: 2500, 
          x_func: (t) => (-50 / 2500) * t, 
          y_func: (t) => (-100 / 2500) * t, 
        },
        // Segment 2: (2500ms - 5000ms). Displacement from 2500ms: Dx: -200, Dy: -50
        { 
          t_start: 2500, 
          t_end: 5000, 
          x_func: (t) => (-200 / 2500) * t, 
          y_func: (t) => (-50 / 2500) * t, 
        },
        // Segment 3: Run indefinitely
        { 
          t_start: 5000, 
          t_end: Infinity, 
          x_func: (t) => (-0.005) * t, 
          y_func: (t) => (-0.05) * t, 
        },
      ],
    },
  ],
  te: [
    {
      start: [140, 540],
      movements: [
        // Segment 1: (0ms - 2000ms). Dx: 10, Dy: -150
        { 
          t_start: 0, 
          t_end: 2000, 
          x_func: (t) => (10 / 2000) * t, 
          y_func: (t) => (-150 / 2000) * t, 
        },
        // Segment 2: (2000ms - 5000ms). Displacement from 2000ms: Dx: -150, Dy: -100
        { 
          t_start: 2000, 
          t_end: 5000, 
          x_func: (t) => (-150 / 3000) * t, 
          y_func: (t) => (-100 / 3000) * t, 
        },
        // Segment 3: Run indefinitely
        { 
          t_start: 5000, 
          t_end: Infinity, 
          x_func: (t) => (-0.005) * t,
          y_func: (t) => (-0.05) * t, 
        },
      ],
    },
  ],
  receivers: [
    {
      name: "WR1",
      start: [400, 540],
      movements: [
        // Segment 1: (0ms - 500ms). Dx: -10, Dy: -50
        { 
          t_start: 0, 
          t_end: 500, 
          x_func: (t) => (-10 / 500) * t, 
          y_func: (t) => (-50 / 500) * t 
        },
        // Segment 2: (500ms - 3500ms). Displacement from 500ms: Dx: -300, Dy: -10
        { 
          t_start: 500, 
          t_end: 3500, 
          x_func: (t) => (-300 / 3000) * t, 
          y_func: (t) => (-10 / 3000) * t 
        },
        // Segment 3: (3500ms - 5000ms). Displacement from 3500ms: Dx: 10, Dy: -300
        { 
          t_start: 3500, 
          t_end: 5000, 
          x_func: (t) => (10 / 1500) * t, 
          y_func: (t) => (-300 / 1500) * t 
        },
        // Segment 4: Run indefinitely
        { 
          t_start: 5000, 
          t_end: Infinity, 
          x_func: (t) => (-0.005) * t,
          y_func: (t) => (-0.05) * t,
        },
      ],
    },
    {
      name: "WR2",
      start: [60, 540],
      movements: [
        // Segment 1: (0ms - 3000ms). Dx: 10, Dy: -300
        { 
          t_start: 0, 
          t_end: 3000, 
          x_func: (t) => (10 / 3000) * t, 
          y_func: (t) => (-300 / 3000) * t 
        },
        // Segment 2: (3000ms - 5000ms). Displacement from 3000ms: Dx: 400, Dy: -100
        { 
          t_start: 3000, 
          t_end: 5000, 
          x_func: (t) => (400 / 2000) * t, 
          y_func: (t) => (-100 / 2000) * t 
        },
        // Segment 3: Run indefinitely
        { 
          t_start: 5000, 
          t_end: Infinity, 
          x_func: (t) => (0.005) * t,
          y_func: (t) => (-0.05) * t,
        },
      ],
    },
    {
      name: "WR3",
      start: [433, 540],
      movements: [
        // Segment 1: (0ms - 2000ms). Dx: -10, Dy: -200
        { 
          t_start: 0, 
          t_end: 2000, 
          x_func: (t) => (-10 / 2000) * t, 
          y_func: (t) => (-200 / 2000) * t 
        },
        // Segment 2: (2000ms - 5000ms). Displacement from 2000ms: Dx: -200, Dy: -100
        { 
          t_start: 2000, 
          t_end: 5000, 
          x_func: (t) => (-200 / 3000) * t, 
          y_func: (t) => (-100 / 3000) * t 
        },
        // Segment 3: Run indefinitely
        { 
          t_start: 5000, 
          t_end: Infinity, 
          x_func: (t) => (-0.005) * t,
          y_func: (t) => (-0.05) * t,
        },
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