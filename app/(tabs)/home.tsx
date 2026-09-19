import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";
import { getLevel, getLevelProgress, xpToNextLevel } from "../lib/xp";
import LogMatchModal from "../LogMatchModal";

// ─── Week strip day type ──────────────────────────────────────────────────────

interface WeekDay {
  dayNumber: number;
  theme: string;
  primarySession: string;
  isToday: boolean;
  isPast: boolean;
  fullText: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TodaySession {
  type: string;
  items: string[];
}

interface TodayPlan {
  dayNumber: number;
  theme: string;
  sessions: TodaySession[];
  totalItems: number;
  isRestDay: boolean;
}

// ─── Shared parsing helpers ───────────────────────────────────────────────────

const SESSION_TYPE_KEYS = [
  "warmup",
  "workout",
  "pickleball skill work",
  "cooldown",
  "fitness",
  "rest",
  "active recovery",
];

const SESSION_LABELS: Record<string, string> = {
  warmup: "Warmup",
  workout: "Workout",
  "pickleball skill work": "Pickleball Skill Work",
  cooldown: "Cooldown",
  fitness: "Fitness",
  rest: "Rest",
  "active recovery": "Active Recovery",
};

// ─── Session icon renderer ────────────────────────────────────────────────────

const renderSessionIcon = (sessionType: string, size = 14) => {
  switch (sessionType) {
    case "warmup":                return <MaterialCommunityIcons name="fire" size={size} color="#f97316" />;
    case "workout":               return <MaterialCommunityIcons name="dumbbell" size={size} color="#22c55e" />;
    case "pickleball skill work": return <MaterialCommunityIcons name="tennis" size={size} color="#22c55e" />;
    case "cooldown":              return <MaterialCommunityIcons name="snowflake" size={size} color="#60a5fa" />;
    case "fitness":               return <MaterialCommunityIcons name="lightning-bolt" size={size} color="#facc15" />;
    case "rest":                  return <MaterialCommunityIcons name="sleep" size={size} color="#a78bfa" />;
    case "active recovery":       return <MaterialCommunityIcons name="leaf" size={size} color="#34d399" />;
    default:                      return <MaterialCommunityIcons name="circle-small" size={size} color="#22c55e" />;
  }
};

const stripBold = (t: string) => t.replace(/\*\*/g, "").trim();

const detectSessionType = (line: string): string | null => {
  const lower = line.toLowerCase().replace(/[:\*]/g, "").trim();
  return SESSION_TYPE_KEYS.find((k) => lower.startsWith(k)) || null;
};

const splitPlanIntoDays = (planText: string): string[] => {
  const firstDayIdx = planText.search(/Day\s+1\s*:/i);
  const trimmed = firstDayIdx >= 0 ? planText.slice(firstDayIdx) : planText;
  return trimmed
    .replace(/^---+$/gm, "")
    .split(/(?=Day\s+\d+\s*:)/gi)
    .map((d) => d.trim())
    .filter(Boolean);
};

const parseTodayPlan = (dayText: string, dayNumber: number): TodayPlan => {
  const lines = dayText.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleLine = stripBold(lines[0] || "");
  const colonIdx = titleLine.indexOf(":");
  const theme = colonIdx !== -1 ? titleLine.slice(colonIdx + 1).trim() : "";

  const sessions: TodaySession[] = [];
  let currentSession: TodaySession | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const sessionType = detectSessionType(line);
    if (sessionType) {
      if (currentSession) sessions.push(currentSession);
      currentSession = { type: sessionType, items: [] };
    } else if (
      currentSession &&
      (line.startsWith("-") || line.startsWith("•") || line.startsWith("*"))
    ) {
      const cleaned = stripBold(line).replace(/^[-•*]\s*/, "").trim();
      const name = cleaned.split(":")[0].split(" — ")[0].trim() || cleaned;
      if (name) currentSession.items.push(name);
    }
  }
  if (currentSession) sessions.push(currentSession);

  const workSessions = sessions.filter(
    (s) => s.type !== "warmup" && s.type !== "cooldown"
  );
  const totalItems = workSessions.reduce((acc, s) => acc + s.items.length, 0);

  // A rest day: theme mentions rest/recovery, or there are no real work items
  const themeLower = theme.toLowerCase();
  const themeIsRest =
    themeLower.includes("rest") || themeLower.includes("recovery");
  const onlyRestSessions = workSessions.every(
    (s) => s.type === "rest" || s.type === "active recovery"
  );
  const isRestDay = themeIsRest || totalItems === 0 || onlyRestSessions;

