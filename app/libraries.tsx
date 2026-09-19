import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Image,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import { supabase } from "./lib/supabase";

// ─── Helpers (mirrored from WorkoutActiveScreen) ──────────────────────────────

const extractYoutubeId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

const titleCase = (s: string): string =>
  s
    .split(" ")
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

// ─── Types ────────────────────────────────────────────────────────────────────

type LibKind = "exercise" | "drill" | null;

interface ExerciseRow {
  exercise_id: string;
  name: string;
  target_muscle: string | null;
  secondary_muscles: string[] | null;
}

interface DrillRow {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  focus_areas: string[] | null;
  youtube_url: string | null;
  video_start: number | null;
  video_end: number | null;
}

interface HistorySet {
  set_number: number;
  reps: number | null;
  weight_lbs: number | null;
  duration_seconds: number | null;
}
interface HistoryEntry {
  date: string; // completed_at
  sets: HistorySet[];
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LibrariesScreen() {
  const router = useRouter();
  const [kind, setKind] = useState<LibKind>(null);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable
        onPress={() => (kind ? setKind(null) : router.back())}
        style={styles.backBtn}
      >
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>Libraries</Text>

      {!kind ? (
        <>
          <Text style={styles.subheading}>Browse every exercise and drill in your program.</Text>
          <Pressable style={styles.pickCard} onPress={() => setKind("exercise")}>
            <View style={styles.pickIcon}>
              <MaterialCommunityIcons name="dumbbell" size={26} color="#22c55e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickTitle}>Exercise Library</Text>
              <Text style={styles.pickSub}>Strength & fitness exercises with demos and your history</Text>
            </View>
            <Text style={styles.pickArrow}>›</Text>
          </Pressable>

          <Pressable style={styles.pickCard} onPress={() => setKind("drill")}>
            <View style={styles.pickIcon}>
              <MaterialCommunityIcons name="tennis" size={26} color="#22c55e" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickTitle}>Drill Library</Text>
              <Text style={styles.pickSub}>Pickleball drills with video demos</Text>
            </View>
            <Text style={styles.pickArrow}>›</Text>
          </Pressable>
        </>
      ) : kind === "exercise" ? (
        <ExerciseLibrary />
      ) : (
        <DrillLibrary />
      )}
    </ScrollView>
  );
}

// ─── Exercise Library ─────────────────────────────────────────────────────────

