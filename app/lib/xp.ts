// ─── XP & Gamification System ──────────────────────────────────────────────────
// Shared helper for levels, badges, and XP calculations.

import { supabase } from "./supabase";

// ─── Levels ──────────────────────────────────────────────────────────────────

export interface Level {
  name: string;
  minXp: number;
  maxXp: number; // exclusive; Infinity for top tier
  color: string;
}

export const LEVELS: Level[] = [
  { name: "Rookie", minXp: 0, maxXp: 1000, color: "#cd7f32" },        // Bronze
  { name: "Athlete", minXp: 1000, maxXp: 3000, color: "#c0c0c0" },    // Silver
  { name: "Competitor", minXp: 3000, maxXp: 7000, color: "#facc15" }, // Gold
  { name: "Champion", minXp: 7000, maxXp: 14000, color: "#22c55e" },  // Emerald
  { name: "Professional", minXp: 14000, maxXp: 25000, color: "#3b82f6" }, // Sapphire
  { name: "Elite", minXp: 25000, maxXp: Infinity, color: "#a855f7" }, // Amethyst
];

export const getLevel = (xp: number): Level => {
  return (
    LEVELS.find((l) => xp >= l.minXp && xp < l.maxXp) || LEVELS[LEVELS.length - 1]
  );
};

// Progress (0–1) through the current level toward the next.
export const getLevelProgress = (xp: number): number => {
  const level = getLevel(xp);
  if (level.maxXp === Infinity) return 1;
  const span = level.maxXp - level.minXp;
  return Math.min(Math.max((xp - level.minXp) / span, 0), 1);
};

// XP remaining to reach the next level (0 if at max).
export const xpToNextLevel = (xp: number): number => {
  const level = getLevel(xp);
  if (level.maxXp === Infinity) return 0;
  return level.maxXp - xp;
};

// ─── XP award constants ────────────────────────────────────────────────────────

export const XP_WORKOUT_COMPLETE = 100;
export const XP_PLAN_COMPLETE = 500;
export const XP_STREAK_7 = 200;
export const XP_STREAK_30 = 750;
export const XP_STREAK_100 = 2000;

export const DEFAULT_SET_MINUTES = 5; // fallback when no time hint present

// ─── Badges ──────────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string; // MaterialCommunityIcons name
}

export const BADGES: Badge[] = [
  { id: "first_workout", label: "First Workout", description: "Complete your first workout", icon: "flag-checkered" },
  { id: "streak_7", label: "7-Day Streak", description: "Work out 7 days in a row", icon: "fire" },
  { id: "streak_30", label: "30-Day Streak", description: "Work out 30 days in a row", icon: "fire" },
  { id: "streak_100", label: "100-Day Streak", description: "Work out 100 days in a row", icon: "trophy" },
  { id: "first_plan", label: "First Plan Complete", description: "Finish a full 7-day plan", icon: "check-decagram" },
  { id: "workouts_10", label: "10 Workouts", description: "Complete 10 total workouts", icon: "dumbbell" },
  { id: "workouts_25", label: "25 Workouts", description: "Complete 25 total workouts", icon: "dumbbell" },
  { id: "workouts_50", label: "50 Workouts", description: "Complete 50 total workouts", icon: "medal" },
];

export const getBadge = (id: string): Badge | undefined =>
  BADGES.find((b) => b.id === id);

// ─── Skip-penalty time estimation ──────────────────────────────────────────────

// Estimate an exercise's duration in minutes from its notes/detail string.
// Falls back to DEFAULT_SET_MINUTES per set when no explicit time hint exists.
export const estimateExerciseMinutes = (
  notes: string,
  numSets: number
): number => {
  if (notes) {
    // explicit time hint, e.g. "45 seconds", "3 min"
    const timeMatch = notes.match(/(\d+)\s*(sec|s\b|min|minute|seconds|minutes)/i);
    if (timeMatch) {
      const num = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      const perSetMinutes = unit.startsWith("min") ? num : num / 60;
      const sets = Math.max(numSets, 1);
      return perSetMinutes * sets;
    }
  }
  // fallback: default minutes per set
  return DEFAULT_SET_MINUTES * Math.max(numSets, 1);
};

// ─── XP calculation for a completed workout ────────────────────────────────────

export interface ExerciseTimeInfo {
  minutes: number;
  skipped: boolean;
}

// Returns net XP earned for a workout after skip deductions.
// Deduction per skipped exercise = (exerciseMinutes / totalMinutes) * XP_WORKOUT_COMPLETE
export const calcWorkoutXp = (exercises: ExerciseTimeInfo[]): number => {
  const totalMinutes = exercises.reduce((acc, e) => acc + e.minutes, 0);
  if (totalMinutes <= 0) return XP_WORKOUT_COMPLETE;

  let deduction = 0;
  for (const ex of exercises) {
    if (ex.skipped) {
      deduction += (ex.minutes / totalMinutes) * XP_WORKOUT_COMPLETE;
    }
  }
  const earned = XP_WORKOUT_COMPLETE - deduction;
  return Math.max(Math.round(earned), 0);
};

