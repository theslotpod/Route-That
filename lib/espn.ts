import type { RushingPlay, ReceivingRoute, RouteType } from "@/types";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const CDN = "https://a.espncdn.com/i/headshots/nfl/players/full";

// Static team ID → display info lookup (ESPN NFL team IDs are stable)
const NFL_TEAM_LOOKUP: Record<string, { abbr: string; name: string; color: string }> = {
  "1":  { abbr: "ATL", name: "Falcons",    color: "#a71930" },
  "2":  { abbr: "BUF", name: "Bills",      color: "#00338d" },
  "3":  { abbr: "CHI", name: "Bears",      color: "#0b1f38" },
  "4":  { abbr: "CIN", name: "Bengals",    color: "#fb4f14" },
  "5":  { abbr: "CLE", name: "Browns",     color: "#311d00" },
  "6":  { abbr: "DAL", name: "Cowboys",    color: "#003594" },
  "7":  { abbr: "DEN", name: "Broncos",    color: "#fa4616" },
  "8":  { abbr: "DET", name: "Lions",      color: "#0076b6" },
  "9":  { abbr: "GB",  name: "Packers",    color: "#203731" },
  "10": { abbr: "TEN", name: "Titans",     color: "#0c2340" },
  "11": { abbr: "IND", name: "Colts",      color: "#003a70" },
  "12": { abbr: "KC",  name: "Chiefs",     color: "#e31837" },
  "13": { abbr: "LV",  name: "Raiders",    color: "#a5acaf" },
  "14": { abbr: "LAR", name: "Rams",       color: "#003594" },
  "15": { abbr: "MIA", name: "Dolphins",   color: "#008e97" },
  "16": { abbr: "MIN", name: "Vikings",    color: "#4f2683" },
  "17": { abbr: "NE",  name: "Patriots",   color: "#002244" },
  "18": { abbr: "NO",  name: "Saints",     color: "#9f8958" },
  "19": { abbr: "NYG", name: "Giants",     color: "#0b2265" },
  "20": { abbr: "NYJ", name: "Jets",       color: "#125740" },
  "21": { abbr: "PHI", name: "Eagles",     color: "#004c54" },
  "22": { abbr: "ARI", name: "Cardinals",  color: "#97233f" },
  "23": { abbr: "PIT", name: "Steelers",   color: "#ffb612" },
  "24": { abbr: "LAC", name: "Chargers",   color: "#0080c6" },
  "25": { abbr: "SF",  name: "49ers",      color: "#aa0000" },
  "26": { abbr: "SEA", name: "Seahawks",   color: "#002244" },
  "27": { abbr: "TB",  name: "Buccaneers", color: "#d50a0a" },
  "28": { abbr: "WSH", name: "Commanders", color: "#773141" },
  "29": { abbr: "CAR", name: "Panthers",   color: "#0085ca" },
  "30": { abbr: "JAX", name: "Jaguars",    color: "#006778" },
  "33": { abbr: "BAL", name: "Ravens",     color: "#241773" },
  "34": { abbr: "HOU", name: "Texans",     color: "#03202f" },
};

// Team abbreviation → brand color (used by nflreadpy-backed search)
export const TEAM_COLORS: Record<string, string> = {
  ARI: "#97233f", ATL: "#a71930", BAL: "#241773", BUF: "#00338d",
  CAR: "#0085ca", CHI: "#0b1f38", CIN: "#fb4f14", CLE: "#311d00",
  DAL: "#003594", DEN: "#fa4616", DET: "#0076b6", GB:  "#203731",
  HOU: "#03202f", IND: "#003a70", JAX: "#006778", KC:  "#e31837",
  LAC: "#0080c6", LAR: "#003594", LV:  "#a5acaf", MIA: "#008e97",
  MIN: "#4f2683", NE:  "#002244", NO:  "#9f8958", NYG: "#0b2265",
  NYJ: "#125740", PHI: "#004c54", PIT: "#ffb612", SEA: "#002244",
  SF:  "#aa0000", TB:  "#d50a0a", TEN: "#0c2340", WSH: "#773141",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ESPNPlayer {
  id: string;
  displayName: string;
  shortName: string;
  positionAbbr: string;
  positionName: string;
  team: string;
  teamAbbr: string;
  teamId: string;
  teamColor: string;
  number: string;
  headshot: string;
  isDraftProspect?: boolean;
}

// ─── Fetch helper with timeout ────────────────────────────────────────────────

async function jsonFetch(url: string, cacheSeconds = 300): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PlayMap/1.0)" },
      next: { revalidate: cacheSeconds },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Team full-name → team ID reverse lookup
