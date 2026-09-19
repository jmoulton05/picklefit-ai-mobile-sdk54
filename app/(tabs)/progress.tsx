import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  VictoryArea,
  VictoryAxis,
  VictoryBar,
  VictoryChart,
  VictoryScatter,
} from "victory-native";
import GameLogModal from "../GameLogModal";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkoutHistory {
  id: string;
  day_number: number;
  theme: string;
  completed_at: string;
  duration_seconds: number;
  overallDay: number; // cumulative completed-workout number (Day 17, etc.)
}

interface PersonalBest {
  exercise_name: string;
  best_weight: number;
  best_reps: number;
  best_duration: number;
  total_sets: number;
}

interface VolumePoint {
  date: string;
  volume: number;
}

interface AggregateStats {
  mostWeight: number;
  mostWeightExercise: string;
  highestTime: number;
  highestTimeExercise: string;
  totalSets: number;
}

interface ExerciseSetDetail {
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
  duration_seconds: number | null;
}

interface WorkoutExerciseDetail {
  exercise_name: string;
  sets: ExerciseSetDetail[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const formatFullDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
};

const monthKey = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - 48;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function WorkoutHistoryCard({
  workout,
  onPress,
}: {
  workout: WorkoutHistory;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.historyCard} onPress={onPress}>
      <View style={styles.historyCardLeft}>
        <Text style={styles.historyTheme} numberOfLines={1}>
          {workout.theme || `Day ${workout.day_number}`}
        </Text>
        <Text style={styles.historyDate}>{formatFullDate(workout.completed_at)}</Text>
      </View>
      <View style={styles.historyCardRight}>
        <View style={styles.historyCardRightMeta}>
          <Text style={styles.historyDuration}>
            {formatDuration(workout.duration_seconds || 0)}
          </Text>
          <View style={styles.historyBadge}>
            <Text style={styles.historyBadgeText}>Day {workout.overallDay}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#444" />
      </View>
    </Pressable>
  );
}

// ─── Calendar Modal ───────────────────────────────────────────────────────────

