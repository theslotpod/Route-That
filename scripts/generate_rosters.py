"""
generate_rosters.py — Pull NFL 2025 depth charts and create nfl_rosters.json
Usage: python scripts/generate_rosters.py
"""

import json
import os
import nfl_data_py as nfl
import numpy as np

# Full team name mapping
TEAM_NAMES = {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs", "LA": "Los Angeles Rams", "LAC": "Los Angeles Chargers",
    "LV": "Las Vegas Raiders", "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings",
    "NE": "New England Patriots", "NO": "New Orleans Saints", "NYG": "New York Giants",
    "NYJ": "New York Jets", "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers",
    "SEA": "Seattle Seahawks", "SF": "San Francisco 49ers", "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans", "WAS": "Washington Commanders",
}


PX_PER_YARD = 7  # Must match constants.js

# Position average forty times (from 2015-2025 combine data)
# Used as fallback when a player has no combine record
POS_AVG_FORTY = {
    "WR": 4.50, "CB": 4.48, "RB": 4.55, "S": 4.54, "FS": 4.54, "SS": 4.54,
    "TE": 4.74, "LB": 4.64, "ILB": 4.75, "OLB": 4.69, "MLB": 4.64,
    "EDGE": 4.67, "DE": 4.82, "DT": 5.10, "NT": 5.10,
    "OT": 5.20, "OG": 5.27, "C": 5.20, "QB": 4.79,
    "LT": 5.20, "LG": 5.27, "RG": 5.27, "RT": 5.20,
    "LDE": 4.82, "RDE": 4.82, "LDT": 5.10, "RDT": 5.10,
    "SLB": 4.69, "WLB": 4.69, "LILB": 4.75, "RILB": 4.75,
    "LCB": 4.48, "RCB": 4.48, "NB": 4.48, "FB": 4.75,
}

# Our game slot → position category for forty lookup
SLOT_TO_POS = {
    "QB": "QB", "WR1": "WR", "WR2": "WR", "WR3": "WR",
    "TE": "TE", "RB": "RB",
    "LT": "OT", "LG": "OG", "C": "C", "RG": "OG", "RT": "OT",
    "DE1": "DE", "DE2": "DE", "DT1": "DT", "DT2": "DT",
}


def forty_to_speed(forty_time):
    """Convert 40-yard dash time to game speed in px/ms.

    Formula: speed = PX_PER_YARD * 40 / (forty * 1000) * GAME_SCALE
    GAME_SCALE of 0.95 accounts for pads/cuts vs combine sprints.
    """
    return round(PX_PER_YARD * 40 / (forty_time * 1000) * 0.95, 4)


def build_combine_lookup():
    """Build a name→speed lookup from NFL combine data (2015-2025)."""
    print("Fetching combine data (2015-2025) for player speeds...")
    years = list(range(2015, 2026))
    cb = nfl.import_combine_data(years)
    cb_with_forty = cb[cb["forty"].notna()].copy()
    print(f"  Combine entries with forty: {len(cb_with_forty)}")

    # Build lookup: player_name → speed (px/ms), keep fastest if duplicates
    lookup = {}
    for _, row in cb_with_forty.iterrows():
        name = row["player_name"]
        forty = float(row["forty"])
        speed = forty_to_speed(forty)
        # Keep the entry (prefer faster / more recent)
        if name not in lookup or speed > lookup[name]["speed"]:
            lookup[name] = {"speed": speed, "forty": round(forty, 2)}

    print(f"  Unique players in combine lookup: {len(lookup)}")
    return lookup


