import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import YoutubePlayer from "react-native-youtube-iframe";
import { supabase } from "./lib/supabase";
import {
  awardXpAndBadges,
  calcWorkoutXp,
  estimateExerciseMinutes,
  type AwardResult
} from "./lib/xp";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExerciseSet {
  setNumber: number;
  reps: string;
  weight: string;
  duration: string;
  durationValue: string;
  durationUnit: string;
  logged: boolean;
  lastWeight?: string; // placeholder: weight from this set last time
  lastReps?: string;   // placeholder: reps from this set last time
  lastDuration?: string; // placeholder: duration value from this set last time
}

interface Exercise {
  name: string;
  sessionType: string;
  orderIndex: number;
  sets: ExerciseSet[];
  notes: string;
  userNotes?: string;
  skipped: boolean;
  isTimed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

const SESSION_LABELS: Record<string, string> = {
  warmup: "Warmup",
  workout: "Workout",
  "pickleball skill work": "Pickleball Skill Work",
  cooldown: "Cooldown",
  fitness: "Fitness",
  rest: "Rest",
  "active recovery": "Active Recovery",
};

const SESSION_EMOJI: Record<string, string> = {
  warmup: "🔥",
  workout: "🏋️",
  "pickleball skill work": "🏓",
  cooldown: "🧊",
  fitness: "⚡",
  rest: "😴",
  "active recovery": "🌿",
};

const SESSION_TYPE_KEYS = [
  "warmup", "workout", "pickleball skill work",
  "cooldown", "fitness", "rest", "active recovery",
];

const detectSessionType = (line: string): string | null => {
  const lower = line.toLowerCase().replace(/[:\*]/g, "").trim();
  return SESSION_TYPE_KEYS.find((k) => lower.startsWith(k)) || null;
};

const stripBold = (t: string) => t.replace(/\*\*/g, "").trim();

const hasTimeHint = (detail: string): boolean =>
  /\d+\s*(sec|s\b|min|minute|seconds|minutes)/i.test(detail);

const hasRepHint = (detail: string): boolean =>
  /\d+\s*(x|×)\s*\d+|\d+\s*(reps?|sets?)/i.test(detail);

// An explicit duration prescription like "45 seconds", "30 sec", "2 min".
// This is stronger than a passing time mention — if the exercise prescribes a
// duration, it's timed even if "sets" is also present (e.g. "3 sets x 45 sec").
const hasDurationPrescription = (detail: string): boolean =>
  /\b\d+\s*(sec|secs|second|seconds|min|mins|minute|minutes)\b/i.test(detail);

// Exercises that are inherently time-based regardless of how the plan phrases
// them. Matched case-insensitively against the exercise name. Add to this list
// whenever a timed exercise slips through as reps/lbs.
const INHERENTLY_TIMED = [
  "air bike", "balance board", "plank", "wall sit", "wall-sit",
  "dead hang", "hollow hold", "hollow body hold", "l-sit", "l sit",
  "side plank", "superman hold", "boat pose", "bridge hold",
  "farmer carry", "farmers carry", "farmer's carry", "farmers walk",
  "battle rope", "battle ropes", "jump rope", "jumping rope",
  "mountain climber", "high knees", "butt kicks", "jumping jacks",
  "bear crawl", "flutter kick", "flutter kicks", "stationary bike",
  "treadmill", "elliptical", "rowing", "row machine", "rower",
  "ski erg", "assault bike", "isometric hold", "static hold",
];

const isInherentlyTimed = (name: string): boolean => {
  const n = name.toLowerCase();
  return INHERENTLY_TIMED.some((t) => n.includes(t));
};

const TIMED_SESSION_TYPES = new Set([
  "warmup", "cooldown", "pickleball skill work", "active recovery",
]);

const REPS_SESSION_TYPES = new Set(["workout", "fitness"]);

const isTimedExercise = (sessionType: string, detail: string, name = ""): boolean => {
  // Inherently timed exercises (Air Bike, Plank, etc.) are always timed,
  // regardless of session type or how the plan phrases sets/reps.
  if (name && isInherentlyTimed(name)) return true;

  // An explicit duration prescription ("45 sec", "2 min") means timed — even if
  // "sets" is also present (e.g. "3 sets x 45 seconds" is timed, not reps).
  if (hasDurationPrescription(detail)) return true;

  // Strength sessions are otherwise reps-based by nature. Their instructions
  // often mention seconds incidentally ("rest 60 sec"), which should NOT make
  // the whole exercise timed. So for workout/fitness, only treat as timed if
  // there's a time hint AND no rep hint at all.
  if (REPS_SESSION_TYPES.has(sessionType)) {
    return hasTimeHint(detail) && !hasRepHint(detail);
  }
  // For other sessions (warmup, cooldown, skill work, recovery): time-first.
  if (hasTimeHint(detail)) return true;
  if (hasRepHint(detail)) return false;
  if (TIMED_SESSION_TYPES.has(sessionType)) return true;
  return false;
};

const IS_PICKLEBALL = (sessionType: string) => sessionType === "pickleball skill work";
const IS_GIF_DEMO = (sessionType: string) =>
  sessionType === "workout" || sessionType === "fitness";

const extractYoutubeId = (url: string): string | null => {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

const parseDayExercises = (dayText: string): Exercise[] => {
  const lines = dayText.split("\n").map((l) => l.trim()).filter(Boolean);
  const exercises: Exercise[] = [];
  let currentSessionType = "workout";
  let orderIndex = 0;

  for (const line of lines.slice(1)) {
    const sessionType = detectSessionType(line);
    if (sessionType) { currentSessionType = sessionType; continue; }

    if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) {
      const cleaned = stripBold(line).replace(/^[-•*]\s*/, "").trim();
      let name = cleaned;
      let detail = "";
      const colonIdx = cleaned.indexOf(":");
      const dashIdx = cleaned.indexOf(" — ");
      if (colonIdx !== -1) {
        name = cleaned.slice(0, colonIdx).trim();
        detail = cleaned.slice(colonIdx + 1).trim();
      } else if (dashIdx !== -1) {
        name = cleaned.slice(0, dashIdx).trim();
        detail = cleaned.slice(dashIdx + 3).trim();
      }
      if (!name) continue;

      const timed = isTimedExercise(currentSessionType, detail, name);
      const durationMatch = detail.match(/(\d+)\s*(sec|s|min|minute)/i);
      const repMatch = detail.match(/(\d+)\s*(x|×)\s*(\d+)/i);

      const prefillDuration = timed && durationMatch
        ? durationMatch[2].toLowerCase().startsWith("min")
          ? `${durationMatch[1]}min`
          : `${durationMatch[1]}s`
        : "";
      const prefillReps = !timed && repMatch ? repMatch[3] : "";

      // Set count: prefer an explicit "N sets" (e.g. "3 sets x 8-10 reps"),
      // then fall back to the "NxM" shorthand (e.g. "3x10"), else 1.
      const setsWordMatch = detail.match(/(\d+)\s*sets?/i);
      const prefillSets = setsWordMatch
        ? parseInt(setsWordMatch[1])
        : repMatch
        ? parseInt(repMatch[1])
        : 1;
      const numSets = Math.min(Math.max(prefillSets, 1), 6);

      exercises.push({
        name,
        sessionType: currentSessionType,
        orderIndex: orderIndex++,
        notes: detail,
        skipped: false,
        isTimed: timed,
        sets: Array.from({ length: numSets }, (_, i) => ({
          setNumber: i + 1,
          reps: prefillReps,
          weight: "",
          duration: prefillDuration,
          durationValue: "",
          durationUnit: durationMatch
            ? durationMatch[2].toLowerCase().startsWith("min") ? "min" : "s"
            : "s",
          logged: false,
        })),
      });
    }
  }
  return exercises;
};

// ─── Duration Picker Modal ────────────────────────────────────────────────────

const UNIT_OPTIONS = ["s", "min", "hr"];
const UNIT_LABELS: Record<string, string> = { s: "seconds", min: "minutes", hr: "hours" };

function UnitPickerModal({
  visible, current, onSelect, onClose,
}: {
  visible: boolean; current: string; onSelect: (val: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1 }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.durationSheet}>
          <View style={styles.durationSheetHeader}>
            <Text style={styles.durationSheetTitle}>Select Unit</Text>
            <Pressable onPress={onClose} style={styles.durationCloseBtn}>
              <Text style={styles.durationCloseBtnText}>✕</Text>
            </Pressable>
          </View>
          {UNIT_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              style={styles.durationOption}
              onPress={() => { onSelect(opt); onClose(); }}
            >
              <Text style={[styles.durationOptionText, current === opt && styles.durationOptionTextActive]}>
                {opt} <Text style={{ color: "#555", fontSize: 13 }}>({UNIT_LABELS[opt]})</Text>
              </Text>
              {current === opt && <Text style={styles.durationOptionCheck}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ─── Rest Timer Modal ─────────────────────────────────────────────────────────

function RestTimerModal({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const [seconds, setSeconds] = useState(60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) {
      setSeconds(60);
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) { clearInterval(intervalRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [visible]);

  const adjust = (delta: number) => setSeconds((s) => Math.max(0, s + delta));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Rest Timer</Text>
          <Text style={styles.restTimerText}>{formatTime(seconds)}</Text>
          <View style={styles.restAdjustRow}>
            <Pressable style={styles.adjustBtn} onPress={() => adjust(-15)}>
              <Text style={styles.adjustBtnText}>−15s</Text>
            </Pressable>
            <Pressable style={styles.adjustBtn} onPress={() => adjust(15)}>
              <Text style={styles.adjustBtnText}>+15s</Text>
            </Pressable>
            <Pressable style={styles.adjustBtn} onPress={() => adjust(30)}>
              <Text style={styles.adjustBtnText}>+30s</Text>
            </Pressable>
          </View>
          <Pressable style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissBtnText}>Skip Rest</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── GIF Demo Modal (workout / fitness) ──────────────────────────────────────

function GifDemoModal({
  visible,
  exerciseName,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
}) {
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [muscles, setMuscles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const apiKey = process.env.EXPO_PUBLIC_RAPIDAPI_KEY || "";

  useEffect(() => {
    if (visible && exerciseName) {
      fetchExercise();
    }
  }, [visible, exerciseName]);

  const fetchExercise = async () => {
    setLoading(true);
    setGifUrl(null);
    setMuscles([]);

    const name = exerciseName.trim();

    // 1. Try an exact (case-insensitive) match first — the common case now that
    //    generate-plan snaps names to the library.
    let { data } = await supabase
      .from("exercises")
      .select("exercise_id, target_muscle, secondary_muscles")
      .ilike("name", name)
      .maybeSingle();

    // 2. Fallback: normalized match. Catches any name that slipped through
    //    unsnapped (e.g. "biceps" vs "bicep", word order, punctuation).
    if (!data) {
      const normalize = (s: string): string => {
        const cleaned = s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        return cleaned
          .split(" ")
          .map((w) => {
            if (w === "biceps") return "bicep";
            if (w === "triceps") return "tricep";
            if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
            if (w.endsWith("s") && w.length > 3) return w.slice(0, -1);
            return w;
          })
          .sort()
          .join(" ");
      };

      // Pull candidates that share the first significant word, then match by
      // normalized form in code (keeps the query cheap, match precise).
      const firstWord = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim().split(" ")[0];
      if (firstWord) {
        const { data: candidates } = await supabase
          .from("exercises")
          .select("name, exercise_id, target_muscle, secondary_muscles")
          .ilike("name", `%${firstWord}%`)
          .limit(50);

        const target = normalize(name);
        const hit = (candidates || []).find((c) => normalize(c.name) === target);
        if (hit) data = hit;
      }
    }

    if (data?.exercise_id) {
      setGifUrl(
        `https://exercisedb.p.rapidapi.com/image?exerciseId=${encodeURIComponent(data.exercise_id)}&resolution=360&rapidapi-key=${apiKey}`
      );
      const allMuscles = [
        ...(data.target_muscle ? [data.target_muscle] : []),
        ...(data.secondary_muscles || []),
      ];
      setMuscles([...new Set(allMuscles)]);
      setLoading(false);
      return;
    }

    // Not in the table at all (e.g. a warmup/cooldown movement). Fall back to a
    // YouTube search rather than show nothing.
    setLoading(false);
    onClose();
    const q = encodeURIComponent(`${exerciseName} exercise form tutorial`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${q}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.demoOverlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.demoSheet}>
          <View style={styles.demoSheetHeader}>
            <Text style={styles.demoSheetTitle} numberOfLines={1}>{exerciseName}</Text>
            <Pressable onPress={onClose} style={styles.demoCloseBtn}>
              <Text style={styles.demoCloseBtnText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#22c55e" style={{ marginVertical: 40 }} />
          ) : (
            <>
              {gifUrl && (
                <Image
                  source={{ uri: gifUrl }}
                  style={styles.demoGif}
                  resizeMode="contain"
                />
              )}
              {muscles.length > 0 && (
                <View style={styles.demoMusclesBlock}>
                  <Text style={styles.demoMusclesLabel}>Muscles Worked</Text>
                  <View style={styles.demoMusclesRow}>
                    {muscles.map((m, i) => (
                      <View key={i} style={styles.demoMusclePill}>
                        <Text style={styles.demoMusclePillText}>
                          {m.charAt(0).toUpperCase() + m.slice(1)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── YouTube Demo Modal (pickleball skill work) ───────────────────────────────

function YoutubeDemoModal({
  visible,
  exerciseName,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  onClose: () => void;
}) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoStart, setVideoStart] = useState<number | null>(null);
  const [videoEnd, setVideoEnd] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && exerciseName) {
      fetchDrillVideo();
    }
  }, [visible, exerciseName]);

  const fetchDrillVideo = async () => {
    setLoading(true);
    setVideoId(null);
    setVideoStart(null);
    setVideoEnd(null);

    // Try to find the drill in Supabase by name
    const { data } = await supabase
      .from("drills")
      .select("youtube_url, video_start, video_end")
      .ilike("name", exerciseName.trim())
      .maybeSingle();

    if (data?.youtube_url) {
      const id = extractYoutubeId(data.youtube_url);
      if (id) {
        setVideoId(id);
        setVideoStart(data.video_start ?? null);
        setVideoEnd(data.video_end ?? null);
        setLoading(false);
        return;
      }
    }

    // Fallback: open YouTube search in browser
    setLoading(false);
    onClose();
    const query = encodeURIComponent(`${exerciseName} pickleball drill tutorial`);
    Linking.openURL(`https://www.youtube.com/results?search_query=${query}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.demoOverlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.demoSheet}>
          <View style={styles.demoSheetHeader}>
            <Text style={styles.demoSheetTitle} numberOfLines={1}>{exerciseName}</Text>
            <Pressable onPress={onClose} style={styles.demoCloseBtn}>
              <Text style={styles.demoCloseBtnText}>✕</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color="#22c55e" style={{ marginVertical: 40 }} />
          ) : videoId ? (
            <View style={styles.demoYoutubeWrapper}>
              <YoutubePlayer
                height={220}
                videoId={videoId}
                play={true}
                initialPlayerParams={{
                  // Only set when present; null/undefined are ignored by the player.
                  ...(videoStart != null ? { start: videoStart } : {}),
                  ...(videoEnd != null ? { end: videoEnd } : {}),
                }}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  exercise,
  onChange,
  onRestTimer,
}: {
  exercise: Exercise;
  onChange: (updated: Exercise) => void;
  onRestTimer: () => void;
}) {
  const [unitPickerIndex, setUnitPickerIndex] = useState<number | null>(null);
  const [gifDemoVisible, setGifDemoVisible] = useState(false);
  const [youtubeDemoVisible, setYoutubeDemoVisible] = useState(false);

  const handleDemoPress = () => {
    if (IS_PICKLEBALL(exercise.sessionType)) {
      setYoutubeDemoVisible(true);
    } else if (IS_GIF_DEMO(exercise.sessionType)) {
      setGifDemoVisible(true);
    }
  };

  const showDemoBtn =
    IS_PICKLEBALL(exercise.sessionType) || IS_GIF_DEMO(exercise.sessionType);

  const updateSet = (setIndex: number, field: keyof ExerciseSet, value: string | boolean) => {
    const updatedSets = exercise.sets.map((s, i) =>
      i === setIndex ? { ...s, [field]: value } : s
    );
    onChange({ ...exercise, sets: updatedSets });
  };

  const addSet = () => {
    onChange({
      ...exercise,
      sets: [...exercise.sets, {
        setNumber: exercise.sets.length + 1,
        reps: "", weight: "", duration: "",
        durationValue: "", durationUnit: "s",
        logged: false,
      }],
    });
  };

  const removeSet = () => {
    if (exercise.sets.length <= 1) return;
    onChange({ ...exercise, sets: exercise.sets.slice(0, -1) });
  };

  const toggleLog = (setIndex: number) => {
    const alreadyLogged = exercise.sets[setIndex].logged;
    updateSet(setIndex, "logged", !alreadyLogged);
    if (!alreadyLogged) onRestTimer();
  };

  const SET_W = 32;
  const DONE_W = 52;

  const durationDisplay = (() => {
    if (!exercise.notes) return null;
    const match = exercise.notes.match(/(\d+)\s*(sec|s\b|min|minute|seconds|minutes)/i);
    if (!match) return null;
    const num = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const totalSeconds = unit.startsWith("min") ? num * 60 : num;
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  })();

  return (
    <View style={[styles.exerciseCard, exercise.skipped && styles.exerciseCardSkipped]}>
      <View style={styles.exerciseHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>

          {durationDisplay && (
            <Text style={styles.exerciseDuration}>⏱ {durationDisplay}</Text>
          )}

          {showDemoBtn && (
            <Pressable onPress={handleDemoPress} style={styles.demoBtn}>
              <Text style={styles.demoBtnText}>▶ Demo</Text>
            </Pressable>
          )}

          <Text style={styles.exerciseSessionType}>
            {SESSION_EMOJI[exercise.sessionType] || "•"}{" "}
            {SESSION_LABELS[exercise.sessionType] || exercise.sessionType}
          </Text>

          {exercise.notes ? (
            <Text style={styles.exerciseInstruction}>{exercise.notes}</Text>
          ) : null}
        </View>
        <Pressable
          style={[styles.skipBtn, exercise.skipped && styles.skipBtnActive]}
          onPress={() => onChange({ ...exercise, skipped: !exercise.skipped })}
        >
          <Text style={[styles.skipBtnText, exercise.skipped && styles.skipBtnTextActive]}>
            {exercise.skipped ? "Undo" : "Skip"}
          </Text>
        </Pressable>
      </View>

      {!exercise.skipped && (
        <>
          <View style={[styles.setHeaderRow, { gap: 8 }]}>
            <View style={{ width: SET_W, alignItems: "center" }}>
              <Text style={styles.setHeaderText}>SET</Text>
            </View>
            {exercise.isTimed ? (
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={styles.setHeaderText}>DURATION</Text>
              </View>
            ) : (
              <>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={styles.setHeaderText}>REPS</Text>
                </View>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={styles.setHeaderText}>LBS</Text>
                </View>
              </>
            )}
            <View style={{ width: DONE_W, alignItems: "center" }}>
              <Text style={styles.setHeaderText}>DONE</Text>
            </View>
          </View>

          {exercise.sets.map((set, i) => (
            <View key={i} style={[styles.setRow, { gap: 8 }]}>
              <View style={[styles.setNumBadge, { width: SET_W }]}>
                <Text style={styles.setNumText}>{set.setNumber}</Text>
              </View>

              {exercise.isTimed ? (
                <View style={[styles.setInputWide, { flexDirection: "row", gap: 6 }]}>
                  <TextInput
                    style={[styles.setInput, { flex: 1 }]}
                    placeholder={set.lastDuration ?? "0"}
                    placeholderTextColor="#555"
                    value={set.durationValue}
                    onChangeText={(v) => {
                      const updatedSets = exercise.sets.map((s, si) =>
                        si === i ? { ...s, durationValue: v, duration: `${v}${s.durationUnit}` } : s
                      );
                      onChange({ ...exercise, sets: updatedSets });
                    }}
                    keyboardType="numeric"
                  />
                  <Pressable
                    style={styles.unitPickerBtn}
                    onPress={() => setUnitPickerIndex(i)}
                  >
                    <Text style={styles.unitPickerText}>{set.durationUnit}</Text>
                    <Text style={styles.unitPickerArrow}>▾</Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.setInput}
                    placeholder={set.lastReps ?? "0"}
                    placeholderTextColor="#555"
                    value={set.reps}
                    onChangeText={(v) => updateSet(i, "reps", v)}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={styles.setInput}
                    placeholder={set.lastWeight ?? "0"}
                    placeholderTextColor="#555"
                    value={set.weight}
                    onChangeText={(v) => updateSet(i, "weight", v)}
                    keyboardType="decimal-pad"
                  />
                </>
              )}

              <Pressable
                style={[styles.logSetBtn, { width: DONE_W }, set.logged && styles.logSetBtnDone]}
                onPress={() => toggleLog(i)}
              >
                <Text style={[styles.logSetBtnText, set.logged && styles.logSetBtnTextDone]}>
                  {set.logged ? "✓" : "○"}
                </Text>
              </Pressable>
            </View>
          ))}

          <View style={styles.setActionsRow}>
            <Pressable style={styles.addSetBtn} onPress={addSet}>
              <Text style={styles.addSetBtnText}>+ Add Set</Text>
            </Pressable>
            {exercise.sets.length > 1 && (
              <Pressable style={styles.removeSetBtn} onPress={removeSet}>
                <Text style={styles.removeSetBtnText}>− Remove Set</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            style={styles.notesInput}
            placeholder="Add your own notes..."
            placeholderTextColor="#555"
            value={exercise.userNotes ?? ""}
            onChangeText={(v) => onChange({ ...exercise, userNotes: v })}
            multiline
          />
        </>
      )}

      {unitPickerIndex !== null && (
        <UnitPickerModal
          visible
          current={exercise.sets[unitPickerIndex]?.durationUnit ?? "s"}
          onSelect={(val) => {
            const updatedSets = exercise.sets.map((s, si) =>
              si === unitPickerIndex ? { ...s, durationUnit: val, duration: `${s.durationValue}${val}` } : s
            );
            onChange({ ...exercise, sets: updatedSets });
          }}
          onClose={() => setUnitPickerIndex(null)}
        />
      )}

      {/* GIF demo modal for workout/fitness */}
      <GifDemoModal
        visible={gifDemoVisible}
        exerciseName={exercise.name}
        onClose={() => setGifDemoVisible(false)}
      />

      {/* YouTube demo modal for pickleball skill work */}
      <YoutubeDemoModal
        visible={youtubeDemoVisible}
        exerciseName={exercise.name}
        onClose={() => setYoutubeDemoVisible(false)}
      />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function WorkoutActiveScreen() {
  const { dayText, dayNumber, theme } = useLocalSearchParams<{
    dayText: string; dayNumber: string; theme: string;
  }>();
  const router = useRouter();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [surveyVisible, setSurveyVisible] = useState(false);
  const [completedDuration, setCompletedDuration] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [energyLevel, setEnergyLevel] = useState(0);
  const [satisfaction, setSatisfaction] = useState(0);
  const [painDiscomfort, setPainDiscomfort] = useState("");
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [awardResult, setAwardResult] = useState<AwardResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (dayText) {
      const parsed = parseDayExercises(decodeURIComponent(dayText));
      setExercises(parsed);
      enrichWithLastPerformance(parsed); // fill per-set placeholders from history
    }
    startWorkout();
    timerRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // For each exercise, find the user's most recent past performance (by name)
  // and attach per-set weight/reps as placeholders (Strong-style "last time").
  const enrichWithLastPerformance = async (parsed: Exercise[]) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const names = [...new Set(parsed.map((e) => e.name))];
    if (names.length === 0) return;

    // Find this user's past logged exercises with these names. workout_exercises
    // has no timestamp, so we get recency from the parent workout's completed_at.
    const { data: pastExercises } = await supabase
      .from("workout_exercises")
      .select("id, exercise_name, workout_id")
      .eq("user_id", userData.user.id)
      .in("exercise_name", names);

    if (!pastExercises || pastExercises.length === 0) return;

    // Look up completed_at for those workouts to determine which is most recent.
    const workoutIds = [...new Set(pastExercises.map((pe) => pe.workout_id))];
    const { data: workoutRows } = await supabase
      .from("workouts")
      .select("id, completed_at")
      .in("id", workoutIds)
      .not("completed_at", "is", null);

    const completedAtById: Record<string, number> = {};
    for (const w of workoutRows || []) {
      completedAtById[w.id] = new Date(w.completed_at).getTime();
    }

    // For each exercise name, pick the workout_exercise from the most recently
    // completed workout.
    const latestByName: Record<string, { exId: string; when: number }> = {};
    for (const pe of pastExercises) {
      const when = completedAtById[pe.workout_id];
      if (when == null) continue; // skip not-yet-completed workouts
      const current = latestByName[pe.exercise_name];
      if (!current || when > current.when) {
        latestByName[pe.exercise_name] = { exId: pe.id, when };
      }
    }

    const latestIds = Object.values(latestByName).map((v) => v.exId);
    if (latestIds.length === 0) return;

    // Pull the sets for those most-recent exercises.
    const { data: pastSets } = await supabase
      .from("exercise_sets")
      .select("workout_exercise_id, set_number, weight_lbs, reps, duration_seconds")
      .in("workout_exercise_id", latestIds)
      .order("set_number", { ascending: true });

    if (!pastSets || pastSets.length === 0) return;

    // Group past sets by workout_exercise id.
    const setsByExId: Record<string, { set_number: number; weight_lbs: number; reps: number; duration_seconds: number }[]> = {};
    for (const s of pastSets as any[]) {
      (setsByExId[s.workout_exercise_id] ||= []).push(s);
    }

    // Convert stored seconds back to a value in the set's display unit.
    const secondsToUnit = (secs: number, unit: string): string => {
      if (unit === "min") return String(Math.round((secs / 60) * 10) / 10);
      if (unit === "hr") return String(Math.round((secs / 3600) * 10) / 10);
      return String(secs); // seconds
    };

    // Attach placeholders, matching by set number.
    setExercises((prev) =>
      prev.map((ex) => {
        const entry = latestByName[ex.name];
        const history = entry ? setsByExId[entry.exId] : null;
        if (!history) return ex;
        return {
          ...ex,
          sets: ex.sets.map((set) => {
            const match = history.find((h) => h.set_number === set.setNumber);
            if (!match) return set;
            return {
              ...set,
              lastWeight: match.weight_lbs != null ? String(match.weight_lbs) : undefined,
              lastReps: match.reps != null ? String(match.reps) : undefined,
              lastDuration:
                match.duration_seconds != null
                  ? secondsToUnit(match.duration_seconds, set.durationUnit)
                  : undefined,
            };
          }),
        };
      })
    );
  };

  const startWorkout = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data } = await supabase
      .from("workouts")
      .insert({
        user_id: userData.user.id,
        day_number: parseInt(dayNumber || "1"),
        theme: theme || "",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (data) setWorkoutId(data.id);
  };

  const updateExercise = (index: number, updated: Exercise) =>
    setExercises((prev) => prev.map((e, i) => (i === index ? updated : e)));

  const completeWorkout = async () => {
    if (!workoutId) return;

    // Require every exercise to be either skipped or have at least one logged
    // set with actual input. Prevents earning full XP on an empty workout.
    const hasRealInput = (s: ExerciseSet, timed: boolean): boolean =>
      timed
        ? !!(s.durationValue && s.durationValue.trim())
        : !!((s.reps && s.reps.trim()) || (s.weight && s.weight.trim()));

    const incomplete = exercises.filter((ex) => {
      if (ex.skipped) return false; // skipped is fine
      const loggedWithInput = ex.sets.some((s) => s.logged && hasRealInput(s, ex.isTimed));
      return !loggedWithInput; // not skipped AND nothing logged → incomplete
    });

    if (incomplete.length > 0) {
      const names = incomplete.slice(0, 3).map((e) => e.name).join(", ");
      const extra = incomplete.length > 3 ? `, +${incomplete.length - 3} more` : "";
      Alert.alert(
        "Finish logging first",
        `Please input all sets or skip these exercises before finishing:\n\n${names}${extra}`
      );
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setSaving(false); return; }
    const userId = userData.user.id;
    const durationSeconds = elapsedSeconds;

    await supabase.from("workouts").update({
      completed_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
    }).eq("id", workoutId);

    for (const exercise of exercises) {
      const { data: exRow } = await supabase
        .from("workout_exercises")
        .insert({
          workout_id: workoutId,
          user_id: userId,
          exercise_name: exercise.name,
          session_type: exercise.sessionType,
          order_index: exercise.orderIndex,
          skipped: exercise.skipped,
        })
        .select("id")
        .single();

      if (!exRow || exercise.skipped) continue;

      const setsToInsert = exercise.sets.filter((s) => s.logged).map((s) => ({
        workout_exercise_id: exRow.id,
        user_id: userId,
        set_number: s.setNumber,
        reps: s.reps ? parseInt(s.reps) : null,
        weight_lbs: s.weight ? parseFloat(s.weight) : null,
        duration_seconds: s.duration
          ? (() => {
              const raw = s.duration.trim().toLowerCase();
              const num = parseFloat(raw.replace(/[^0-9.]/g, ""));
              if (!num) return null;
              if (raw.includes("min")) return Math.round(num * 60);
              if (raw.includes("hr") || raw.includes("hour")) return Math.round(num * 3600);
              return Math.round(num);
            })()
          : null,
        completed_at: new Date().toISOString(),
      }));

      if (setsToInsert.length > 0) await supabase.from("exercise_sets").insert(setsToInsert);
      if (exercise.notes) {
        await supabase.from("workout_exercises").update({ notes: exercise.notes } as any).eq("id", exRow.id);
      }
    }

    // ── XP calculation ──
    // Net workout XP using time-based skip penalty
    const exerciseTimes = exercises.map((ex) => ({
      minutes: estimateExerciseMinutes(ex.notes, ex.sets.length),
      skipped: ex.skipped,
    }));
    const workoutXp = calcWorkoutXp(exerciseTimes);

    // Determine current streak + total workouts + plan completion
    const { data: completedWorkouts } = await supabase
      .from("workouts")
      .select("completed_at, day_number")
      .eq("user_id", userId)
      .not("completed_at", "is", null);

    const totalWorkouts = completedWorkouts?.length || 0;

    // Streak: count consecutive days up to today, treating scheduled REST days
    // as non-breaking (they don't add, but they don't reset the streak either).
    // This must match the streak shown on the progress page.
    const dates = (completedWorkouts || [])
      .map((w: any) => new Date(w.completed_at).toDateString())
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);

    // Fetch the plan once — used for both rest-date detection and plan completion.
    const { data: profileData } = await supabase
      .from("profiles")
      .select("plan_created_at, current_plan")
      .eq("id", userId)
      .maybeSingle();

    // Build the set of scheduled rest-day calendar dates from the current plan.
    const restDates = new Set<string>();
    if (profileData?.current_plan && profileData.plan_created_at) {
      const firstIdx = profileData.current_plan.search(/Day\s+1\s*:/i);
      const planBody = firstIdx >= 0 ? profileData.current_plan.slice(firstIdx) : profileData.current_plan;
      const dayChunks = planBody
        .replace(/^---+$/gm, "")
        .split(/(?=Day\s+\d+\s*:)/gi)
        .map((d: string) => d.trim())
        .filter(Boolean);

      const isRestChunk = (text: string): boolean => {
        const titleLine = (text.split("\n")[0] || "").toLowerCase();
        if (titleLine.includes("rest") || titleLine.includes("recovery")) return true;
        return !/(workout:|fitness:|pickleball skill work:)/i.test(text);
      };

      const planStart = new Date(profileData.plan_created_at);
      planStart.setHours(0, 0, 0, 0);
      dayChunks.forEach((chunk: string, i: number) => {
        if (isRestChunk(chunk)) {
          const d = new Date(planStart);
          d.setDate(planStart.getDate() + i);
          restDates.add(d.toDateString());
        }
      });
    }

    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = d.toDateString();
      if (dates.includes(ds)) currentStreak++;      // trained → counts
      else if (restDates.has(ds)) continue;         // scheduled rest → skip, don't break
      else break;                                    // missed a training day → streak ends
    }

    // Plan completion: did this workout finish all 7 days of the current plan?
    let planCompleted = false;
    if (profileData?.plan_created_at) {
      const { data: planWorkouts } = await supabase
        .from("workouts")
        .select("day_number")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("completed_at", new Date(profileData.plan_created_at).toISOString());
      const planDays = new Set((planWorkouts || []).map((w) => w.day_number));
      planCompleted = planDays.size >= 7;
    }

    const result = await awardXpAndBadges({
      userId,
      workoutXp,
      planCompleted,
      currentStreak,
      totalWorkouts,
    });
    setAwardResult(result);

    setSaving(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setCompletedDuration(durationSeconds);
    setSurveyVisible(true);
  };

  const submitSurvey = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (userData.user && workoutId) {
      await supabase.from("workout_feedback").insert({
        user_id: userData.user.id,
        workout_id: workoutId,
        difficulty: difficulty || null,
        energy_level: energyLevel || null,
        satisfaction: satisfaction || null,
        pain_discomfort: painDiscomfort || null,
        notes: feedbackNotes || null,
      });

      // Fire the AI coach to review upcoming days. We don't await this —
      // it runs in the background so the user isn't blocked. The home screen
      // will show a banner if the plan was adjusted.
      supabase.functions
        .invoke("adjust-plan", { body: { user_id: userData.user.id } })
        .catch((e) => console.log("adjust-plan invoke failed:", e));
    }
    setSurveyVisible(false);
    router.replace({
      pathname: "/(tabs)/home",
      params: { completedWorkout: "true", duration: String(completedDuration) },
    });
  };

  const handleExit = () => {
    Alert.alert("Exit Workout?", "Your progress so far won't be saved.", [
      { text: "Keep Going", style: "cancel" },
      {
        text: "Exit",
        style: "destructive",
        onPress: async () => {
          if (timerRef.current) clearInterval(timerRef.current);
          if (workoutId) await supabase.from("workouts").delete().eq("id", workoutId);
          router.back();
        },
      },
    ]);
  };

  const loggedCount = exercises.filter((e) => !e.skipped && e.sets.some((s) => s.logged)).length;
  const totalCount = exercises.filter((e) => !e.skipped).length;

  const grouped = exercises.reduce((acc, ex, idx) => {
    const key = ex.sessionType;
    if (!acc[key]) acc[key] = [];
    acc[key].push({ ex, idx });
    return acc;
  }, {} as Record<string, { ex: Exercise; idx: number }[]>);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable onPress={handleExit} style={styles.exitBtn}>
          <Text style={styles.exitBtnText}>✕</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTheme} numberOfLines={1}>{theme || "Workout"}</Text>
          <Text style={styles.headerTimer}>{formatTime(elapsedSeconds)}</Text>
        </View>
        <View style={styles.headerProgress}>
          <Text style={styles.headerProgressText}>{loggedCount}/{totalCount}</Text>
          <Text style={styles.headerProgressLabel}>done</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: totalCount > 0 ? `${(loggedCount / totalCount) * 100}%` as any : "0%" }]} />
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={20}
        enableResetScrollToCoords={false}
      >
        {Object.entries(grouped).map(([sessionType, items]) => (
          <View key={sessionType} style={styles.sessionGroup}>
            <Text style={styles.sessionGroupLabel}>
              {SESSION_EMOJI[sessionType] || "•"}{" "}
              {SESSION_LABELS[sessionType] || sessionType}
            </Text>
            {items.map(({ ex, idx }) => (
              <ExerciseCard
                key={idx}
                exercise={ex}
                onChange={(updated) => updateExercise(idx, updated)}
                onRestTimer={() => setRestTimerVisible(true)}
              />
            ))}
          </View>
        ))}
        <Pressable style={[styles.completeBtn, saving && styles.completeBtnDisabled]} onPress={completeWorkout} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.completeBtnText}>Complete Workout ✓</Text>}
        </Pressable>
      </KeyboardAwareScrollView>

      <RestTimerModal visible={restTimerVisible} onDismiss={() => setRestTimerVisible(false)} />

      <Modal visible={surveyVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.surveyScroll} contentContainerStyle={styles.surveyContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.surveyTitle}>How'd it go? 💪</Text>
            <Text style={styles.surveySubtitle}>Your feedback helps the AI refine your next plan.</Text>
            <Text style={styles.surveyDuration}>Workout time: {formatTime(completedDuration)}</Text>

            {/* ── XP earned ── */}
            {awardResult && (
              <View style={styles.xpBanner}>
                <View style={styles.xpBannerRow}>
                  <Text style={styles.xpBannerValue}>+{awardResult.xpGained} XP</Text>
                  {awardResult.leveledUp && (
                    <View style={styles.levelUpPill}>
                      <Text style={styles.levelUpPillText}>
                        Level Up → {awardResult.newLevel.name}!
                      </Text>
                    </View>
                  )}
                </View>
                {!awardResult.leveledUp && (
                  <Text style={styles.xpBannerLevel}>
                    {awardResult.newLevel.name} · {awardResult.newXp.toLocaleString()} XP
                  </Text>
                )}

                {awardResult.newBadges.length > 0 && (
                  <View style={styles.newBadgesBlock}>
                    <Text style={styles.newBadgesLabel}>New badges unlocked!</Text>
                    <View style={styles.newBadgesRow}>
                      {awardResult.newBadges.map((b) => (
                        <View key={b.id} style={styles.newBadgePill}>
                          <Text style={styles.newBadgePillText}>🏅 {b.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {[
              { label: "How difficult was the workout?", state: difficulty, setState: setDifficulty, labels: { 1: "Easy", 3: "Just right", 5: "Hard" } },
              { label: "Energy level after?", state: energyLevel, setState: setEnergyLevel, labels: { 1: "Drained", 3: "OK", 5: "Great" } },
              { label: "Overall satisfaction?", state: satisfaction, setState: setSatisfaction, labels: { 1: "Poor", 3: "Good", 5: "Great" } },
            ].map(({ label, state, setState, labels }) => (
              <View key={label}>
                <Text style={styles.surveyLabel}>{label}</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable key={n} style={[styles.ratingBtn, state === n && styles.ratingBtnActive]} onPress={() => setState(n)}>
                      <Text style={[styles.ratingBtnNum, state === n && styles.ratingBtnNumActive]}>{n}</Text>
                      <Text style={styles.ratingBtnLabel}>{(labels as any)[n] || ""}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}

            <Text style={styles.surveyLabel}>Any pain or discomfort?</Text>
            <TextInput style={styles.surveyTextInput} placeholder="e.g. left knee soreness..." placeholderTextColor="#555" value={painDiscomfort} onChangeText={setPainDiscomfort} multiline />

            <Text style={styles.surveyLabel}>Anything else? (optional)</Text>
            <TextInput style={[styles.surveyTextInput, { minHeight: 80 }]} placeholder="Notes, things to improve..." placeholderTextColor="#555" value={feedbackNotes} onChangeText={setFeedbackNotes} multiline />

            <Pressable style={styles.surveySubmitBtn} onPress={submitSurvey}>
              <Text style={styles.surveySubmitBtnText}>Save & Finish</Text>
            </Pressable>
            <Pressable style={styles.surveySkipBtn} onPress={submitSurvey}>
              <Text style={styles.surveySkipBtnText}>Skip feedback</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
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
const TEXT_MUTED = "#888888";

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: BG },
  exitBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  exitBtnText: { color: TEXT_PRIMARY, fontSize: 16 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTheme: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "600", maxWidth: 200 },
  headerTimer: { color: GREEN_BRIGHT, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  headerProgress: { alignItems: "center" },
  headerProgressText: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700" },
  headerProgressLabel: { color: TEXT_MUTED, fontSize: 11, textTransform: "uppercase" },

  progressTrack: { height: 3, backgroundColor: BORDER, marginHorizontal: 20, borderRadius: 2 },
  progressFill: { height: "100%", backgroundColor: GREEN, borderRadius: 2 },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120 },

  sessionGroup: { marginBottom: 24 },
  sessionGroupLabel: { color: GREEN, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },

  exerciseCard: { backgroundColor: SURFACE, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: BORDER },
  exerciseCardSkipped: { opacity: 0.4 },
  exerciseHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  exerciseName: { color: TEXT_PRIMARY, fontSize: 16, fontWeight: "600", marginBottom: 4 },
  exerciseDuration: { color: GREEN_BRIGHT, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  demoBtn: { alignSelf: "flex-start", borderWidth: 0.5, borderColor: GREEN, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 6 },
  demoBtnText: { color: GREEN, fontSize: 11, fontWeight: "600" },
  exerciseSessionType: { color: TEXT_MUTED, fontSize: 12, marginBottom: 6 },
  exerciseInstruction: { color: "#bbbbbb", fontSize: 12, lineHeight: 17, marginBottom: 2 },

  skipBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#2a2a2a", borderWidth: 1, borderColor: "#555" },
  skipBtnActive: { backgroundColor: "#3a1a1a", borderColor: "#ef4444" },
  skipBtnText: { color: "#cccccc", fontSize: 12, fontWeight: "700" },
  skipBtnTextActive: { color: "#ef4444" },

  setHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  setHeaderText: { color: TEXT_MUTED, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  setRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  setNumBadge: { height: 34, borderRadius: 8, backgroundColor: SURFACE2, justifyContent: "center", alignItems: "center" },
  setNumText: { color: TEXT_MUTED, fontSize: 13, fontWeight: "600" },
  setInput: { flex: 1, height: 34, backgroundColor: SURFACE2, borderRadius: 8, paddingHorizontal: 8, color: TEXT_PRIMARY, fontSize: 15, textAlign: "center", borderWidth: 0.5, borderColor: BORDER },
  setInputWide: { flex: 2 },
  setInputLogged: { opacity: 0.5 },

  unitPickerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: SURFACE2, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, height: 34, borderWidth: 0.5, borderColor: GREEN },
  unitPickerText: { color: GREEN_BRIGHT, fontSize: 14, fontWeight: "700" },
  unitPickerArrow: { color: TEXT_MUTED, fontSize: 10 },

  logSetBtn: { height: 34, borderRadius: 8, backgroundColor: SURFACE2, justifyContent: "center", alignItems: "center", borderWidth: 0.5, borderColor: BORDER },
  logSetBtnDone: { backgroundColor: GREEN_DIM, borderColor: GREEN },
  logSetBtnText: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700" },
  logSetBtnTextDone: { color: GREEN_BRIGHT },

  setActionsRow: { flexDirection: "row", gap: 16, marginTop: 4 },
  addSetBtn: { alignSelf: "flex-start" },
  addSetBtnText: { color: GREEN, fontSize: 13, fontWeight: "600" },
  removeSetBtn: { alignSelf: "flex-start" },
  removeSetBtnText: { color: "#ef4444", fontSize: 13, fontWeight: "600" },

  notesInput: { marginTop: 12, backgroundColor: SURFACE2, borderRadius: 10, padding: 10, color: TEXT_PRIMARY, fontSize: 13, borderWidth: 0.5, borderColor: BORDER, minHeight: 40 },

  completeBtn: { backgroundColor: GREEN, padding: 18, borderRadius: 16, alignItems: "center", marginTop: 12 },
  completeBtnDisabled: { opacity: 0.6 },
  completeBtnText: { color: "#000", fontSize: 17, fontWeight: "700" },

  // ── Demo modals (shared sheet style) ──
  demoOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  demoSheet: { backgroundColor: "#0f0f0f", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingBottom: 40, paddingHorizontal: 24 },
  demoSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  demoSheetTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700", flex: 1, paddingRight: 12 },
  demoCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  demoCloseBtnText: { color: TEXT_PRIMARY, fontSize: 13 },
  demoGif: { width: "100%", height: 220, borderRadius: 16, marginBottom: 20, backgroundColor: SURFACE },
  demoNotFound: { color: TEXT_MUTED, fontSize: 14, textAlign: "center", marginVertical: 40 },
  demoMusclesBlock: { marginBottom: 8 },
  demoMusclesLabel: { color: TEXT_MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  demoMusclesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  demoMusclePill: { backgroundColor: GREEN_DIM, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  demoMusclePillText: { color: GREEN_BRIGHT, fontSize: 12, fontWeight: "600" },
  demoYoutubeWrapper: { borderRadius: 16, overflow: "hidden", marginBottom: 8 },

  // Rest timer modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center" },
  modalCard: { backgroundColor: SURFACE, borderRadius: 24, padding: 32, alignItems: "center", width: 300, borderWidth: 1, borderColor: GREEN },
  modalTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  restTimerText: { color: GREEN_BRIGHT, fontSize: 64, fontWeight: "700", fontVariant: ["tabular-nums"], marginBottom: 24 },
  restAdjustRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  adjustBtn: { backgroundColor: SURFACE2, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  adjustBtnText: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: "600" },
  dismissBtn: { backgroundColor: GREEN, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 14 },
  dismissBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },

  // Duration picker modal
  durationSheet: { backgroundColor: "#0f0f0f", borderTopLeftRadius: 28, borderTopRightRadius: 28, width: "100%", position: "absolute", bottom: 0, paddingTop: 24, paddingBottom: 40 },
  durationSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 28, marginBottom: 20 },
  durationSheetTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700" },
  durationCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  durationCloseBtnText: { color: TEXT_PRIMARY, fontSize: 13 },
  durationList: { paddingHorizontal: 24, paddingBottom: 40 },
  durationOption: { paddingVertical: 18, paddingHorizontal: 28, borderBottomWidth: 0.5, borderBottomColor: BORDER, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  durationOptionActive: {},
  durationOptionText: { color: TEXT_PRIMARY, fontSize: 16 },
  durationOptionTextActive: { color: GREEN_BRIGHT, fontWeight: "700" },
  durationOptionCheck: { color: GREEN, fontSize: 16, fontWeight: "700" },

  // Survey
  surveyScroll: { backgroundColor: "#0f0f0f", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "92%" },
  surveyContent: { padding: 28, paddingBottom: 48 },
  surveyTitle: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: "700", marginBottom: 6 },
  surveySubtitle: { color: "#666", fontSize: 14, lineHeight: 20, marginBottom: 6 },
  surveyDuration: { color: GREEN, fontSize: 13, fontWeight: "600", marginBottom: 24 },

  // ── XP banner ──
  xpBanner: { backgroundColor: "#0d1f0d", borderRadius: 16, padding: 18, marginBottom: 8, borderWidth: 1, borderColor: GREEN },
  xpBannerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  xpBannerValue: { color: GREEN_BRIGHT, fontSize: 24, fontWeight: "700" },
  xpBannerLevel: { color: "#86efac", fontSize: 13, marginTop: 6 },
  levelUpPill: { backgroundColor: "#facc15", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  levelUpPillText: { color: "#000", fontSize: 12, fontWeight: "700" },
  newBadgesBlock: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: GREEN_DIM },
  newBadgesLabel: { color: "#86efac", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  newBadgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  newBadgePill: { backgroundColor: GREEN_DIM, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 0.5, borderColor: GREEN },
  newBadgePillText: { color: GREEN_BRIGHT, fontSize: 12, fontWeight: "600" },

  surveyLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "600", marginBottom: 12, marginTop: 20 },
  ratingRow: { flexDirection: "row", gap: 8 },
  ratingBtn: { flex: 1, backgroundColor: SURFACE, borderRadius: 12, paddingVertical: 10, alignItems: "center", borderWidth: 0.5, borderColor: BORDER },
  ratingBtnActive: { backgroundColor: "#0d1f0d", borderColor: GREEN, borderWidth: 1.5 },
  ratingBtnNum: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700" },
  ratingBtnNumActive: { color: GREEN_BRIGHT },
  ratingBtnLabel: { color: "#444", fontSize: 9, marginTop: 3, textAlign: "center" },
  surveyTextInput: { backgroundColor: SURFACE, borderRadius: 12, padding: 14, color: TEXT_PRIMARY, fontSize: 14, borderWidth: 0.5, borderColor: BORDER, minHeight: 52, textAlignVertical: "top" },
  surveySubmitBtn: { backgroundColor: GREEN, padding: 16, borderRadius: 16, alignItems: "center", marginTop: 28 },
  surveySubmitBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  surveySkipBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  surveySkipBtnText: { color: "#444", fontSize: 14 },
});