function CalendarModal({
  visible,
  onClose,
  workoutDates,
}: {
  visible: boolean;
  onClose: () => void;
  workoutDates: Set<string>; // 'YYYY-M-D' keys
}) {
  const [viewDate, setViewDate] = useState(new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build calendar grid cells (leading blanks + days)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayKey = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${t.getMonth()}-${t.getDate()}`;
  })();

  const goPrev = () => setViewDate(new Date(year, month - 1, 1));
  const goNext = () => setViewDate(new Date(year, month + 1, 1));

  const monthWorkouts = [...workoutDates].filter((k) => {
    const [y, m] = k.split("-").map(Number);
    return y === year && m === month;
  }).length;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.calendarOverlay}>
        <View style={styles.calendarSheet}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>Workout Calendar</Text>
            <Pressable onPress={onClose} style={styles.calendarCloseBtn}>
              <Text style={styles.calendarCloseBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Month nav */}
          <View style={styles.calendarNav}>
            <Pressable onPress={goPrev} style={styles.calendarNavBtn}>
              <MaterialCommunityIcons name="chevron-left" size={26} color="#22c55e" />
            </Pressable>
            <Text style={styles.calendarMonthLabel}>
              {MONTH_NAMES[month]} {year}
            </Text>
            <Pressable onPress={goNext} style={styles.calendarNavBtn}>
              <MaterialCommunityIcons name="chevron-right" size={26} color="#22c55e" />
            </Pressable>
          </View>

          {/* Day-of-week header */}
          <View style={styles.calendarDowRow}>
            {DOW_LABELS.map((d, i) => (
              <View key={i} style={styles.calendarDowCell}>
                <Text style={styles.calendarDowText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Grid */}
          <View style={styles.calendarGrid}>
            {cells.map((day, i) => {
              if (day === null) {
                return <View key={`blank-${i}`} style={styles.calendarCell} />;
              }
              const key = `${year}-${month}-${day}`;
              const worked = workoutDates.has(key);
              const isToday = key === todayKey;
              return (
                <View key={key} style={styles.calendarCell}>
                  <View
                    style={[
                      styles.calendarDay,
                      worked && styles.calendarDayWorked,
                      isToday && styles.calendarDayToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        worked && styles.calendarDayTextWorked,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Summary */}
          <View style={styles.calendarSummary}>
            <View style={styles.calendarLegendDot} />
            <Text style={styles.calendarSummaryText}>
              {monthWorkouts} workout{monthWorkouts === 1 ? "" : "s"} this month
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Workout Detail Modal ─────────────────────────────────────────────────────

function WorkoutDetailModal({
  visible,
  onClose,
  workout,
}: {
  visible: boolean;
  onClose: () => void;
  workout: WorkoutHistory | null;
}) {
  const [exercises, setExercises] = useState<WorkoutExerciseDetail[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (visible && workout) {
      fetchWorkoutDetail(workout.id);
    }
  }, [visible, workout]);

  const fetchWorkoutDetail = async (workoutId: string) => {
    setLoadingDetail(true);
    setExercises([]);

    const { data: exRows } = await supabase
      .from("workout_exercises")
      .select("id, exercise_name, order_index")
      .eq("workout_id", workoutId)
      .order("order_index", { ascending: true });

    if (!exRows || exRows.length === 0) {
      setLoadingDetail(false);
      return;
    }

    const exIds = exRows.map((e) => e.id);
    const { data: setRows } = await supabase
      .from("exercise_sets")
      .select("workout_exercise_id, set_number, reps, weight_lbs, duration_seconds")
      .in("workout_exercise_id", exIds)
      .order("set_number", { ascending: true });

    const setsMap: Record<string, ExerciseSetDetail[]> = {};
    for (const s of setRows || []) {
      if (!setsMap[s.workout_exercise_id]) setsMap[s.workout_exercise_id] = [];
      setsMap[s.workout_exercise_id].push({
        set_number: s.set_number,
        reps: s.reps,
        weight_lbs: s.weight_lbs,
        duration_seconds: s.duration_seconds,
      });
    }

    setExercises(
      exRows.map((e) => ({
        exercise_name: e.exercise_name,
        sets: setsMap[e.id] || [],
      }))
    );
    setLoadingDetail(false);
  };

  if (!workout) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.detailOverlay}>
        <View style={styles.detailSheet}>
          <View style={styles.detailHeader}>
            <View style={styles.detailHeaderLeft}>
              <Text style={styles.detailTitle} numberOfLines={1}>
                {workout.theme || `Day ${workout.day_number}`}
              </Text>
              <Text style={styles.detailSubtitle}>
                {formatFullDate(workout.completed_at)} · {formatDuration(workout.duration_seconds || 0)}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.detailCloseBtn}>
              <Text style={styles.detailCloseBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.detailScroll}
          >
            {loadingDetail ? (
              <ActivityIndicator color="#22c55e" style={{ marginTop: 40 }} />
            ) : exercises.length === 0 ? (
              <Text style={styles.detailEmpty}>No exercises logged for this workout.</Text>
            ) : (
              exercises.map((ex, i) => (
                <View key={i} style={styles.detailExerciseBlock}>
                  <Text style={styles.detailExName}>{ex.exercise_name}</Text>
                  {ex.sets.length === 0 ? (
                    <Text style={styles.detailNoSets}>No sets logged</Text>
                  ) : (
                    <>
                      <View style={styles.detailSetHeader}>
                        <Text style={[styles.detailSetCol, styles.detailSetColLabel]}>Set</Text>
                        <Text style={[styles.detailSetCol, styles.detailSetColLabel]}>Reps</Text>
                        <Text style={[styles.detailSetCol, styles.detailSetColLabel]}>Weight</Text>
                        <Text style={[styles.detailSetCol, styles.detailSetColLabel]}>Time</Text>
                      </View>
                      {ex.sets.map((s, j) => (
                        <View key={j} style={[styles.detailSetRow, j % 2 === 1 && styles.detailSetRowAlt]}>
                          <Text style={styles.detailSetCol}>{s.set_number ?? j + 1}</Text>
                          <Text style={styles.detailSetCol}>
                            {s.reps != null ? s.reps : "—"}
                          </Text>
                          <Text style={styles.detailSetCol}>
                            {s.weight_lbs != null ? `${s.weight_lbs} lbs` : "—"}
                          </Text>
                          <Text style={styles.detailSetCol}>
                            {s.duration_seconds != null
                              ? `${Math.floor(s.duration_seconds / 60).toString().padStart(2, "0")}:${(s.duration_seconds % 60).toString().padStart(2, "0")}`
                              : "—"}
                          </Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function WorkoutCatalogModal({
  visible,
  onClose,
  personalBests,
}: {
  visible: boolean;
  onClose: () => void;
  personalBests: PersonalBest[];
}) {
  const [query, setQuery] = useState("");
  const filtered = personalBests.filter((pb) =>
    pb.exercise_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.catalogOverlay}>
        <View style={styles.catalogSheet}>
          <View style={styles.catalogHeader}>
            <Text style={styles.catalogTitle}>Workout Catalog</Text>
            <Pressable onPress={onClose} style={styles.catalogCloseBtn}>
              <Text style={styles.catalogCloseBtnText}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.catalogSearchRow}>
            <TextInput
              style={styles.catalogSearchInput}
              placeholder="Search exercises..."
              placeholderTextColor="#555"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
            />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.catalogList}
          >
            {filtered.length === 0 ? (
              <Text style={styles.catalogEmpty}>
                {query ? "No exercises match your search." : "No exercises logged yet."}
              </Text>
            ) : (
              filtered.map((pb, i) => (
                <View key={i} style={styles.catalogRow}>
                  <Text style={styles.catalogExName} numberOfLines={1}>
                    {pb.exercise_name}
                  </Text>
                  <View style={styles.catalogStats}>
                    {pb.best_weight > 0 && (
                      <View style={styles.catalogStat}>
                        <Text style={styles.catalogStatValue}>{pb.best_weight}</Text>
                        <Text style={styles.catalogStatLabel}>lbs PR</Text>
                      </View>
                    )}
                    {pb.best_reps > 0 && (
                      <View style={styles.catalogStat}>
                        <Text style={styles.catalogStatValue}>{pb.best_reps}</Text>
                        <Text style={styles.catalogStatLabel}>reps PR</Text>
                      </View>
                    )}
                    {pb.best_duration > 0 && (
                      <View style={styles.catalogStat}>
                        <Text style={styles.catalogStatValue}>{pb.best_duration}s</Text>
                        <Text style={styles.catalogStatLabel}>time PR</Text>
                      </View>
                    )}
                    <View style={styles.catalogStat}>
                      <Text style={styles.catalogStatValue}>{pb.total_sets}</Text>
                      <Text style={styles.catalogStatLabel}>sets</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<WorkoutHistory[]>([]);
  const [personalBests, setPersonalBests] = useState<PersonalBest[]>([]);
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [gameLogVisible, setGameLogVisible] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutHistory | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [aggregateStats, setAggregateStats] = useState<AggregateStats>({
    mostWeight: 0,
    mostWeightExercise: "—",
    highestTime: 0,
    highestTimeExercise: "—",
    totalSets: 0,
  });

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }
    const userId = userData.user.id;

    // ── ALL completed workouts (oldest→newest) for cumulative day numbering ──
    const { data: allWorkoutsAsc } = await supabase
      .from("workouts")
      .select("id, completed_at")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: true });

    // Map workout id -> cumulative "overall day" (1-indexed)
    const overallDayMap: Record<string, number> = {};
    const dateSet = new Set<string>();
    (allWorkoutsAsc || []).forEach((w, idx) => {
      overallDayMap[w.id] = idx + 1;
      const d = new Date(w.completed_at);
      dateSet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    });
    setWorkoutDates(dateSet);

    // ── Recent workouts (newest first) for the list ──
    const { data: workoutData } = await supabase
      .from("workouts")
      .select("id, day_number, theme, completed_at, duration_seconds")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(50);

    if (workoutData) {
      const withOverall: WorkoutHistory[] = workoutData.map((w) => ({
        ...w,
        overallDay: overallDayMap[w.id] || 0,
      }));
      setWorkouts(withOverall);
      setTotalWorkouts(allWorkoutsAsc?.length || 0);
      setTotalMinutes(
        Math.round((allWorkoutsAsc || []).length === 0
          ? 0
          : workoutData.reduce((acc, w) => acc + (w.duration_seconds || 0), 0) / 60)
      );

      const dates = workoutData
        .map((w) => new Date(w.completed_at).toDateString())
        .filter((v, i, a) => a.indexOf(v) === i);

      // ── Build the set of scheduled REST-day calendar dates ──
      // A rest day shouldn't break the streak (the plan told the user to rest).
      // Map each plan day to its calendar date (plan_created_at + (n-1) days) and
      // mark the ones that are rest days.
      const restDates = new Set<string>();
      const { data: planProfile } = await supabase
        .from("profiles")
        .select("current_plan, plan_created_at")
        .eq("id", userId)
        .maybeSingle();

      if (planProfile?.current_plan && planProfile.plan_created_at) {
        // Split into day chunks (same approach as the home screen).
        const firstIdx = planProfile.current_plan.search(/Day\s+1\s*:/i);
        const planBody = firstIdx >= 0 ? planProfile.current_plan.slice(firstIdx) : planProfile.current_plan;
        const dayChunks = planBody
          .replace(/^---+$/gm, "")
          .split(/(?=Day\s+\d+\s*:)/gi)
          .map((d: string) => d.trim())
          .filter(Boolean);

        const isRestChunk = (text: string): boolean => {
          const lower = text.toLowerCase();
          // Title/theme mentions rest/recovery, OR there are no trainable session lines.
          const titleLine = (text.split("\n")[0] || "").toLowerCase();
          if (titleLine.includes("rest") || titleLine.includes("recovery")) return true;
          const hasTrainable = /(workout:|fitness:|pickleball skill work:)/i.test(text);
          return !hasTrainable;
        };

        const planStart = new Date(planProfile.plan_created_at);
        planStart.setHours(0, 0, 0, 0);
        dayChunks.forEach((chunk: string, i: number) => {
          if (isRestChunk(chunk)) {
            const d = new Date(planStart);
            d.setDate(planStart.getDate() + i);
            restDates.add(d.toDateString());
          }
        });
      }

      let streak = 0;
      const today = new Date();
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = d.toDateString();
        if (dates.includes(ds)) {
          streak++;               // trained that day → counts
        } else if (restDates.has(ds)) {
          continue;               // scheduled rest day → doesn't break, doesn't add
        } else {
          break;                  // a day they should have trained but didn't → streak ends
        }
      }
      setCurrentStreak(streak);
    }

    // ── Personal bests (all sets, joined to exercise name) ──
    const { data: pbData } = await supabase
      .from("exercise_sets")
      .select(`
        workout_exercise_id,
        reps,
        weight_lbs,
        duration_seconds,
        workout_exercises!inner(exercise_name, user_id)
      `)
      .eq("workout_exercises.user_id", userId);

    if (pbData) {
      const pbMap: Record<string, PersonalBest> = {};
      for (const row of pbData) {
        const name = (row.workout_exercises as any)?.exercise_name || "Unknown";
        if (!pbMap[name]) {
          pbMap[name] = { exercise_name: name, best_weight: 0, best_reps: 0, best_duration: 0, total_sets: 0 };
        }
        pbMap[name].total_sets += 1;
        if ((row.weight_lbs || 0) > pbMap[name].best_weight) pbMap[name].best_weight = row.weight_lbs || 0;
        if ((row.reps || 0) > pbMap[name].best_reps) pbMap[name].best_reps = row.reps || 0;
        if ((row.duration_seconds || 0) > pbMap[name].best_duration) pbMap[name].best_duration = row.duration_seconds || 0;
      }
      const allPBs = Object.values(pbMap);
      setPersonalBests(allPBs);
      const heaviest = allPBs.reduce(
        (best, pb) => (pb.best_weight > best.best_weight ? pb : best),
        allPBs[0] || { exercise_name: "—", best_weight: 0, best_duration: 0, best_reps: 0, total_sets: 0 }
      );
      const longest = allPBs.reduce(
        (best, pb) => (pb.best_duration > best.best_duration ? pb : best),
        allPBs[0] || { exercise_name: "—", best_weight: 0, best_duration: 0, best_reps: 0, total_sets: 0 }
      );
      setAggregateStats({
        mostWeight: heaviest?.best_weight || 0,
        mostWeightExercise: heaviest?.exercise_name || "—",
        highestTime: longest?.best_duration || 0,
        highestTimeExercise: longest?.exercise_name || "—",
        totalSets: allPBs.reduce((acc, pb) => acc + pb.total_sets, 0),
      });
    }

    // ── Volume: ONLY workout/fitness session types ──
    if (workoutData && workoutData.length > 0) {
      // Pull the most recent strength-based workouts (workout/fitness),
      // then compute volume per workout from their sets.
      const recentIds = workoutData.map((w) => w.id);
      const { data: setsData } = await supabase
        .from("exercise_sets")
        .select("reps, weight_lbs, workout_exercises!inner(workout_id, session_type)")
        .in("workout_exercises.workout_id", recentIds)
        .in("workout_exercises.session_type", ["workout", "fitness"]);

      if (setsData) {
        const volumeByWorkout: Record<string, number> = {};
        for (const set of setsData) {
          const wid = (set.workout_exercises as any)?.workout_id;
          if (!wid) continue;
          volumeByWorkout[wid] = (volumeByWorkout[wid] || 0) + (set.reps || 0) * (set.weight_lbs || 0);
        }

        // Only include workouts that actually had strength volume,
        // newest 7, displayed oldest→newest
        const strengthWorkouts = workoutData
          .filter((w) => (volumeByWorkout[w.id] || 0) > 0)
          .slice(0, 7)
          .reverse();

        setVolumeData(
          strengthWorkouts.map((w) => ({
            date: formatDate(w.completed_at),
            volume: Math.round(volumeByWorkout[w.id] || 0),
          }))
        );
      }
    }

    setLoading(false);
  };

  const handleWorkoutPress = (workout: WorkoutHistory) => {
    setSelectedWorkout(workout);
    setDetailVisible(true);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const hasVolumeData = volumeData.length >= 2;
  const hasFrequencyData = workouts.length >= 2;

  const volumeChartData = volumeData.map((v, i) => ({ x: i + 1, y: v.volume, label: v.date }));
  const volumeMax = Math.max(...volumeData.map((v) => v.volume), 10);

  // Weekly frequency (last 8 weeks)
  const weekCounts: number[] = [];
  const weekLabels: string[] = [];
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);
    const count = workouts.filter((w) => {
      const d = new Date(w.completed_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weekCounts.push(count);
    weekLabels.push(`${weekStart.getMonth() + 1}/${weekStart.getDate()}`);
  }
  const freqMax = Math.max(...weekCounts, 4);
  const freqChartData = weekCounts.map((count, i) => ({ x: i + 1, y: count }));

  // ── Group workouts by month for the list ──
  const groupedWorkouts: { month: string; items: WorkoutHistory[] }[] = [];
  for (const w of workouts) {
    const key = monthKey(w.completed_at);
    let group = groupedWorkouts.find((g) => g.month === key);
    if (!group) {
      group = { month: key, items: [] };
      groupedWorkouts.push(group);
    }
    group.items.push(w);
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header with calendar icon */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Progress</Text>
          <Text style={styles.subheading}>Track your gains over time.</Text>
        </View>
        <Pressable style={styles.calendarIconBtn} onPress={() => setCalendarVisible(true)}>
          <MaterialCommunityIcons name="calendar-month" size={24} color="#22c55e" />
        </Pressable>
      </View>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalMinutes}</Text>
          <Text style={styles.statLabel}>Minutes</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{currentStreak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>

      {/* Volume over time */}
      <SectionTitle title="Strength Volume" />
      {hasVolumeData ? (
        <View style={styles.chartCard}>
          <VictoryChart
            width={CHART_WIDTH}
            height={240}
            padding={{ top: 24, bottom: 44, left: 64, right: 24 }}
            domain={{ y: [0, volumeMax * 1.2] }}
            domainPadding={{ x: 12 }}
          >
            <VictoryAxis
              tickValues={volumeChartData.map((d) => d.x)}
              tickFormat={volumeChartData.map((d) => d.label)}
              style={{
                axis: { stroke: "#2a2a2a" },
                tickLabels: { fill: "#888888", fontSize: 10, padding: 6 },
                grid: { stroke: "transparent" },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(t: number) =>
                t >= 1000 ? `${Math.round(t / 1000)}k` : `${Math.round(t)}`
              }
              style={{
                axis: { stroke: "transparent" },
                tickLabels: { fill: "#888888", fontSize: 10, padding: 6 },
                grid: { stroke: "#222222", strokeDasharray: "3,5" },
              }}
            />
            <VictoryArea
              data={volumeChartData}
              interpolation="monotoneX"
              style={{
                data: {
                  fill: "#22c55e",
                  fillOpacity: 0.12,
                  stroke: "#22c55e",
                  strokeWidth: 2.5,
                },
              }}
            />
            <VictoryScatter
              data={volumeChartData}
              size={4}
              style={{ data: { fill: "#4ade80", stroke: "#0f0f0f", strokeWidth: 2 } }}
            />
          </VictoryChart>
        </View>
      ) : (
        <EmptyState message="Complete 2+ strength workouts to see your volume trend." />
      )}

      {/* Workout frequency */}
      <SectionTitle title="Weekly Frequency" />
      {hasFrequencyData ? (
        <View style={styles.chartCard}>
          <VictoryChart
            width={CHART_WIDTH}
            height={240}
            padding={{ top: 24, bottom: 44, left: 44, right: 24 }}
            domain={{ y: [0, freqMax] }}
            domainPadding={{ x: 20 }}
          >
            <VictoryAxis
              tickValues={freqChartData.map((d) => d.x)}
              tickFormat={weekLabels}
              style={{
                axis: { stroke: "#2a2a2a" },
                tickLabels: { fill: "#888888", fontSize: 9, padding: 6 },
                grid: { stroke: "transparent" },
              }}
            />
            <VictoryAxis
              dependentAxis
              tickFormat={(t: number) => (Number.isInteger(t) ? `${t}` : "")}
              tickCount={Math.min(freqMax, 5)}
              style={{
                axis: { stroke: "transparent" },
                tickLabels: { fill: "#888888", fontSize: 10, padding: 6 },
                grid: { stroke: "#222222", strokeDasharray: "3,5" },
              }}
            />
            <VictoryBar
              data={freqChartData}
              cornerRadius={{ top: 5 }}
              barWidth={22}
              style={{
                data: {
                  fill: (({ datum }: any) => (datum.y > 0 ? "#22c55e" : "#222222")) as any,
                },
              }}
            />
          </VictoryChart>
        </View>
      ) : (
        <EmptyState message="Complete 2+ workouts to see your weekly frequency." />
      )}

      {/* Personal Bests */}
      <SectionTitle title="Personal Bests" />
      <View style={styles.pbFlagsRow}>
        <View style={styles.pbFlag}>
          <MaterialCommunityIcons name="dumbbell" size={24} color="#22c55e" style={styles.pbFlagIcon} />
          <Text style={styles.pbFlagValue}>
            {aggregateStats.mostWeight > 0 ? `${aggregateStats.mostWeight} lbs` : "—"}
          </Text>
          <Text style={styles.pbFlagLabel}>Most Weight</Text>
          {aggregateStats.mostWeightExercise !== "—" && (
            <Text style={styles.pbFlagSub} numberOfLines={1}>
              {aggregateStats.mostWeightExercise}
            </Text>
          )}
        </View>
        <View style={styles.pbFlag}>
          <MaterialCommunityIcons name="timer-outline" size={24} color="#22c55e" style={styles.pbFlagIcon} />
          <Text style={styles.pbFlagValue}>
            {aggregateStats.highestTime > 0
              ? `${Math.floor(aggregateStats.highestTime / 60).toString().padStart(2, "0")}:${(aggregateStats.highestTime % 60).toString().padStart(2, "0")}`
              : "—"}
          </Text>
          <Text style={styles.pbFlagLabel}>Highest Time</Text>
          {aggregateStats.highestTimeExercise !== "—" && (
            <Text style={styles.pbFlagSub} numberOfLines={1}>
              {aggregateStats.highestTimeExercise}
            </Text>
          )}
        </View>
        <View style={styles.pbFlag}>
          <MaterialCommunityIcons name="chart-bar" size={24} color="#22c55e" style={styles.pbFlagIcon} />
          <Text style={styles.pbFlagValue}>{aggregateStats.totalSets}</Text>
          <Text style={styles.pbFlagLabel}>Total Sets</Text>
          <Text style={styles.pbFlagSub}>All time</Text>
        </View>
      </View>

      <Pressable style={styles.catalogBtn} onPress={() => setCatalogVisible(true)}>
        <Text style={styles.catalogBtnText}>Workout Catalog</Text>
        <Text style={styles.catalogBtnArrow}>→</Text>
      </Pressable>

      <Pressable style={styles.catalogBtn} onPress={() => setGameLogVisible(true)}>
        <Text style={styles.catalogBtnText}>Game Log</Text>
        <Text style={styles.catalogBtnArrow}>→</Text>
      </Pressable>

      <WorkoutCatalogModal
        visible={catalogVisible}
        onClose={() => setCatalogVisible(false)}
        personalBests={personalBests}
      />

      <GameLogModal
        visible={gameLogVisible}
        onClose={() => setGameLogVisible(false)}
      />

      {/* Recent workouts — grouped by month */}
      <SectionTitle title="Recent Workouts" />
      {groupedWorkouts.length > 0 ? (
        groupedWorkouts.map((group) => (
          <View key={group.month} style={styles.monthGroup}>
            <Text style={styles.monthLabel}>{group.month}</Text>
            {group.items.map((w) => (
              <WorkoutHistoryCard
                key={w.id}
                workout={w}
                onPress={() => handleWorkoutPress(w)}
              />
            ))}
          </View>
        ))
      ) : (
        <EmptyState message="No workouts logged yet. Start your first one!" />
      )}

      {/* Modals */}
      <WorkoutDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        workout={selectedWorkout}
      />
      <CalendarModal
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        workoutDates={workoutDates}
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
const BORDER = "#2a2a2a";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED = "#777777";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 24, paddingTop: 70, paddingBottom: 120 },
  centered: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },

  headerRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 28 },
  heading: { color: TEXT_PRIMARY, fontSize: 34, fontWeight: "700", marginBottom: 6 },
  subheading: { color: TEXT_MUTED, fontSize: 16 },
  calendarIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: SURFACE,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: GREEN,
    marginTop: 4,
  },

  sectionTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: "700", marginBottom: 14, marginTop: 8 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 16, padding: 14, alignItems: "center" },
  statValue: { color: GREEN_BRIGHT, fontSize: 26, fontWeight: "700" },
  statLabel: { color: TEXT_MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 },

  chartCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    marginBottom: 28,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: "hidden",
    paddingVertical: 4,
  },

  pbFlagsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  pbFlag: { flex: 1, backgroundColor: SURFACE, borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: BORDER },
  pbFlagIcon: { marginBottom: 6 },
  pbFlagValue: { color: GREEN_BRIGHT, fontSize: 18, fontWeight: "700", marginBottom: 2 },
  pbFlagLabel: { color: TEXT_MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "center", marginBottom: 4 },
  pbFlagSub: { color: "#444", fontSize: 10, textAlign: "center", lineHeight: 13 },

  catalogBtn: { backgroundColor: SURFACE, borderRadius: 14, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: GREEN, marginBottom: 12 },
  catalogBtnText: { color: GREEN_BRIGHT, fontSize: 15, fontWeight: "700" },
  catalogBtnArrow: { color: GREEN, fontSize: 18 },

  // ── Month grouping ──
  monthGroup: { marginBottom: 16 },
  monthLabel: { color: TEXT_MUTED, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },

  // ── History cards ──
  historyCard: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  historyCardLeft: { flex: 1, paddingRight: 12 },
  historyTheme: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: "600", marginBottom: 2 },
  historyDate: { color: TEXT_MUTED, fontSize: 12 },
  historyCardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyCardRightMeta: { alignItems: "flex-end", gap: 4 },
  historyDuration: { color: GREEN, fontSize: 13, fontWeight: "600" },
  historyBadge: { backgroundColor: GREEN_DIM, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  historyBadgeText: { color: GREEN_BRIGHT, fontSize: 11, fontWeight: "700" },

  // ── Calendar modal ──
  calendarOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  calendarSheet: { backgroundColor: "#0f0f0f", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 },
  calendarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  calendarTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: "700" },
  calendarCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  calendarCloseBtnText: { color: TEXT_PRIMARY, fontSize: 13 },
  calendarNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  calendarNavBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  calendarMonthLabel: { color: TEXT_PRIMARY, fontSize: 17, fontWeight: "700" },
  calendarDowRow: { flexDirection: "row", marginBottom: 8 },
  calendarDowCell: { flex: 1, alignItems: "center" },
  calendarDowText: { color: TEXT_MUTED, fontSize: 12, fontWeight: "600" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  calendarCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: "center", alignItems: "center", padding: 3 },
  calendarDay: { width: "100%", height: "100%", borderRadius: 10, justifyContent: "center", alignItems: "center", backgroundColor: "transparent" },
  calendarDayWorked: { backgroundColor: GREEN_DIM, borderWidth: 1, borderColor: GREEN },
  calendarDayToday: { borderWidth: 1, borderColor: "#555" },
  calendarDayText: { color: TEXT_MUTED, fontSize: 14 },
  calendarDayTextWorked: { color: GREEN_BRIGHT, fontWeight: "700" },
  calendarSummary: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, justifyContent: "center" },
  calendarLegendDot: { width: 12, height: 12, borderRadius: 4, backgroundColor: GREEN_DIM, borderWidth: 1, borderColor: GREEN },
  calendarSummaryText: { color: TEXT_MUTED, fontSize: 13 },

  // ── Workout detail modal ──
  detailOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  detailSheet: {
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: "88%",
    paddingTop: 24,
  },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  detailHeaderLeft: { flex: 1, paddingRight: 12 },
  detailTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  detailSubtitle: { color: TEXT_MUTED, fontSize: 13 },
  detailCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SURFACE,
    justifyContent: "center",
    alignItems: "center",
  },
  detailCloseBtnText: { color: TEXT_PRIMARY, fontSize: 14 },
  detailScroll: { paddingHorizontal: 24, paddingBottom: 48 },
  detailEmpty: { color: TEXT_MUTED, fontSize: 14, textAlign: "center", marginTop: 40 },

  detailExerciseBlock: {
    marginBottom: 24,
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  detailExName: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  detailNoSets: { color: TEXT_MUTED, fontSize: 13 },

  detailSetHeader: {
    flexDirection: "row",
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  detailSetRow: {
    flexDirection: "row",
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailSetRowAlt: { backgroundColor: SURFACE2 },
  detailSetCol: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 14,
    textAlign: "center",
  },
  detailSetColLabel: {
    color: TEXT_MUTED,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "600",
  },

  // ── Catalog modal ──
  catalogOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  catalogSheet: { backgroundColor: "#0f0f0f", borderTopLeftRadius: 28, borderTopRightRadius: 28, height: "85%", paddingTop: 24 },
  catalogHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, marginBottom: 16 },
  catalogTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: "700" },
  catalogCloseBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  catalogCloseBtnText: { color: TEXT_PRIMARY, fontSize: 14 },
  catalogSearchRow: { paddingHorizontal: 24, marginBottom: 12 },
  catalogSearchInput: { backgroundColor: SURFACE, borderRadius: 12, padding: 12, color: TEXT_PRIMARY, fontSize: 15, borderWidth: 0.5, borderColor: BORDER },
  catalogList: { paddingHorizontal: 24, paddingBottom: 48 },
  catalogEmpty: { color: TEXT_MUTED, fontSize: 14, textAlign: "center", marginTop: 32 },
  catalogRow: { paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  catalogExName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "600", marginBottom: 8 },
  catalogStats: { flexDirection: "row", gap: 16 },
  catalogStat: { alignItems: "center" },
  catalogStatValue: { color: GREEN_BRIGHT, fontSize: 17, fontWeight: "700" },
  catalogStatLabel: { color: TEXT_MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },

  emptyState: { backgroundColor: SURFACE, borderRadius: 14, padding: 20, alignItems: "center", marginBottom: 28, borderWidth: 0.5, borderColor: BORDER },
  emptyText: { color: TEXT_MUTED, fontSize: 14, textAlign: "center", lineHeight: 22 },
});