def build_rosters(combine_lookup=None):
    print("Fetching 2025 depth charts...")
    dc = nfl.import_depth_charts([2025])

    # 2025 format: columns are [dt, team, player_name, espn_id, gsis_id,
    #   pos_grp_id, pos_grp, pos_id, pos_name, pos_abb, pos_slot, pos_rank]
    # pos_rank == 1 means starter, pos_abb is the position abbreviation

    # Use latest timestamp only, deduplicate
    latest_dt = dc["dt"].max()
    print(f"Using data from {latest_dt}")
    dc = dc[dc["dt"] == latest_dt]

    # Filter to starters (pos_rank == 1)
    # Exception: WR has multiple starter slots (X/Z/slot), so top 3 by rank are all starters
    starters = dc[dc["pos_rank"] == 1].copy()
    # Also grab WR rank 2 and 3 for WR2/WR3
    wr_extras = dc[(dc["pos_abb"] == "WR") & (dc["pos_rank"].isin([2, 3]))].copy()
    all_data = dc.copy()  # keep full dataset for WR lookup
    print(f"Total starter rows: {len(starters)}")
    print(f"Teams: {sorted(starters['team'].unique())}")

    # Position mapping from ESPN abbreviations to our game slots
    # Offense
    OFF_POS_MAP = {
        "QB": ["QB"],
        "WR": ["WR"],
        "TE": ["TE"],
        "RB": ["RB", "FB"],
        "LT": ["LT"],
        "LG": ["LG"],
        "C": ["C"],
        "RG": ["RG"],
        "RT": ["RT"],
    }
    # Defense: DL positions
    DE_POSITIONS = ["LDE", "RDE"]
    DT_POSITIONS = ["LDT", "RDT", "NT"]
    # Secondary
    LB_POSITIONS = ["MLB", "SLB", "WLB", "LILB", "RILB"]
    CB_POSITIONS = ["LCB", "RCB", "NB"]
    S_POSITIONS = ["SS", "FS"]

    def get_speed(player_name, pos_abb, game_slot=None):
        """Get speed for a player: combine lookup → position average fallback."""
        if combine_lookup and player_name in combine_lookup:
            return combine_lookup[player_name]["speed"]
        # Fallback: position average
        fallback_pos = SLOT_TO_POS.get(game_slot, pos_abb) if game_slot else pos_abb
        avg_forty = POS_AVG_FORTY.get(fallback_pos, POS_AVG_FORTY.get(pos_abb, 4.60))
        return forty_to_speed(avg_forty)

    rosters = {}
    teams_list = []
    matched_count = 0
    total_count = 0

    for team_abbr in sorted(starters["team"].unique()):
        team_data = starters[starters["team"] == team_abbr]
        team_name = TEAM_NAMES.get(team_abbr, team_abbr)

        offense = {}
        defense = {}

        # --- OFFENSE ---
        # QB
        qbs = team_data[team_data["pos_abb"] == "QB"].head(1)
        if len(qbs) > 0:
            name = qbs.iloc[0]["player_name"]
            spd = get_speed(name, "QB", "QB")
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            offense["QB"] = {"name": name, "num": 0, "speed": spd}

        # WR (top 3 by pos_rank across all slots)
        team_all_wrs = all_data[(all_data["team"] == team_abbr) & (all_data["pos_abb"] == "WR")]
        wrs = team_all_wrs.sort_values("pos_rank").head(3)
        for i, (_, row) in enumerate(wrs.iterrows()):
            name = row["player_name"]
            spd = get_speed(name, "WR", f"WR{i+1}")
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            offense[f"WR{i+1}"] = {"name": name, "num": 0, "speed": spd}

        # TE
        tes = team_data[team_data["pos_abb"] == "TE"].head(1)
        if len(tes) > 0:
            name = tes.iloc[0]["player_name"]
            spd = get_speed(name, "TE", "TE")
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            offense["TE"] = {"name": name, "num": 0, "speed": spd}

        # RB
        rbs = team_data[team_data["pos_abb"].isin(["RB", "FB"])].head(1)
        if len(rbs) > 0:
            name = rbs.iloc[0]["player_name"]
            spd = get_speed(name, rbs.iloc[0]["pos_abb"], "RB")
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            offense["RB"] = {"name": name, "num": 0, "speed": spd}

        # OL
        for ol_pos in ["LT", "LG", "C", "RG", "RT"]:
            ol_rows = team_data[team_data["pos_abb"] == ol_pos].head(1)
            if len(ol_rows) > 0:
                name = ol_rows.iloc[0]["player_name"]
                spd = get_speed(name, ol_pos, ol_pos)
                total_count += 1
                if combine_lookup and name in combine_lookup: matched_count += 1
                offense[ol_pos] = {"name": name, "num": 0, "speed": spd}

        # --- DEFENSE ---
        # DE (top 2) — LDE + RDE
        des = team_data[team_data["pos_abb"].isin(DE_POSITIONS)].sort_values("pos_slot").head(2)
        for i, (_, row) in enumerate(des.iterrows()):
            name = row["player_name"]
            spd = get_speed(name, row["pos_abb"], f"DE{i+1}")
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            defense[f"DE{i+1}"] = {"name": name, "num": 0, "speed": spd}

        # DT (top 2) — LDT + RDT + NT
        dts = team_data[team_data["pos_abb"].isin(DT_POSITIONS)].sort_values("pos_slot").head(2)
        for i, (_, row) in enumerate(dts.iterrows()):
            name = row["player_name"]
            spd = get_speed(name, row["pos_abb"], f"DT{i+1}")
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            defense[f"DT{i+1}"] = {"name": name, "num": 0, "speed": spd}

        # Secondary: LB (top 3) + CB (top 2) + S (top 2) → D1-D7
        secondary_slots = []

        lbs = team_data[team_data["pos_abb"].isin(LB_POSITIONS)].sort_values("pos_slot").head(3)
        for _, row in lbs.iterrows():
            name = row["player_name"]
            spd = get_speed(name, row["pos_abb"])
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            secondary_slots.append({"name": name, "num": 0, "type": "lb", "speed": spd})

        cbs = team_data[team_data["pos_abb"].isin(CB_POSITIONS)].sort_values("pos_slot").head(2)
        for _, row in cbs.iterrows():
            name = row["player_name"]
            spd = get_speed(name, row["pos_abb"])
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            secondary_slots.append({"name": name, "num": 0, "type": "cb", "speed": spd})

        ss = team_data[team_data["pos_abb"].isin(S_POSITIONS)].sort_values("pos_slot").head(2)
        for _, row in ss.iterrows():
            name = row["player_name"]
            spd = get_speed(name, row["pos_abb"])
            total_count += 1
            if combine_lookup and name in combine_lookup: matched_count += 1
            secondary_slots.append({"name": name, "num": 0, "type": "s", "speed": spd})

        for i, slot in enumerate(secondary_slots[:7]):
            defense[f"D{i+1}"] = slot

        rosters[team_abbr] = {
            "name": team_name,
            "offense": offense,
            "defense": defense,
        }
        teams_list.append({"abbr": team_abbr, "name": team_name})

    output = {"teams": teams_list, **rosters}

    out_path = os.path.join(os.path.dirname(__file__), "..", "public", "nfl_rosters.json")
    out_path = os.path.normpath(out_path)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(teams_list)} teams to {out_path}")
    if combine_lookup:
        print(f"  Speed data: {matched_count}/{total_count} players matched to combine ({100*matched_count/max(total_count,1):.0f}%)")

    # Quick validation
    for t in teams_list[:3]:
        abbr = t["abbr"]
        off_count = len(rosters[abbr]["offense"])
        def_count = len(rosters[abbr]["defense"])
        print(f"  {abbr}: {off_count} offense, {def_count} defense slots")

    return output