const TEAM_FULL_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(NFL_TEAM_LOOKUP).map(([id, t]) => [t.name, id])
);
// Also map by full franchise name e.g. "Philadelphia Eagles" → "21"
const TEAM_FRANCHISE_TO_ID: Record<string, string> = {
  "Atlanta Falcons": "1", "Buffalo Bills": "2", "Chicago Bears": "3",
  "Cincinnati Bengals": "4", "Cleveland Browns": "5", "Dallas Cowboys": "6",
  "Denver Broncos": "7", "Detroit Lions": "8", "Green Bay Packers": "9",
  "Tennessee Titans": "10", "Indianapolis Colts": "11", "Kansas City Chiefs": "12",
  "Las Vegas Raiders": "13", "Los Angeles Rams": "14", "Miami Dolphins": "15",
  "Minnesota Vikings": "16", "New England Patriots": "17", "New Orleans Saints": "18",
  "New York Giants": "19", "New York Jets": "20", "Philadelphia Eagles": "21",
  "Arizona Cardinals": "22", "Pittsburgh Steelers": "23", "Los Angeles Chargers": "24",
  "San Francisco 49ers": "25", "Seattle Seahawks": "26", "Tampa Bay Buccaneers": "27",
  "Washington Commanders": "28", "Carolina Panthers": "29", "Jacksonville Jaguars": "30",
  "Baltimore Ravens": "33", "Houston Texans": "34",
};

function teamIdFromName(fullName: string): string {
  return TEAM_FRANCHISE_TO_ID[fullName] || TEAM_FULL_TO_ID[fullName] || "";
}

// ─── Player Search ────────────────────────────────────────────────────────────