// ─── Award XP + badges (writes to Supabase) ────────────────────────────────────

export interface AwardResult {
  newXp: number;
  xpGained: number;
  newBadges: Badge[];
  leveledUp: boolean;
  oldLevel: Level;
  newLevel: Level;
}

interface AwardOptions {
  userId: string;
  workoutXp: number;
  planCompleted: boolean;
  currentStreak: number;
  totalWorkouts: number; // including the one just completed
}

export const awardXpAndBadges = async (
  opts: AwardOptions
): Promise<AwardResult | null> => {
  const { userId, workoutXp, planCompleted, currentStreak, totalWorkouts } = opts;

  // Fetch current xp + badges
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp, badges")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return null;

  const oldXp = profile.xp || 0;

  // Normalize badges to a real string array. Supabase may return the column as:
  //   • a JS array           → ["first_workout", ...]
  //   • a JSON array string  → "[\"first_workout\", ...]"
  //   • a Postgres literal    → "{first_workout,...}"
  // Handle all three so merges/filters work correctly.
  const parseBadges = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (typeof raw === "string") {
      const s = raw.trim();
      if (s === "" || s === "{}" || s === "[]") return [];
      // JSON array string
      if (s.startsWith("[")) {
        try {
          const arr = JSON.parse(s);
          if (Array.isArray(arr)) return arr.filter(Boolean);
        } catch {
          // fall through
        }
      }
      // Postgres array literal {a,b,c}
      return s
        .replace(/^\{|\}$/g, "")
        .split(",")
        .map((x) => x.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
    }
    return [];
  };
  const existingBadges: string[] = parseBadges(profile.badges);
  const oldLevel = getLevel(oldXp);

  // ── Tally XP ──
  let xpGained = workoutXp;
  if (planCompleted) xpGained += XP_PLAN_COMPLETE;
  if (currentStreak === 7) xpGained += XP_STREAK_7;
  if (currentStreak === 30) xpGained += XP_STREAK_30;
  if (currentStreak === 100) xpGained += XP_STREAK_100;

  const newXp = oldXp + xpGained;
  const newLevel = getLevel(newXp);

  // ── Determine newly earned badges ──
  const earnedNow: string[] = [];
  const award = (id: string) => {
    if (!existingBadges.includes(id) && !earnedNow.includes(id)) {
      earnedNow.push(id);
    }
  };

  if (totalWorkouts >= 1) award("first_workout");
  if (totalWorkouts >= 10) award("workouts_10");
  if (totalWorkouts >= 25) award("workouts_25");
  if (totalWorkouts >= 50) award("workouts_50");
  if (currentStreak >= 7) award("streak_7");
  if (currentStreak >= 30) award("streak_30");
  if (currentStreak >= 100) award("streak_100");
  if (planCompleted) award("first_plan");

  // Merge and dedupe, keeping only valid known badge IDs
  const validIds = new Set(BADGES.map((b) => b.id));
  const updatedBadges = [...new Set([...existingBadges, ...earnedNow])].filter(
    (id) => validIds.has(id)
  );

  // ── Persist ──
  await supabase
    .from("profiles")
    .update({ xp: newXp, badges: updatedBadges })
    .eq("id", userId);

  return {
    newXp,
    xpGained,
    newBadges: earnedNow.map((id) => getBadge(id)!).filter(Boolean),
    leveledUp: newLevel.name !== oldLevel.name,
    oldLevel,
    newLevel,
  };
};

// ─── Percentiles ───────────────────────────────────────────────────────────────

export interface Percentiles {
  ageLow: number | null;
  ageHigh: number | null;
  xpGroup: number | null;     // percentile within age group (0–100)
  xpOverall: number | null;   // percentile across all users
  duprGroup: number | null;
  duprOverall: number | null;
}

// Converts a "percentile at or above" value into a "top X%" display number.
// e.g. percentile 88 → top 12%. Clamped to a minimum of 1%.
export const toTopPercent = (percentile: number | null): number | null => {
  if (percentile == null) return null;
  const top = 100 - percentile;
  return Math.max(top, 1);
};

export const fetchPercentiles = async (
  userId: string
): Promise<Percentiles | null> => {
  const { data, error } = await supabase.rpc("get_user_percentiles", {
    target_user_id: userId,
  });
  if (error || !data) return null;

  return {
    ageLow: data.age_low ?? null,
    ageHigh: data.age_high ?? null,
    xpGroup: data.xp_percentile_group ?? null,
    xpOverall: data.xp_percentile_overall ?? null,
    duprGroup: data.dupr_percentile_group ?? null,
    duprOverall: data.dupr_percentile_overall ?? null,
  };
};