function ExerciseLibrary() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExerciseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ExerciseRow | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(runSearch, 250); // debounce
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exercises")
      .select("exercise_id, name, target_muscle, secondary_muscles")
      .ilike("name", `%${query.trim()}%`)
      .order("name", { ascending: true })
      .limit(30);
    setResults(data || []);
    setLoading(false);
  };

  return (
    <>
      <Text style={styles.subheading}>Search for any exercise.</Text>
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#555" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#22c55e" style={{ marginTop: 24 }} />
      ) : query.trim().length < 2 ? (
        <Text style={styles.hint}>Type at least 2 letters to search.</Text>
      ) : results.length === 0 ? (
        <Text style={styles.hint}>No exercises found for "{query}".</Text>
      ) : (
        results.map((ex) => (
          <Pressable key={ex.exercise_id} style={styles.resultRow} onPress={() => setSelected(ex)}>
            <Text style={styles.resultName}>{titleCase(ex.name)}</Text>
            {ex.target_muscle ? (
              <Text style={styles.resultMeta}>{titleCase(ex.target_muscle)}</Text>
            ) : null}
          </Pressable>
        ))
      )}

      {selected && (
        <ExerciseDetailModal exercise={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

// ─── Exercise Detail (history + GIF demo) ─────────────────────────────────────

function ExerciseDetailModal({ exercise, onClose }: { exercise: ExerciseRow; onClose: () => void }) {
  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY || "";
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDemo, setShowDemo] = useState(false);

  const gifUrl = `https://exercisedb.p.rapidapi.com/image?exerciseId=${encodeURIComponent(
    exercise.exercise_id
  )}&resolution=360&rapidapi-key=${apiKey}`;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    // Find every time the user logged this exercise (case-insensitive), then get
    // recency from the parent workout's completed_at (workout_exercises has none).
    const { data: exRows } = await supabase
      .from("workout_exercises")
      .select("id, workout_id")
      .eq("user_id", userData.user.id)
      .ilike("exercise_name", exercise.name);

    if (!exRows || exRows.length === 0) { setHistory([]); setLoading(false); return; }

    const workoutIds = [...new Set(exRows.map((r) => r.workout_id))];
    const { data: workouts } = await supabase
      .from("workouts")
      .select("id, completed_at")
      .in("id", workoutIds)
      .not("completed_at", "is", null);

    const completedById: Record<string, string> = {};
    for (const w of workouts || []) completedById[w.id] = w.completed_at;

    const exIds = exRows.map((r) => r.id);
    const { data: sets } = await supabase
      .from("exercise_sets")
      .select("workout_exercise_id, set_number, reps, weight_lbs, duration_seconds")
      .in("workout_exercise_id", exIds)
      .order("set_number", { ascending: true });

    // Group sets by their workout_exercise → attach the workout date.
    const exToWorkout: Record<string, string> = {};
    for (const r of exRows) exToWorkout[r.id] = r.workout_id;

    const entriesByExId: Record<string, HistoryEntry> = {};
    for (const s of sets || []) {
      const wid = exToWorkout[s.workout_exercise_id];
      const date = completedById[wid];
      if (!date) continue; // skip not-completed workouts
      if (!entriesByExId[s.workout_exercise_id]) {
        entriesByExId[s.workout_exercise_id] = { date, sets: [] };
      }
      entriesByExId[s.workout_exercise_id].sets.push(s);
    }

    // Newest first.
    const entries = Object.values(entriesByExId).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    setHistory(entries);
    setLoading(false);
  };

  const renderSet = (s: HistorySet): string => {
    if (s.duration_seconds != null) {
      const secs = s.duration_seconds;
      return secs >= 60 ? `${Math.round((secs / 60) * 10) / 10} min` : `${secs}s`;
    }
    const w = s.weight_lbs != null ? `${s.weight_lbs} lb` : "";
    const r = s.reps != null ? `${s.reps}` : "";
    if (w && r) return `${w} × ${r}`;
    return w || (r ? `${r} reps` : "—");
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{titleCase(exercise.name)}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <Pressable style={styles.demoBtn} onPress={() => setShowDemo((v) => !v)}>
            <MaterialCommunityIcons name="play-circle" size={20} color="#000" />
            <Text style={styles.demoBtnText}>{showDemo ? "Hide Demo" : "View Demo"}</Text>
          </Pressable>

          {showDemo && (
            <View style={styles.gifWrap}>
              <Image source={{ uri: gifUrl }} style={styles.gif} resizeMode="contain" />
            </View>
          )}

          <Text style={styles.historyLabel}>Your History</Text>
          <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator color="#22c55e" style={{ marginTop: 20 }} />
            ) : history.length === 0 ? (
              <Text style={styles.hint}>No history yet — you haven't logged this exercise.</Text>
            ) : (
              history.map((entry, i) => (
                <View key={i} style={styles.historyEntry}>
                  <Text style={styles.historyDate}>{fmtDate(entry.date)}</Text>
                  <View style={styles.historySets}>
                    {entry.sets
                      .sort((a, b) => a.set_number - b.set_number)
                      .map((s, si) => (
                        <Text key={si} style={styles.historySet}>
                          Set {s.set_number}: {renderSet(s)}
                        </Text>
                      ))}
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

// ─── Drill Library ────────────────────────────────────────────────────────────

function DrillLibrary() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrillRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DrillRow | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(runSearch, 250);
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("drills")
      .select("id, name, category, description, focus_areas, youtube_url, video_start, video_end")
      .ilike("name", `%${query.trim()}%`)
      .order("name", { ascending: true })
      .limit(30);
    setResults(data || []);
    setLoading(false);
  };

  return (
    <>
      <Text style={styles.subheading}>Search for any drill.</Text>
      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drills..."
          placeholderTextColor="#555"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#555" />
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#22c55e" style={{ marginTop: 24 }} />
      ) : query.trim().length < 2 ? (
        <Text style={styles.hint}>Type at least 2 letters to search.</Text>
      ) : results.length === 0 ? (
        <Text style={styles.hint}>No drills found for "{query}".</Text>
      ) : (
        results.map((d) => (
          <Pressable key={d.id} style={styles.resultRow} onPress={() => setSelected(d)}>
            <Text style={styles.resultName}>{d.name}</Text>
            {d.category ? <Text style={styles.resultMeta}>{d.category}</Text> : null}
          </Pressable>
        ))
      )}

      {selected && <DrillDetailModal drill={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

// ─── Drill Detail (description + YouTube demo) ────────────────────────────────

function DrillDetailModal({ drill, onClose }: { drill: DrillRow; onClose: () => void }) {
  const [showDemo, setShowDemo] = useState(false);
  const [history, setHistory] = useState<{ date: string; durationSeconds: number | null }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const ytId = drill.youtube_url ? extractYoutubeId(drill.youtube_url) : null;

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoadingHistory(false); return; }

    // Every time the user did this drill (by name), with the parent workout's
    // completion date. Drills have no weights/reps — just when it was done, plus
    // a logged duration if one exists.
    const { data: exRows } = await supabase
      .from("workout_exercises")
      .select("id, workout_id")
      .eq("user_id", userData.user.id)
      .eq("skipped", false)
      .ilike("exercise_name", drill.name);

    if (!exRows || exRows.length === 0) { setHistory([]); setLoadingHistory(false); return; }

    const workoutIds = [...new Set(exRows.map((r) => r.workout_id))];
    const { data: workouts } = await supabase
      .from("workouts")
      .select("id, completed_at")
      .in("id", workoutIds)
      .not("completed_at", "is", null);

    const completedById: Record<string, string> = {};
    for (const w of workouts || []) completedById[w.id] = w.completed_at;

    // Pull any logged duration for these drill instances.
    const exIds = exRows.map((r) => r.id);
    const { data: sets } = await supabase
      .from("exercise_sets")
      .select("workout_exercise_id, duration_seconds")
      .in("workout_exercise_id", exIds);

    const durationByExId: Record<string, number | null> = {};
    for (const s of sets || []) {
      // If multiple sets, keep the longest logged duration for that instance.
      const prev = durationByExId[s.workout_exercise_id];
      if (s.duration_seconds != null && (prev == null || s.duration_seconds > prev)) {
        durationByExId[s.workout_exercise_id] = s.duration_seconds;
      }
    }

    const entries = exRows
      .map((r) => ({
        date: completedById[r.workout_id],
        durationSeconds: durationByExId[r.id] ?? null,
      }))
      .filter((e) => !!e.date) // only completed workouts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first

    setHistory(entries);
    setLoadingHistory(false);
  };

  const fmtDuration = (secs: number): string =>
    secs >= 60 ? `${Math.round((secs / 60) * 10) / 10} min` : `${secs}s`;

  const openDemo = () => {
    if (ytId) {
      setShowDemo((v) => !v);
    } else if (drill.youtube_url) {
      Linking.openURL(drill.youtube_url);
    } else {
      const q = encodeURIComponent(`${drill.name} pickleball drill`);
      Linking.openURL(`https://www.youtube.com/results?search_query=${q}`);
    }
  };

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{drill.name}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {drill.focus_areas && drill.focus_areas.length > 0 && (
            <View style={styles.chipRow}>
              {drill.focus_areas.map((f) => (
                <View key={f} style={styles.chip}>
                  <Text style={styles.chipText}>{f}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable style={styles.demoBtn} onPress={openDemo}>
            <MaterialCommunityIcons name="play-circle" size={20} color="#000" />
            <Text style={styles.demoBtnText}>{showDemo ? "Hide Demo" : "View Demo"}</Text>
          </Pressable>

          {showDemo && ytId && (
            <View style={styles.videoWrap}>
              <YoutubePlayer
                height={200}
                videoId={ytId}
                initialPlayerParams={{
                  start: drill.video_start ?? undefined,
                  end: drill.video_end ?? undefined,
                }}
              />
            </View>
          )}

          {drill.description ? (
            <>
              <Text style={styles.historyLabel}>About</Text>
              <Text style={styles.drillDesc}>{drill.description}</Text>
            </>
          ) : null}

          <Text style={[styles.historyLabel, { marginTop: 18 }]}>Your History</Text>
          <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
            {loadingHistory ? (
              <ActivityIndicator color="#22c55e" style={{ marginTop: 16 }} />
            ) : history.length === 0 ? (
              <Text style={styles.hint}>No history yet — you haven't done this drill.</Text>
            ) : (
              history.map((entry, i) => (
                <View key={i} style={styles.drillHistoryRow}>
                  <Text style={styles.historyDate}>{fmtDate(entry.date)}</Text>
                  {entry.durationSeconds != null && (
                    <Text style={styles.drillHistoryDuration}>{fmtDuration(entry.durationSeconds)}</Text>
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#22c55e";
const GREEN_DIM = "#14532d";
const GREEN_BRIGHT = "#4ade80";
const BG = "#111";
const SURFACE = "#1a1a1a";
const SURFACE2 = "#252525";
const BORDER = "#2a2a2a";
const TEXT_MUTED = "#888";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 20, paddingTop: 70, paddingBottom: 140 },

  backBtn: { marginBottom: 20 },
  backBtnText: { color: GREEN, fontSize: 16, fontWeight: "600" },

  heading: { color: "#fff", fontSize: 32, fontWeight: "700", marginBottom: 6 },
  subheading: { color: TEXT_MUTED, fontSize: 15, marginBottom: 24 },

  // picker cards
  pickCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: SURFACE, borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 0.5, borderColor: BORDER,
  },
  pickIcon: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: "#0d1f0d",
    justifyContent: "center", alignItems: "center",
  },
  pickTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginBottom: 3 },
  pickSub: { color: TEXT_MUTED, fontSize: 13, lineHeight: 18 },
  pickArrow: { color: "#555", fontSize: 24 },

  // search
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: SURFACE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 0.5, borderColor: BORDER, marginBottom: 16,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 15 },

  hint: { color: TEXT_MUTED, fontSize: 14, textAlign: "center", marginTop: 24, lineHeight: 20 },

  resultRow: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 15, marginBottom: 8,
    borderWidth: 0.5, borderColor: BORDER,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  resultName: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },
  resultMeta: { color: TEXT_MUTED, fontSize: 12, marginLeft: 8 },

  // detail modal
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0f0f0f", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40, maxHeight: "88%",
  },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  sheetTitle: { color: "#fff", fontSize: 20, fontWeight: "700", flex: 1, paddingRight: 12 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  closeBtnText: { color: "#fff", fontSize: 13 },

  demoBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: GREEN, borderRadius: 14, paddingVertical: 13, marginBottom: 16,
  },
  demoBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },

  gifWrap: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  gif: { width: "100%", height: 240 },
  videoWrap: { borderRadius: 14, overflow: "hidden", marginBottom: 16 },

  historyLabel: { color: TEXT_MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },

  historyEntry: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 0.5, borderColor: BORDER,
  },
  historyDate: { color: GREEN_BRIGHT, fontSize: 13, fontWeight: "700", marginBottom: 8 },
  historySets: { gap: 4 },
  historySet: { color: "#ddd", fontSize: 14 },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  chip: { backgroundColor: GREEN_DIM, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { color: GREEN_BRIGHT, fontSize: 12, fontWeight: "600" },

  drillDesc: { color: "#ddd", fontSize: 14, lineHeight: 21 },

  drillHistoryRow: {
    backgroundColor: SURFACE, borderRadius: 12, padding: 14, marginBottom: 8,
    borderWidth: 0.5, borderColor: BORDER,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  drillHistoryDuration: { color: TEXT_MUTED, fontSize: 13, fontWeight: "600" },
});