export async function searchPlayers(query: string): Promise<ESPNPlayer[]> {
  const q = encodeURIComponent(query);

  // ESPN search/v2 returns proper relevance-ranked player results
  const searchData = await jsonFetch(
    `https://site.api.espn.com/apis/search/v2?query=${q}&limit=20`,
    120
  );

  if (searchData?.results) {
    const playerSection = (searchData.results as any[]).find((r: any) => r.type === "player");
    if (playerSection?.contents?.length) {
      return (playerSection.contents as any[])
        .map((c: any): ESPNPlayer | null => {
          // Extract athlete ID from uid "s:20~l:28~a:3929630" or link
          const uidMatch = (c.uid || "").match(/a:(\d+)/);
          const linkMatch = (c.link?.web || "").match(/\/id\/(\d+)\//);
          const id = uidMatch?.[1] || linkMatch?.[1];
          if (!id) return null;

          const teamName: string = c.subtitle || "";
          const teamId = teamIdFromName(teamName);
          const teamInfo = teamId ? NFL_TEAM_LOOKUP[teamId] : undefined;

          return {
            id,
            displayName: c.displayName || "Unknown",
            shortName: c.displayName || "",
            positionAbbr: "NFL",   // Position resolved on play fetch
            positionName: "",
            team: teamName || "N/A",
            teamAbbr: teamInfo?.abbr || (teamName ? teamName.split(" ").pop() || "NFL" : "NFL"),
            teamId,
            teamColor: teamInfo?.color || "#00ff88",
            number: "?",
            headshot: c.image?.default || `${CDN}/${id}.png`,
          };
        })
        .filter(Boolean) as ESPNPlayer[];
    }
  }

  // Fall back: core API with $ref links — resolve profiles in parallel
  const coreData = await jsonFetch(
    `${CORE}/athletes?active=true&limit=12&search=${q}`,
    120
  );
  if (!coreData?.items?.length) return [];

  const ids: string[] = (coreData.items as any[])
    .map((item: any) => (item.$ref || "").match(/athletes\/(\d+)/)?.[1])
    .filter(Boolean)
    .slice(0, 10) as string[];

  const settled = await Promise.allSettled(
    ids.map((id) => jsonFetch(`${CORE}/athletes/${id}`, 3600))
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
    .map((r) => parseAthleteObj(r.value))
    .filter(Boolean) as ESPNPlayer[];
}

function parseAthleteObj(a: any): ESPNPlayer | null {
  if (!a?.id) return null;

  // Team may be a $ref object or a full object
  const hasFullTeam = a.team && typeof a.team === "object" && !a.team.$ref && a.team.id;
  const teamObj = hasFullTeam ? a.team : null;

  // Extract teamId from either full object or $ref URL
  const teamId: string = teamObj?.id
    ? String(teamObj.id)
    : (a.team?.$ref || "").match(/teams\/(\d+)/)?.[1] || "";

  // Use lookup table as fallback when team object isn't inlined
  const lookup = teamId ? NFL_TEAM_LOOKUP[teamId] : undefined;

  const teamName = teamObj?.displayName || teamObj?.name || lookup?.name || "";
  const teamAbbr = teamObj?.abbreviation || lookup?.abbr || (teamName ? "" : "N/A");
  const teamColor = teamObj?.color
    ? `#${teamObj.color}`
    : lookup?.color || "#00ff88";

  return {
    id: String(a.id),
    displayName: a.displayName || a.fullName || "Unknown",
    shortName: a.shortName || a.displayName || "",
    positionAbbr: a.position?.abbreviation || a.position?.abbr || "?",
    positionName: a.position?.displayName || a.position?.name || "",
    team: teamName || "N/A",
    teamAbbr: teamAbbr || "N/A",
    teamId,
    teamColor,
    number: a.jersey || a.displayNumber || "?",
    headshot: a.headshot?.href || `${CDN}/${a.id}.png`,
  };
}

// ─── Athlete Team ID ──────────────────────────────────────────────────────────

export async function getAthleteTeamId(athleteId: string): Promise<string | null> {
  const data = await jsonFetch(`${CORE}/athletes/${athleteId}`, 3600);
  if (!data) return null;

  if (data.team?.id) return String(data.team.id);
  const refMatch = (data.team?.$ref || "").match(/teams\/(\d+)/);
  return refMatch ? refMatch[1] : null;
}

// ─── Team Schedule ────────────────────────────────────────────────────────────

export async function getTeamGameIds(
  teamId: string,
  season = "2025"
): Promise<{ eventId: string; week: number }[]> {
  const data = await jsonFetch(
    `${SITE}/teams/${teamId}/schedule?season=${season}`,
    3600
  );
  if (!data?.events) return [];

  const results: { eventId: string; week: number }[] = [];

  for (const event of data.events as any[]) {
    const comp = event.competitions?.[0];
    if (!comp?.id) continue;
    if (!comp.status?.type?.completed) continue; // skip future/live games
    results.push({
      eventId: String(comp.id),
      week: event.week?.number ?? results.length + 1,
    });
  }

  return results;
}

// ─── Play Text Parsing ────────────────────────────────────────────────────────

const RUSH_DIR_MAP: [RegExp, number][] = [
  [/right (?:end|wide|outside|sweep)/i,  60],
  [/left (?:end|wide|outside|sweep)/i,  -60],
  [/right tackle/i,                       36],
  [/left tackle/i,                       -36],
  [/right guard/i,                        20],
  [/left guard/i,                        -20],
  [/(?:up (?:the )?)?(?:middle|gut|center)/i, 0],
  [/\bright\b/i,                          28],
  [/\bleft\b/i,                          -28],
];

function parseRushAngle(text: string): number {
  for (const [re, deg] of RUSH_DIR_MAP) {
    if (re.test(text)) return deg;
  }
  // Small random noise for unspecified carries
  return Math.round((Math.random() - 0.5) * 22);
}

function parseReceivingInfo(
  text: string,
  yards: number
): { side: ReceivingRoute["side"]; depth: number; routeType: RouteType } {
  const t = text.toLowerCase();
  const isDeep = t.includes("deep");
  const isMedium = !isDeep && (t.includes("medium") || t.includes("intermediate"));
  const isLeft = /\bleft\b/.test(t);
  const isRight = /\bright\b/.test(t);

  let side: ReceivingRoute["side"];
  if (isLeft && /\bend\b/.test(t)) side = "left";
  else if (isRight && /\bend\b/.test(t)) side = "right";
  else if (isLeft) side = "slot-left";
  else side = "slot-right";

  const depth = isDeep
    ? Math.max(16, yards > 0 ? yards : 22)
    : isMedium
    ? Math.max(8, Math.min(yards > 0 ? yards : 12, 18))
    : Math.max(3, Math.min(yards > 0 ? yards : 7, 12));

  let routeType: RouteType;
  if (isDeep) {
    if (side === "left") routeType = "corner";
    else if (side === "right") routeType = "post";
    else routeType = Math.random() > 0.5 ? "post" : "go";
  } else if (depth <= 3) {
    routeType = "flat";
  } else if (depth <= 6) {
    routeType = side === "slot-left" || side === "slot-right" ? "slant" : "out";
  } else if (depth <= 10) {
    routeType = Math.random() > 0.5 ? "curl" : "out";
  } else if (depth <= 14) {
    routeType = "in";
  } else {
    routeType = "go";
  }

  return { side, depth, routeType };
}

function parseYardsFromText(text: string): number {
  if (/no gain|no yardage/i.test(text)) return 0;
  const loss = text.match(/loss of (\d+)/i);
  if (loss) return -parseInt(loss[1]);
  const forMatch = text.match(/for (-?\d+) yards?/i);
  if (forMatch) return parseInt(forMatch[1]);
  return 0;
}

/** Build abbreviated name forms for text matching.
 *  "Saquon Barkley" → ["S.Barkley", "Sa.Barkley", "Saquon Barkley"] */
function nameAbbrevs(fullName: string): string[] {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return [fullName];
  const f = parts[0];
  const l = parts[parts.length - 1];
  return [
    `${f[0]}.${l}`,
    f.length > 1 ? `${f.slice(0, 2)}.${l}` : null,
    fullName,
  ].filter(Boolean) as string[];
}

// ─── Game Play Extraction ─────────────────────────────────────────────────────

export async function extractPlaysFromGame(
  eventId: string,
  playerName: string,
  week: number
): Promise<{ rushing: RushingPlay[]; receiving: ReceivingRoute[] }> {
  const data = await jsonFetch(`${SITE}/summary?event=${eventId}`, 86400);
  const rushing: RushingPlay[] = [];
  const receiving: ReceivingRoute[] = [];
  if (!data) return { rushing, receiving };

  const abbrevs = nameAbbrevs(playerName);
  const allPlays: any[] = [];

  // Drives → plays
  const driveArr = data.drives?.previous ?? (Array.isArray(data.drives) ? data.drives : []);
  for (const drive of driveArr) {
    for (const play of drive.plays ?? []) allPlays.push(play);
  }

  let idx = 0;
  for (const play of allPlays) {
    const text: string = play.text ?? play.description ?? "";
    if (!text) continue;

    if (!abbrevs.some((ab) => text.includes(ab))) continue;

    const typeText = (play.type?.text ?? play.type?.name ?? "").toLowerCase();
    const yards: number = play.statYardage ?? play.yards ?? parseYardsFromText(text);
    const quarter = Math.max(1, Math.min(4, play.period?.number ?? 1)) as 1 | 2 | 3 | 4;
    const down = Math.max(1, Math.min(4, play.start?.down ?? 1)) as 1 | 2 | 3 | 4;
    const distance: number = play.start?.distance ?? 10;
    const isTD = play.scoringPlay || /touchdown/i.test(text);
    const isTurnover = play.isTurnover;

    const isRush = typeText === "rush" || /\brushes\b/i.test(text);
    const isPass = !isRush && (typeText === "pass" || /\bpass\b/i.test(text));

    if (isRush) {
      rushing.push({
        id: `${eventId}-r${idx}`,
        angle: parseRushAngle(text),
        yards,
        down,
        distance,
        result: isTD ? "td" : isTurnover ? "fumble" : yards < 0 ? "loss" : "gain",
        quarter,
        week,
        isLong: yards >= 15,
      });
    } else if (isPass) {
      const isIncomplete = /incomplete|broken up|deflect/i.test(text);
      const isInt = isTurnover || /intercepted/i.test(text);
      const actualYards = isIncomplete || isInt ? 0 : Math.abs(yards);
      const { side, depth, routeType } = parseReceivingInfo(text, actualYards);

      receiving.push({
        id: `${eventId}-c${idx}`,
        type: routeType,
        depth,
        result: isInt ? "int" : isIncomplete ? "incomplete" : isTD ? "td" : "catch",
        side,
        yards: actualYards,
        quarter,
        week,
        isLong: actualYards >= 15,
      });
    }

    idx++;
  }

  return { rushing, receiving };
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function fetchAllPlayerPlays(
  teamId: string,
  playerName: string,
  season = "2025"
): Promise<{ rushing: RushingPlay[]; receiving: ReceivingRoute[]; gamesFound: number }> {
  const games = await getTeamGameIds(teamId, season);
  if (!games.length) return { rushing: [], receiving: [], gamesFound: 0 };

  const results = await Promise.allSettled(
    games.map(({ eventId, week }) => extractPlaysFromGame(eventId, playerName, week))
  );

  const rushing: RushingPlay[] = [];
  const receiving: ReceivingRoute[] = [];
  let gamesFound = 0;

  for (const r of results) {
    if (r.status === "fulfilled") {
      rushing.push(...r.value.rushing);
      receiving.push(...r.value.receiving);
      if (r.value.rushing.length + r.value.receiving.length > 0) gamesFound++;
    }
  }

  return { rushing, receiving, gamesFound };
}
