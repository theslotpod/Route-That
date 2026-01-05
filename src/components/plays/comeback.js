const comeback = {
  name: "Comeback",

  qb: {
    start: [416.33, 400],
  },

  rb: [
    {
      start: [430, 400],
      route: (t) => {
        const total = 5000;
        const p = Math.min(t / total, 1);

        return [
          430,
          400 - 80 * p,
        ];
      },
    },
  ],

  te: [
    {
      name: "TE1",
      start: [550, 375],

      // 🔵 TE shallow slant (right → left, lower depth)
      route: (t) => {
        const total = 5000;
        const half = total / 2;
        const elapsed = Math.min(t, total);

        const stemDX = 40;
        const stemDY = -120;

        const angle = (210 * Math.PI) / 180; // left & slightly down
        const slantSpeed = 200;

        const slantDX = Math.cos(angle) * slantSpeed;
        const slantDY = Math.sin(angle) * slantSpeed;

        if (elapsed <= half) {
          const p = elapsed / half;
          return [
            550 + stemDX * p,
            375 + stemDY * p,
          ];
        }

        const p = (elapsed - half) / half;
        const breakX = 550 + stemDX;
        const breakY = 375 + stemDY;

        return [
          breakX + slantDX * p,
          breakY + slantDY * p,
        ];
      },
    },
  ],

  receivers: [
    {
      name: "WR1",
      start: [200, 375],

      // 🟣 Wheel route: sideline → vertical
      route: (t) => {
        const total = 5000;
        const half = total / 2;
        const elapsed = Math.min(t, total);

        const sidelineDX = -120;
        const sidelineDY = 0;

        const verticalDY = -450;

        if (elapsed <= half) {
          const p = elapsed / half;
          return [
            200 + sidelineDX * p,
            375 + sidelineDY * p,
          ];
        }

        const p = (elapsed - half) / half;
        const breakX = 200 + sidelineDX;
        const breakY = 375;

        return [
          breakX,
          breakY + verticalDY * p,
        ];
      },
    },

    {
      name: "WR2",
      start: [230, 375],

      // 🟠 Your working route (unchanged)
      route: (t) => {
        const total = 5000;
        const half = total / 2;
        const elapsed = Math.min(t, total);

        const stemDX = 250;
        const stemDY = -300;

        const angle = (180 * Math.PI) / 180;
        const slantSpeed = 300;

        const slantDX = Math.cos(angle) * slantSpeed;
        const slantDY = -Math.sin(angle) * slantSpeed;

        if (elapsed <= half) {
          const p = elapsed / half;
          return [
            230 + stemDX * p,
            375 + stemDY * p,
          ];
        }

        const p = (elapsed - half) / half;
        const breakX = 230 + stemDX;
        const breakY = 375 + stemDY;

        return [
          breakX + slantDX * p,
          breakY + slantDY * (p / 2),
        ];
      },
    },

    {
      name: "WR3",
      start: [280, 375],

      // 🟢 Screen left: lateral toward QB side
      route: (t) => {
        const total = 5000;
        const p = Math.min(t / total, 1);

        return [
          280 - 200 * p,
          375 + 40 * Math.sin(Math.PI * p), // slight arc for realism
        ];
      },
    },
  ],

  offensiveLine: [
    { start: [333, 375] },
    { start: [366, 375] },
    { start: [400, 375] },
    { start: [433, 375] },
    { start: [466, 375] },
    { start: [500, 375] },
  ],
};

export default comeback;