def build_tendencies():
    """Extract defensive tendencies from 2025 play-by-play data."""
    print("Fetching 2025 play-by-play data for defensive tendencies...")
    pbp = nfl.import_pbp_data([2025])
    print(f"  Total PBP rows: {len(pbp)}")

    # Filter to pass plays with a defensive team
    pass_plays = pbp[pbp["play_type"] == "pass"].copy()
    pass_plays = pass_plays[pass_plays["defteam"].notna()]
    print(f"  Pass plays: {len(pass_plays)}")

    # PBP coverage values → game keys
    COVERAGE_MAP = {
        "COVER_0": "cover0",
        "COVER_1": "cover1",
        "COVER_2": "cover2",
        "COVER_3": "cover3",
        "COVER_4": "cover4",
        "COVER_6": "cover6",
        "2_MAN": "2man",
    }

    tendencies = {}

    for team in sorted(pass_plays["defteam"].unique()):
        team_plays = pass_plays[pass_plays["defteam"] == team]

        # --- Coverage distribution ---
        cov_col = "defense_coverage_type" if "defense_coverage_type" in team_plays.columns else None
        coverage_dist = {}
        if cov_col:
            cov_counts = team_plays[cov_col].dropna().value_counts()
            total_cov = cov_counts.sum()
            if total_cov > 0:
                for pbp_val, game_key in COVERAGE_MAP.items():
                    count = cov_counts.get(pbp_val, 0)
                    coverage_dist[game_key] = round(count / total_cov, 3)

                # Redistribute COVER_9, COMBO, and any unmapped into existing keys proportionally
                mapped_sum = sum(coverage_dist.values())
                if mapped_sum > 0 and mapped_sum < 1.0:
                    scale = 1.0 / mapped_sum
                    coverage_dist = {k: round(v * scale, 3) for k, v in coverage_dist.items()}

        # If no coverage data, use league average
        if not coverage_dist or sum(coverage_dist.values()) == 0:
            coverage_dist = {
                "cover0": 0.04, "cover1": 0.20, "cover2": 0.22,
                "cover3": 0.28, "cover4": 0.12, "cover6": 0.06, "2man": 0.08
            }

        # Ensure all keys exist
        for key in ["cover0", "cover1", "cover2", "cover3", "cover4", "cover6", "2man"]:
            coverage_dist.setdefault(key, 0.0)

        # Normalize to exactly 1.0
        total = sum(coverage_dist.values())
        if total > 0:
            coverage_dist = {k: round(v / total, 3) for k, v in coverage_dist.items()}

        # --- Blitz rate (was_pressure) ---
        blitz_rate = 0.133  # league avg default
        if "was_pressure" in team_plays.columns:
            pressure_vals = team_plays["was_pressure"].dropna()
            if len(pressure_vals) > 0:
                blitz_rate = round(float(pressure_vals.mean()), 3)

        # --- Average pass rushers ---
        avg_rushers = 4.3
        if "number_of_pass_rushers" in team_plays.columns:
            rusher_vals = team_plays["number_of_pass_rushers"].dropna()
            if len(rusher_vals) > 0:
                avg_rushers = round(float(rusher_vals.mean()), 1)

        # --- Average defenders in box ---
        avg_box = 5.1
        if "defenders_in_box" in team_plays.columns:
            box_vals = team_plays["defenders_in_box"].dropna()
            if len(box_vals) > 0:
                avg_box = round(float(box_vals.mean()), 1)

        tendencies[team] = {
            "coverage": coverage_dist,
            "blitzRate": blitz_rate,
            "avgRushers": avg_rushers,
            "avgDefendersInBox": avg_box,
        }
        print(f"  {team}: blitz={blitz_rate}, rushers={avg_rushers}, box={avg_box}, coverages={coverage_dist}")

    return tendencies


if __name__ == "__main__":
    combine_lookup = build_combine_lookup()
    rosters_data = build_rosters(combine_lookup)
    tendencies_data = build_tendencies()

    # Merge tendencies into roster data
    out_path = os.path.join(os.path.dirname(__file__), "..", "public", "nfl_rosters.json")
    out_path = os.path.normpath(out_path)
    with open(out_path, "r") as f:
        output = json.load(f)

    for team_abbr in tendencies_data:
        if team_abbr in output:
            output[team_abbr]["tendencies"] = tendencies_data[team_abbr]

    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Merged tendencies into {out_path}")