  return { dayNumber, theme, sessions, totalItems, isRestDay };
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

// Darken a hex color by a factor (0–1) — used to build a gradient that fades
// from a deeper shade of the tier color up to the tier color itself.
const darkenHex = (hex: string, factor = 0.55): string => {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// ─── Week Strip ───────────────────────────────────────────────────────────────

function WeekStrip({ days, onDayPress }: { days: WeekDay[]; onDayPress: (day: WeekDay) => void }) {
  return (
    <View style={styles.weekStripWrapper}>
      <Text style={styles.sectionLabel}>This Week</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekStripScroll}
      >
        {days.map((day) => (
          <Pressable
            key={day.dayNumber}
            onPress={() => onDayPress(day)}
            style={[
              styles.weekDayCard,
              day.isToday && styles.weekDayCardToday,
              day.isPast && styles.weekDayCardPast,
            ]}
          >
            <Text
              style={[
                styles.weekDayNum,
                day.isToday && styles.weekDayNumToday,
                day.isPast && styles.weekDayNumPast,
              ]}
            >
              {day.dayNumber}
            </Text>

            <View style={styles.weekDayIcon}>
              {day.isPast ? (
                <MaterialCommunityIcons name="check-circle" size={22} color="#4ade80" />
              ) : (
                renderSessionIcon(day.primarySession, 22)
              )}
            </View>

            <Text
              style={[
                styles.weekDayTheme,
                day.isToday && styles.weekDayThemeToday,
              ]}
              numberOfLines={2}
            >
              {day.theme || `Day ${day.dayNumber}`}
            </Text>

            {day.isToday && (
              <View style={styles.todayPill}>
                <Text style={styles.todayPillText}>Today</Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TodayCard({
  today,
  onStart,
  completedToday,
  canSwap,
  onSwap,
}: {
  today: TodayPlan;
  onStart: () => void;
  completedToday: boolean;
  canSwap: boolean;
  onSwap: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const workSessions = today.sessions.filter(
    (s) => s.type !== "warmup" && s.type !== "cooldown"
  );

  const allItems = workSessions.flatMap((s) => s.items);
  const previewItems = allItems.slice(0, 3);
  const remainingItems = allItems.slice(3);

  return (
    <LinearGradient
      colors={["#1f2a20", "#161616"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.todayCard}
    >
      <View style={styles.todayCardHeader}>
        <Text style={styles.todayLabel}>Day {today.dayNumber} · {completedToday ? "Completed" : "Today"}</Text>
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>{today.dayNumber}/7</Text>
        </View>
      </View>

      <Text style={styles.todayTheme}>{today.theme || "Training Day"}</Text>

      <View style={styles.sessionChips}>
        {workSessions.slice(0, 3).map((s, i) => (
          <View key={i} style={styles.sessionChip}>
            {renderSessionIcon(s.type, 12)}
            <Text style={styles.sessionChipText}>
              {SESSION_LABELS[s.type] || s.type}
            </Text>
          </View>
        ))}
      </View>

      {previewItems.map((item, i) => (
        <View key={i} style={styles.previewItem}>
          <View style={styles.previewDot} />
          <Text style={styles.previewText} numberOfLines={1}>{item}</Text>
        </View>
      ))}

      {expanded && remainingItems.map((item, i) => (
        <View key={`expanded-${i}`} style={styles.previewItem}>
          <View style={styles.previewDot} />
          <Text style={styles.previewText} numberOfLines={1}>{item}</Text>
        </View>
      ))}

      {remainingItems.length > 0 && (
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.moreBtn}>
          <Text style={styles.moreText}>
            {expanded ? "Show less" : `+${remainingItems.length} more exercises`}
          </Text>
        </Pressable>
      )}

      {completedToday ? (
        <View style={styles.completedTodayRow}>
          <Text style={styles.completedTodayText}>✓ Today's workout done</Text>
        </View>
      ) : (
        <>
          <Pressable onPress={onStart} style={styles.startBtnWrap}>
            <LinearGradient
              colors={["#4ade80", "#16a34a"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.startBtn}
            >
              <Text style={styles.startBtnText}>Start Workout</Text>
            </LinearGradient>
          </Pressable>

          {canSwap && (
            <Pressable onPress={onSwap} style={styles.cantTrainBtn}>
              <Text style={styles.cantTrainText}>Can't train today? Swap with a rest day</Text>
            </Pressable>
          )}
        </>
      )}
    </LinearGradient>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { completedWorkout, duration } = useLocalSearchParams<{
    completedWorkout?: string;
    duration?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("there");
  const [today, setToday] = useState<TodayPlan | null>(null);
  const [todayDayText, setTodayDayText] = useState("");
  const [weekProgress, setWeekProgress] = useState({ completed: 0, total: 7 });
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [showCompletionBanner, setShowCompletionBanner] = useState(false);
  const [completedDuration, setCompletedDuration] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [currentPlanDay, setCurrentPlanDay] = useState(1);
  const [allDaysCompleted, setAllDaysCompleted] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [totalWorkoutsCompleted, setTotalWorkoutsCompleted] = useState(0);
  const [xp, setXp] = useState(0);
  const [adjustment, setAdjustment] = useState<{ day: number; reason: string }[] | null>(null);
  const [adjustmentModalVisible, setAdjustmentModalVisible] = useState(false);
  const [previewDay, setPreviewDay] = useState<WeekDay | null>(null);
  const [logMatchVisible, setLogMatchVisible] = useState(false);

  // ── Day-swap feature state ──
  const [rawPlan, setRawPlan] = useState("");                 // full current_plan text
  const [planCreatedAt, setPlanCreatedAt] = useState("");     // for date mapping
  const [restDayNumbers, setRestDayNumbers] = useState<number[]>([]); // which days are rest
  const [completedDayNums, setCompletedDayNums] = useState<number[]>([]); // locked days
  const [swapModalVisible, setSwapModalVisible] = useState(false);
  const [swapSourceDay, setSwapSourceDay] = useState<number | null>(null); // the workout day being moved
  const [swapping, setSwapping] = useState(false);
  const [swapConfirmation, setSwapConfirmation] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadHomeData();
      if (completedWorkout === "true") {
        setShowCompletionBanner(true);
        setCompletedDuration(parseInt(duration || "0"));
      }
    }, [completedWorkout, duration])
  );

  const loadHomeData = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("first_name, current_plan, plan_created_at, days_per_week, xp, last_adjustment")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (data) {
      setFirstName(data.first_name || "there");
      setXp(data.xp || 0);

      // Show the coach adjustment for the whole current plan cycle.
      // We tie it to the cycle by checking the adjustment was created at/after
      // the current plan started — so old adjustments don't linger after a new plan.
      const adj = data.last_adjustment;
      if (
        adj &&
        Array.isArray(adj.changedDays) &&
        adj.changedDays.length > 0 &&
        data.plan_created_at &&
        adj.created_at &&
        new Date(adj.created_at) >= new Date(data.plan_created_at)
      ) {
        setAdjustment(adj.changedDays);
      } else {
        setAdjustment(null);
      }

      if (data.current_plan && data.plan_created_at) {
        const allDays = splitPlanIntoDays(data.current_plan);
        setRawPlan(data.current_plan);
        setPlanCreatedAt(data.plan_created_at);

        // ── Current plan workouts (for week strip + Workouts This Week) ──
        const { data: completedWorkouts } = await supabase
          .from("workouts")
          .select("day_number")
          .eq("user_id", userData.user.id)
          .not("completed_at", "is", null)
          .gte("completed_at", new Date(data.plan_created_at).toISOString());

        const completedDayNumbers = new Set(
          (completedWorkouts || []).map((w) => w.day_number)
        );

        // ── All-time workouts (for Overall Day stat) ──
        const { data: allTimeWorkouts } = await supabase
          .from("workouts")
          .select("id")
          .eq("user_id", userData.user.id)
          .not("completed_at", "is", null);

        setTotalWorkoutsCompleted(allTimeWorkouts?.length || 0);

        // ── Which day (if any) was completed TODAY ──
        // Needed for Option B: a day finished today stays shown as "Completed"
        // until the calendar rolls over.
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: todayWorkouts } = await supabase
          .from("workouts")
          .select("day_number")
          .eq("user_id", userData.user.id)
          .not("completed_at", "is", null)
          .gte("completed_at", todayStart.toISOString());

        const completedTodayDayNumbers = (todayWorkouts || []).map((w) => w.day_number);
        const didCompleteToday = completedTodayDayNumbers.length > 0;
        setCompletedToday(didCompleteToday);

        // ── Option B day logic, now rest-aware ──
        // Walk the days in order and find the first one that isn't "cleared":
        //   • a WORKOUT day is cleared when it's been completed (never skips a
        //     missed workout — it waits for the user)
        //   • a REST day is cleared once its calendar date has fully passed
        //     (nothing to complete, so it advances on its own the next day)
        // EXCEPTION: if a workout was completed today, keep showing that day as
        // "Completed" until the calendar rolls over.
        const totalDays = allDays.length || 7;

        // Which day numbers are rest days (robust detection via parseTodayPlan).
        const restDaySet = new Set<number>();
        allDays.forEach((text, i) => {
          if (parseTodayPlan(text, i + 1).isRestDay) restDaySet.add(i + 1);
        });
        setRestDayNumbers([...restDaySet]);
        setCompletedDayNums([...completedDayNumbers]);

        // Has a given day's scheduled calendar date fully passed?
        // Day N is scheduled for plan_created_at + (N - 1) days.
        const planStart = new Date(data.plan_created_at);
        planStart.setHours(0, 0, 0, 0);
        const dayHasPassed = (dayNum: number): boolean => {
          const scheduled = new Date(planStart);
          scheduled.setDate(scheduled.getDate() + (dayNum - 1));
          return scheduled.getTime() < todayStart.getTime();
        };

        // Walk to the first uncleared day.
        let walkedDay = totalDays; // fallback: last day if everything is cleared
        for (let d = 1; d <= totalDays; d++) {
          const cleared = restDaySet.has(d)
            ? dayHasPassed(d)            // rest day → clears once its date passes
            : completedDayNumbers.has(d); // workout day → clears when completed
          if (!cleared) {
            walkedDay = d;
            break;
          }
        }

        let planDay: number;
        if (didCompleteToday) {
          // Keep showing the (highest) day completed today as "Completed".
          planDay = Math.max(...completedTodayDayNumbers);
        } else {
          planDay = walkedDay;
        }
        planDay = Math.min(Math.max(planDay, 1), totalDays);
        setCurrentPlanDay(planDay);

        const dayText = allDays[planDay - 1];
        if (dayText) {
          setToday(parseTodayPlan(dayText, planDay));
          setTodayDayText(dayText);
        }

        const parsedWeekDays: WeekDay[] = allDays.map((text, i) => {
          const dn = i + 1;
          const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
          const titleLine = stripBold(lines[0] || "");
          const colonIdx = titleLine.indexOf(":");
          const theme = colonIdx !== -1 ? titleLine.slice(colonIdx + 1).trim() : titleLine;

          const themeLower = theme.toLowerCase();
          let primarySession = "rest";
          if (themeLower.includes("rest") || themeLower.includes("recovery") || themeLower.includes("active recovery")) {
            primarySession = themeLower.includes("active recovery") ? "active recovery" : "rest";
          } else {
            for (const line of lines.slice(1)) {
              const type = detectSessionType(line);
              if (type && type !== "warmup" && type !== "cooldown") {
                primarySession = type;
                break;
              }
            }
          }

          // "Past" = the walk has moved beyond this day. That happens when a
          // workout day was completed OR a rest day's date has elapsed. We show
          // the green check for completed workouts; rest days that have passed
          // are also "past" but we keep their rest icon (handled in WeekStrip).
          const isRestDay = restDaySet.has(dn);
          const isPast = dn < planDay && (completedDayNumbers.has(dn) || isRestDay);

          return {
            dayNumber: dn,
            theme,
            primarySession,
            isToday: dn === planDay,
            isPast,
            fullText: text,
          };
        });
        setWeekDays(parsedWeekDays);

        // ── Count only trainable (non-rest) days for progress ──
        const trainableDayNumbers = new Set(
          parsedWeekDays
            .filter((d) => d.primarySession !== "rest" && d.primarySession !== "active recovery")
            .map((d) => d.dayNumber)
        );
        const totalTrainable = trainableDayNumbers.size || 1;

        // Only count completed days that are actually trainable
        const completedTrainable = [...completedDayNumbers].filter((dn) =>
          trainableDayNumbers.has(dn)
        ).length;

        // ── Workouts This Week matches the week strip (rest days excluded) ──
        setWeekProgress({ completed: completedTrainable, total: totalTrainable });

        // Week is "complete" only when all trainable days are done AND the full
        // cycle has actually elapsed. This prevents the "Week Complete" flag from
        // firing early when the last day(s) are rest days that haven't passed yet
        // (e.g. finishing Day 6's workout when Day 7 is a rest day).
        const allTrainableDone = completedTrainable >= totalTrainable;
        const finalDayPassed = dayHasPassed(totalDays); // last day's date is behind us
        setAllDaysCompleted(allTrainableDone && finalDayPassed);
      }
    }
    setLoading(false);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { data, error } = await supabase.functions.invoke("generate-plan", {
        body: { profile },
      });

      if (error || !data?.plan) throw new Error("Failed to generate plan");

      await supabase
        .from("profiles")
        .update({
          current_plan: data.plan,
          plan_created_at: new Date().toISOString(),
        })
        .eq("id", userData.user.id);

      setAllDaysCompleted(false);
      setShowCompletionBanner(false);
      await loadHomeData();
    } catch (e: any) {
      setRegenError("Something went wrong. Please try again.");
      console.error(e);
    } finally {
      setRegenerating(false);
    }
  };

  // Just closes the detail modal — the card stays visible all week.
  const closeAdjustmentModal = () => {
    setAdjustmentModalVisible(false);
  };

  // ── Day-swap feature ────────────────────────────────────────────────────────
  // Swap a workout day with an upcoming rest day. Contents trade slots; the day
  // NUMBER stays with the slot (Day 4's header stays "Day 4"), so all the
  // calendar/date logic keeps working unchanged.

  // Which upcoming rest days can a given workout day swap into?
  // Rules: only upcoming days (>= currentPlanDay), only rest days, not completed.
  const availableRestTargets = (): number[] =>
    restDayNumbers
      .filter((d) => d >= currentPlanDay)      // upcoming only
      .filter((d) => !completedDayNums.includes(d)); // not already done

  // Can this day offer a "swap" action? It must be an upcoming, non-completed
  // WORKOUT day (not a rest day), and there must be a rest day to swap with.
  const canSwapDay = (dayNum: number): boolean => {
    if (dayNum < currentPlanDay) return false;           // past
    if (completedDayNums.includes(dayNum)) return false; // done
    if (restDayNumbers.includes(dayNum)) return false;   // it's already a rest day
    return availableRestTargets().length > 0;            // a rest day exists to take
  };

  const openSwapModal = (workoutDay: number) => {
    setSwapSourceDay(workoutDay);
    setSwapModalVisible(true);
  };

  // Perform the swap: exchange the two day-chunks in the plan text, keeping each
  // slot's "Day N:" header number intact.
  const performSwap = async (workoutDay: number, restDay: number) => {
    setSwapping(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not logged in");

      // Split plan into chunks, each starting with "Day N:".
      const chunks = splitPlanIntoDays(rawPlan);
      // chunks[i] corresponds to day (i+1). Guard indexes.
      const wIdx = workoutDay - 1;
      const rIdx = restDay - 1;
      if (!chunks[wIdx] || !chunks[rIdx]) throw new Error("Day not found");

      // Strip the leading "Day N:" header from each chunk's BODY so we can
      // re-attach the correct slot number afterward.
      const stripHeader = (chunk: string): string => {
        const nl = chunk.indexOf("\n");
        return nl === -1 ? "" : chunk.slice(nl + 1);
      };
      const headerFor = (chunk: string): string => {
        const nl = chunk.indexOf("\n");
        const firstLine = nl === -1 ? chunk : chunk.slice(0, nl);
        // firstLine looks like "Day 2: Theme..." — keep the theme, we only swap bodies.
        return firstLine;
      };

      const wHeader = headerFor(chunks[wIdx]); // "Day 2: Pickleball..."
      const rHeader = headerFor(chunks[rIdx]); // "Day 4: Rest..."
      const wBody = stripHeader(chunks[wIdx]);
      const rBody = stripHeader(chunks[rIdx]);

      // Swap the HEADER TEXT (theme) + BODY together, but renumber to the slot.
      // Slot wIdx keeps "Day {workoutDay}" but now shows the REST content.
      // Slot rIdx keeps "Day {restDay}" but now shows the WORKOUT content.
      const renumber = (header: string, slotDay: number): string =>
        header.replace(/^Day\s+\d+/i, `Day ${slotDay}`);

      chunks[wIdx] = `${renumber(rHeader, workoutDay)}\n${rBody}`.trimEnd();
      chunks[rIdx] = `${renumber(wHeader, restDay)}\n${wBody}`.trimEnd();

      // Rebuild the plan text, preserving the "---" separators between days.
      const newPlan = chunks.join("\n\n---\n\n");

      const { error } = await supabase
        .from("profiles")
        .update({ current_plan: newPlan })
        .eq("id", userData.user.id);

      if (error) throw error;

      setSwapModalVisible(false);
      setPreviewDay(null);
      setSwapConfirmation(
        `Done — your workout moved to Day ${restDay}, and Day ${workoutDay} is now a rest day.`
      );
      await loadHomeData();
    } catch (e) {
      console.error("Swap failed:", e);
      setSwapConfirmation("Couldn't swap those days. Please try again.");
    } finally {
      setSwapping(false);
      setSwapSourceDay(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const progressPct = weekProgress.total > 0
    ? Math.round((weekProgress.completed / weekProgress.total) * 100)
    : 0;

  const level = getLevel(xp);
  const levelProgress = getLevelProgress(xp);
  const xpRemaining = xpToNextLevel(xp);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.greeting}>{getGreeting()},</Text>
      <Text style={styles.name}>{firstName}!</Text>
      <Text style={styles.subheading}>Ready to train?</Text>

      {/* ── Workout completion banner (hidden when week is done) ── */}
      {(showCompletionBanner || completedToday) && !allDaysCompleted && (
        <View style={styles.completionBanner}>
          <Text style={styles.completionBannerTitle}>Workout Complete! 🎉</Text>
          <Text style={styles.completionBannerSub}>
            {completedDuration > 0
              ? `You trained for ${Math.round(completedDuration / 60)} min. Great work!`
              : "You already crushed today's workout. Rest up!"}
          </Text>
        </View>
      )}

      {/* ── Week complete banner OR today's workout card ── */}
      {allDaysCompleted ? (
        <View style={styles.weekCompleteBanner}>
          <View style={styles.weekCompleteIconRow}>
            <MaterialCommunityIcons name="trophy" size={32} color="#facc15" />
          </View>
          <Text style={styles.weekCompleteTitle}>Week Complete! 🏆</Text>
          <Text style={styles.weekCompleteSub}>
            You crushed all 7 days. Your feedback has been logged — time to level up with a new plan.
          </Text>
          {regenError ? (
            <Text style={styles.regenError}>{regenError}</Text>
          ) : null}
          <Pressable
            style={[styles.regenBtn, regenerating && styles.regenBtnDisabled]}
            onPress={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <View style={styles.regenBtnInner}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.regenBtnText}>Generating your next plan...</Text>
              </View>
            ) : (
              <View style={styles.regenBtnInner}>
                <MaterialCommunityIcons name="refresh" size={18} color="#000" />
                <Text style={styles.regenBtnText}>Generate Next Week</Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : today && today.isRestDay ? (
        <View style={styles.restDayCard}>
          <View style={styles.restDayIconRow}>
            <MaterialCommunityIcons name="sleep" size={32} color="#a78bfa" />
          </View>
          <Text style={styles.restDayTitle}>Rest Day</Text>
          <Text style={styles.restDaySub}>
            {today.theme || "Take it easy today — recovery is part of the plan. Come back tomorrow refreshed."}
          </Text>
        </View>
      ) : today ? (
        <TodayCard
          today={today}
          completedToday={completedToday}
          canSwap={canSwapDay(today.dayNumber)}
          onSwap={() => openSwapModal(today.dayNumber)}
          onStart={() =>
            router.push({
              pathname: "/WorkoutActiveScreen",
              params: {
                dayText: encodeURIComponent(todayDayText),
                dayNumber: String(today.dayNumber),
                theme: today.theme,
              },
            })
          }
        />
      ) : (
        <View style={styles.noPlanCard}>
          <Text style={styles.noPlanText}>
            No plan found. Head to the Plan tab to generate your 7-day program.
          </Text>
        </View>
      )}

      {/* ── Log Match button (secondary action, soft gradient fill) ── */}
      <Pressable onPress={() => setLogMatchVisible(true)} style={styles.logMatchWrap}>
        <LinearGradient
          colors={["#10331a", "#0a1a0f"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.logMatchBtn}
        >
          <MaterialCommunityIcons name="scoreboard-outline" size={20} color={GREEN} />
          <Text style={styles.logMatchBtnText}>Log Match</Text>
        </LinearGradient>
      </Pressable>

      {/* ── AI coach adjustment card (persists all week, tappable for detail) ── */}
      {adjustment && adjustment.length > 0 && (
        <Pressable style={styles.adjustBanner} onPress={() => setAdjustmentModalVisible(true)}>
          <View style={styles.adjustBannerIcon}>
            <MaterialCommunityIcons name="robot-happy" size={22} color="#a78bfa" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.adjustBannerTitle}>Your coach adjusted your plan</Text>
            <Text style={styles.adjustBannerSub}>
              {adjustment.length === 1
                ? `Day ${adjustment[0].day} was updated — tap to see why`
                : `${adjustment.length} days were updated — tap to see why`}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#c4b5fd" />
        </Pressable>
      )}

      {weekDays.length > 0 && <WeekStrip days={weekDays} onDayPress={(day) => setPreviewDay(day)} />}

      <View style={styles.statsRow}>
        <StatCard label="Overall Day" value={`${totalWorkoutsCompleted + 1}`} />
        <StatCard label="Day This Week" value={`${currentPlanDay} / 7`} />
        <StatCard label="Workouts This Week" value={`${weekProgress.completed} / ${weekProgress.total}`} />
      </View>

      {/* ── Level / XP card ── */}
      <LinearGradient
        colors={["#1f2a20", "#161616"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.levelCard}
      >
        <View style={styles.levelCardHeader}>
          <View style={styles.levelBadge}>
            <MaterialCommunityIcons name="trophy-variant" size={18} color={level.color} />
            <Text style={[styles.levelBadgeText, { color: level.color }]}>{level.name}</Text>
          </View>
          <Text style={styles.levelXpText}>{xp.toLocaleString()} XP</Text>
        </View>
        <View style={styles.levelTrack}>
          <LinearGradient
            colors={[darkenHex(level.color), level.color]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.levelFill, { width: `${Math.round(levelProgress * 100)}%` as any }]}
          />
        </View>
        <Text style={styles.levelHint}>
          {xpRemaining > 0
            ? `${xpRemaining.toLocaleString()} XP to next level`
            : "Max level reached — you're Elite! 🏆"}
        </Text>
      </LinearGradient>

      <LinearGradient
        colors={["#1f2a20", "#161616"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.progressCard}
      >
        <Text style={styles.progressTitle}>Weekly Progress</Text>
        <View style={styles.progressTrack}>
          <LinearGradient
            colors={["#16a34a", "#4ade80"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressFill, { width: `${progressPct}%` as any }]}
          />
        </View>
        <Text style={styles.progressLabel}>{progressPct}% of your weekly plan completed</Text>
      </LinearGradient>

      {/* ── AI adjustment detail modal ── */}
      <Modal visible={adjustmentModalVisible} transparent animationType="slide">
        <View style={styles.adjustModalOverlay}>
          <View style={styles.adjustModalSheet}>
            <View style={styles.adjustModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="robot-happy" size={24} color="#a78bfa" />
                <Text style={styles.adjustModalTitle}>Plan Adjusted</Text>
              </View>
              <Pressable onPress={closeAdjustmentModal} style={styles.adjustModalClose}>
                <Text style={styles.adjustModalCloseText}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.adjustModalIntro}>
              Based on your recent feedback, your AI coach made these changes to keep your training safe and effective:
            </Text>
            {(adjustment || []).map((a, i) => (
              <View key={i} style={styles.adjustModalRow}>
                <View style={styles.adjustModalDayBadge}>
                  <Text style={styles.adjustModalDayText}>Day {a.day}</Text>
                </View>
                <Text style={styles.adjustModalReason}>{a.reason}</Text>
              </View>
            ))}
            <Pressable style={styles.adjustModalBtn} onPress={closeAdjustmentModal}>
              <Text style={styles.adjustModalBtnText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Week day preview modal ── */}
      <Modal visible={previewDay !== null} transparent animationType="slide">
        <View style={styles.previewModalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setPreviewDay(null)} />
          <View style={styles.previewModalSheet}>
            {previewDay && (() => {
              const parsed = parseTodayPlan(previewDay.fullText, previewDay.dayNumber);
              const isRest = parsed.isRestDay;
              return (
                <>
                  <View style={styles.previewModalHeader}>
                    <View style={{ flex: 1, paddingRight: 12 }}>
                      <Text style={styles.previewModalDay}>Day {previewDay.dayNumber}</Text>
                      <Text style={styles.previewModalTheme}>{previewDay.theme || "Training Day"}</Text>
                    </View>
                    <Pressable onPress={() => setPreviewDay(null)} style={styles.previewModalClose}>
                      <Text style={styles.previewModalCloseText}>✕</Text>
                    </Pressable>
                  </View>

                  <ScrollView
                    style={{ maxHeight: 460 }}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 12 }}
                  >
                    {isRest ? (
                      <View style={styles.previewRestRow}>
                        <MaterialCommunityIcons name="sleep" size={28} color="#a78bfa" />
                        <Text style={styles.previewRestText}>
                          Rest & recovery day — no workout scheduled.
                        </Text>
                      </View>
                    ) : (
                      parsed.sessions.map((session, si) => (
                        <View key={si} style={styles.previewSession}>
                          <View style={styles.previewSessionHeader}>
                            {renderSessionIcon(session.type, 16)}
                            <Text style={styles.previewSessionLabel}>
                              {SESSION_LABELS[session.type] || session.type}
                            </Text>
                          </View>
                          {session.items.map((item, ii) => (
                            <View key={ii} style={styles.previewExerciseRow}>
                              <View style={styles.previewExerciseDot} />
                              <Text style={styles.previewExerciseText}>{item}</Text>
                            </View>
                          ))}
                        </View>
                      ))
                    )}
                  </ScrollView>

                  {canSwapDay(previewDay.dayNumber) && (
                    <Pressable
                      style={styles.previewSwapBtn}
                      onPress={() => {
                        setPreviewDay(null);
                        openSwapModal(previewDay.dayNumber);
                      }}
                    >
                      <Text style={styles.previewSwapText}>Can't train this day? Swap with a rest day</Text>
                    </Pressable>
                  )}
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ── Swap picker modal: choose which rest day to move the workout into ── */}
      <Modal visible={swapModalVisible} transparent animationType="slide">
        <View style={styles.previewModalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setSwapModalVisible(false)} />
          <View style={styles.previewModalSheet}>
            <View style={styles.previewModalHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.previewModalDay}>Move Day {swapSourceDay}</Text>
                <Text style={styles.previewModalTheme}>Pick a rest day to swap with</Text>
              </View>
              <Pressable onPress={() => setSwapModalVisible(false)} style={styles.previewModalClose}>
                <Text style={styles.previewModalCloseText}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.swapIntro}>
              Your Day {swapSourceDay} workout will move to the rest day you choose, and that day
              becomes your rest day instead.
            </Text>

            {availableRestTargets().length === 0 ? (
              <Text style={styles.swapEmpty}>No upcoming rest days available to swap with.</Text>
            ) : (
              availableRestTargets().map((restDay) => (
                <Pressable
                  key={restDay}
                  style={styles.swapOption}
                  disabled={swapping}
                  onPress={() => swapSourceDay && performSwap(swapSourceDay, restDay)}
                >
                  <View style={styles.swapOptionIcon}>
                    <MaterialCommunityIcons name="sleep" size={20} color="#a78bfa" />
                  </View>
                  <Text style={styles.swapOptionText}>Day {restDay} — Rest Day</Text>
                  {swapping ? (
                    <ActivityIndicator color="#a78bfa" size="small" />
                  ) : (
                    <MaterialCommunityIcons name="chevron-right" size={22} color="#c4b5fd" />
                  )}
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>

      {/* ── Swap confirmation toast ── */}
      <Modal visible={swapConfirmation !== ""} transparent animationType="fade">
        <Pressable style={styles.confirmOverlay} onPress={() => setSwapConfirmation("")}>
          <View style={styles.confirmCard}>
            <MaterialCommunityIcons name="check-circle" size={28} color="#4ade80" />
            <Text style={styles.confirmText}>{swapConfirmation}</Text>
            <Pressable style={styles.confirmBtn} onPress={() => setSwapConfirmation("")}>
              <Text style={styles.confirmBtnText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <LogMatchModal
        visible={logMatchVisible}
        onClose={() => setLogMatchVisible(false)}
      />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#22c55e";
const GREEN_DIM = "#14532d";
const GREEN_BRIGHT = "#4ade80";
const BG = "#0f0f0f";
const SURFACE = "#1a1a1a";
const SURFACE2 = "#252525";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED = "#888888";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 24, paddingTop: 70, paddingBottom: 120 },
  centered: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },

  completionBanner: {
    backgroundColor: "#0d1f0d",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: GREEN,
  },
  completionBannerTitle: { color: GREEN_BRIGHT, fontSize: 16, fontWeight: "700", marginBottom: 4 },
  completionBannerSub: { color: "#86efac", fontSize: 13, lineHeight: 18 },

  // ── AI adjustment banner ──
  adjustBanner: {
    backgroundColor: "#1a1030",
    borderRadius: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#a78bfa",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  adjustBannerIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#2a1a4a", justifyContent: "center", alignItems: "center",
  },
  adjustBannerTitle: { color: "#c4b5fd", fontSize: 15, fontWeight: "700", marginBottom: 2 },
  adjustBannerSub: { color: "#a78bfa", fontSize: 12, lineHeight: 16 },

  // ── AI adjustment modal ──
  adjustModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  adjustModalSheet: {
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  adjustModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  adjustModalTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  adjustModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  adjustModalCloseText: { color: "#fff", fontSize: 13 },
  adjustModalIntro: { color: "#aaa", fontSize: 14, lineHeight: 21, marginBottom: 20 },
  adjustModalRow: { flexDirection: "row", gap: 12, marginBottom: 16, alignItems: "flex-start" },
  adjustModalDayBadge: { backgroundColor: "#2a1a4a", borderWidth: 0.5, borderColor: "#a78bfa", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  adjustModalDayText: { color: "#c4b5fd", fontSize: 13, fontWeight: "700" },
  adjustModalReason: { color: "#ddd", fontSize: 14, lineHeight: 20, flex: 1 },
  adjustModalBtn: { backgroundColor: "#a78bfa", borderRadius: 16, padding: 16, alignItems: "center", marginTop: 8 },
  adjustModalBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },

  // ── Week day preview modal ──
  previewModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  previewModalSheet: {
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
  },
  previewModalHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18 },
  previewModalDay: { color: GREEN, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  previewModalTheme: { color: "#fff", fontSize: 22, fontWeight: "700" },
  previewModalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  previewModalCloseText: { color: "#fff", fontSize: 13 },
  previewRestRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 },
  previewRestText: { color: "#c4b5fd", fontSize: 15, lineHeight: 21, flex: 1 },
  previewSession: { marginBottom: 18 },
  previewSessionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  previewSessionLabel: { color: GREEN, fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  previewExerciseRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8, paddingLeft: 4 },
  previewExerciseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN, marginTop: 7 },
  previewExerciseText: { color: "#ddd", fontSize: 14, lineHeight: 20, flex: 1 },

  completedTodayRow: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#0d1f0d",
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: "center",
  },
  completedTodayText: { color: GREEN_BRIGHT, fontSize: 15, fontWeight: "700" },

  weekCompleteBanner: {
    backgroundColor: "#1a1500",
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#facc15",
    alignItems: "center",
  },
  weekCompleteIconRow: { marginBottom: 10 },
  weekCompleteTitle: {
    color: "#facc15",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  weekCompleteSub: {
    color: "#fde68a",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 20,
  },
  regenBtn: {
    backgroundColor: GREEN,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  regenBtnDisabled: { opacity: 0.6 },
  regenBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  regenBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  regenError: {
    color: "#f87171",
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },

  greeting: { color: TEXT_PRIMARY, fontSize: 34, fontWeight: "700" },
  name: { color: TEXT_PRIMARY, fontSize: 34, fontWeight: "700", marginBottom: 6 },
  subheading: { color: TEXT_MUTED, fontSize: 17, marginBottom: 28 },

  logMatchWrap: { marginBottom: 24, borderRadius: 14, overflow: "hidden" },
  logMatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 0,
    borderColor: "#1e4d2b", // soft, low-contrast green — melts into the gradient
  },
  logMatchBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  todayCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: GREEN,
    marginBottom: 18,
  },
  todayCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  todayLabel: { color: GREEN, fontSize: 14, fontWeight: "600" },
  dayBadge: { backgroundColor: GREEN_DIM, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  dayBadgeText: { color: GREEN_BRIGHT, fontSize: 12, fontWeight: "700" },
  todayTheme: { color: TEXT_PRIMARY, fontSize: 24, fontWeight: "700", marginBottom: 14, lineHeight: 30 },

  sessionChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  sessionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: SURFACE2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  sessionChipText: { color: TEXT_MUTED, fontSize: 12 },

  previewItem: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN, flexShrink: 0 },
  previewText: { color: "#d1d5db", fontSize: 14, flex: 1 },
  moreBtn: { marginTop: 4, marginBottom: 4 },
  moreText: { color: TEXT_MUTED, fontSize: 13 },

  startBtnWrap: { marginTop: 18, borderRadius: 16, overflow: "hidden" },
  startBtn: { padding: 16, borderRadius: 16, alignItems: "center" },
  startBtnText: { color: "#000", fontSize: 17, fontWeight: "700" },

  noPlanCard: { backgroundColor: SURFACE, borderRadius: 24, padding: 24, marginBottom: 18, borderWidth: 1, borderColor: "#2a2a2a" },
  noPlanText: { color: TEXT_MUTED, fontSize: 15, lineHeight: 22 },

  // ── Rest day card ──
  restDayCard: {
    backgroundColor: "#15101f",
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#a78bfa",
    alignItems: "center",
  },
  restDayIconRow: { marginBottom: 10 },
  restDayTitle: { color: "#a78bfa", fontSize: 22, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  restDaySub: { color: "#c4b5fd", fontSize: 14, lineHeight: 21, textAlign: "center" },

  weekStripWrapper: { marginBottom: 18 },
  sectionLabel: { color: TEXT_MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
  weekStripScroll: { gap: 10, paddingRight: 4 },
  weekDayCard: {
    width: 90,
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#2a2a2a",
  },
  weekDayCardToday: { borderColor: GREEN, borderWidth: 1.5, backgroundColor: "#0d1f0d" },
  weekDayCardPast: { opacity: 0.45 },
  weekDayNum: { fontSize: 11, color: TEXT_MUTED, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  weekDayNumToday: { color: GREEN },
  weekDayNumPast: { color: TEXT_MUTED },
  weekDayIcon: { marginBottom: 8 },
  weekDayTheme: { fontSize: 11, color: TEXT_MUTED, textAlign: "center", lineHeight: 15 },
  weekDayThemeToday: { color: "#d1d5db" },
  todayPill: { marginTop: 8, backgroundColor: GREEN_DIM, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  todayPillText: { color: GREEN_BRIGHT, fontSize: 10, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 14, marginBottom: 18 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 20, padding: 18 },
  statLabel: { color: TEXT_MUTED, fontSize: 14, marginBottom: 8 },
  statValue: { color: TEXT_PRIMARY, fontSize: 28, fontWeight: "700" },

  progressCard: { borderRadius: 20, padding: 18 },
  progressTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700", marginBottom: 14 },

  // ── Level / XP card ──
  levelCard: { borderRadius: 20, padding: 18, marginBottom: 18 },
  levelCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelBadgeText: { color: "#facc15", fontSize: 16, fontWeight: "700" },
  levelXpText: { color: TEXT_MUTED, fontSize: 14, fontWeight: "600" },
  levelTrack: { backgroundColor: "#333", height: 10, borderRadius: 20, overflow: "hidden", marginBottom: 10 },
  levelFill: { backgroundColor: "#facc15", height: "100%", borderRadius: 20 },
  levelHint: { color: TEXT_MUTED, fontSize: 13 },
  progressTrack: { backgroundColor: "#333", height: 12, borderRadius: 20, overflow: "hidden", marginBottom: 10 },
  progressFill: { backgroundColor: GREEN, height: "100%", borderRadius: 20 },
  progressLabel: { color: TEXT_MUTED, fontSize: 14 },

  // ── Day swap feature ──
  cantTrainBtn: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 4,
  },
  cantTrainText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
  },

  previewSwapBtn: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 6,
  },
  previewSwapText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
  },

  swapIntro: { color: "#aaa", fontSize: 14, lineHeight: 21, marginBottom: 18 },
  swapEmpty: { color: TEXT_MUTED, fontSize: 14, textAlign: "center", marginVertical: 20 },
  swapOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1a1030", borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 0.5, borderColor: "#a78bfa",
  },
  swapOptionIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: "#2a1a4a",
    justifyContent: "center", alignItems: "center",
  },
  swapOptionText: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },

  confirmOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center", padding: 32,
  },
  confirmCard: {
    backgroundColor: "#15101f", borderRadius: 24, padding: 28, alignItems: "center",
    borderWidth: 1, borderColor: "#a78bfa", width: "100%",
  },
  confirmText: {
    color: "#e9d5ff", fontSize: 15, lineHeight: 22, textAlign: "center",
    marginTop: 12, marginBottom: 20,
  },
  confirmBtn: {
    backgroundColor: "#a78bfa", borderRadius: 14, paddingVertical: 12,
    paddingHorizontal: 32, alignItems: "center",
  },
  confirmBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },
});