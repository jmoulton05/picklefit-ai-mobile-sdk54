import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { generateWorkoutPlan } from "../generatePlan";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedDay {
  title: string;
  theme: string;
  dayNumber: number;
  sessions: ParsedSession[];
  tags: string[];
}

interface ParsedSession {
  type: string;
  duration: string;
  items: ParsedDrillItem[];
}

interface ParsedDrillItem {
  name: string;
  detail: string;
}

interface UserStats {
  dupr: string;
  days: number;
  sessionLength: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const stripBold = (text: string) => text.replace(/\*\*/g, "").trim();
const stripDashes = (text: string) => text.replace(/^---+$/gm, "");

const SESSION_TYPE_KEYS = [
  "warmup", "workout", "pickleball skill work",
  "cooldown", "fitness", "rest", "active recovery",
];

const renderSessionIcon = (type: string) => {
  const size = 14;
  const green = "#22c55e";
  switch (type) {
    case "warmup":                return <MaterialCommunityIcons name="fire" size={size} color="#f97316" />;
    case "workout":               return <MaterialCommunityIcons name="dumbbell" size={size} color={green} />;
    case "pickleball skill work": return <MaterialCommunityIcons name="tennis" size={size} color={green} />;
    case "cooldown":              return <MaterialCommunityIcons name="snowflake" size={size} color="#60a5fa" />;
    case "fitness":               return <MaterialCommunityIcons name="lightning-bolt" size={size} color="#facc15" />;
    case "rest":                  return <MaterialCommunityIcons name="sleep" size={size} color="#a78bfa" />;
    case "active recovery":       return <MaterialCommunityIcons name="leaf" size={size} color="#34d399" />;
    default:                      return <MaterialCommunityIcons name="circle-small" size={size} color={green} />;
  }
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

const SECTION_KEYS = SESSION_TYPE_KEYS;

const detectSessionType = (line: string): string | null => {
  const lower = line.toLowerCase().replace(/[:\*]/g, "").trim();
  return SECTION_KEYS.find((k) => lower.startsWith(k)) || null;
};

const parseDrillLine = (line: string): ParsedDrillItem => {
  const cleaned = stripBold(line).replace(/^[-•*]\s*/, "").trim();
  const colonIdx = cleaned.indexOf(":");
  if (colonIdx !== -1) {
    return { name: cleaned.slice(0, colonIdx).trim(), detail: cleaned.slice(colonIdx + 1).trim() };
  }
  const dashIdx = cleaned.indexOf(" — ");
  if (dashIdx !== -1) {
    return { name: cleaned.slice(0, dashIdx).trim(), detail: cleaned.slice(dashIdx + 3).trim() };
  }
  return { name: cleaned, detail: "" };
};

const extractTags = (day: ParsedDay, raw: string): string[] => {
  const tags: string[] = [];
  const lower = raw.toLowerCase();
  if (lower.includes("play") && lower.includes("game")) tags.push("Play a game if up for it");
  if (day.theme) tags.push(day.theme);
  return tags.slice(0, 3);
};

const parseDay = (dayText: string): ParsedDay => {
  const lines = dayText.split("\n").map((l) => l.trim()).filter(Boolean);
  const titleLine = stripBold(lines[0] || "Day 1");
  const dayNumMatch = titleLine.match(/Day\s+(\d+)/i);
  const dayNumber = dayNumMatch ? parseInt(dayNumMatch[1]) : 1;
  const colonIdx = titleLine.indexOf(":");
  const theme = colonIdx !== -1 ? titleLine.slice(colonIdx + 1).trim() : "";

  const sessions: ParsedSession[] = [];
  let currentSession: ParsedSession | null = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const sessionType = detectSessionType(line);
    if (sessionType) {
      if (currentSession) sessions.push(currentSession);
      const durationMatch = line.match(/·?\s*(\d+)\s*min/i);
      currentSession = {
        type: sessionType,
        duration: durationMatch ? `${durationMatch[1]} min` : "",
        items: [],
      };
    } else if (currentSession && (line.startsWith("-") || line.startsWith("•") || line.startsWith("*"))) {
      currentSession.items.push(parseDrillLine(line));
    } else if (currentSession && line.length > 2 && !line.startsWith("Day")) {
      currentSession.items.push(parseDrillLine(line));
    }
  }
  if (currentSession) sessions.push(currentSession);

  const partial: ParsedDay = { title: titleLine, theme, dayNumber, sessions, tags: [] };
  partial.tags = extractTags(partial, dayText);
  return partial;
};

const splitPlanIntoDays = (planText: string): string[] => {
  const firstDayIdx = planText.search(/Day\s+1\s*:/i);
  const trimmed = firstDayIdx >= 0 ? planText.slice(firstDayIdx) : planText;
  return stripDashes(trimmed)
    .split(/(?=Day\s+\d+\s*:)/gi)
    .map((d) => d.trim())
    .filter(Boolean);
};

const getClosingText = (planText: string): string => {
  const markers = [
    "General Recommendations:", "Recommendations:", "Coach's Notes:",
    "Final Notes:", "Notes:", "Additional Notes:", "Important Notes:",
  ];
  for (const marker of markers) {
    const idx = planText.indexOf(marker);
    if (idx !== -1) return planText.slice(idx).trim();
  }
  return "";
};

// ─── Animated Day Card ────────────────────────────────────────────────────────

function DayCard({ day, isOpen, onToggle }: { day: ParsedDay; isOpen: boolean; onToggle: () => void }) {
  const animHeight = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animHeight, {
      toValue: isOpen ? 1 : 0,
      useNativeDriver: false,
      damping: 18,
      stiffness: 160,
    }).start();
  }, [isOpen]);

  const chevronRotate = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  return (
    <View style={[styles.card, isOpen && styles.cardActive]}>
      <Pressable onPress={onToggle} style={styles.cardHeader}>
        <View style={[styles.dayBadge, isOpen && styles.dayBadgeActive]}>
          <Text style={[styles.dayBadgeNum, isOpen && styles.dayBadgeNumActive]}>{day.dayNumber}</Text>
          <Text style={[styles.dayBadgeLabel, isOpen && styles.dayBadgeLabelActive]}>DAY</Text>
        </View>
        <View style={styles.dayInfo}>
          <Text style={styles.dayTitle} numberOfLines={1}>{day.theme || `Day ${day.dayNumber}`}</Text>
          <Text style={[styles.daySubtheme, isOpen && styles.daySubthemeActive]}>
            {day.sessions.map((s) => SESSION_LABELS[s.type] || s.type).join(" · ") || "Rest day"}
          </Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Text style={[styles.chevron, isOpen && styles.chevronActive]}>‹</Text>
        </Animated.View>
      </Pressable>

      {isOpen && (
        <View style={styles.cardBody}>
          {day.sessions.map((session, si) => (
            <View key={si} style={styles.sessionBlock}>
              <View style={styles.sessionHeader}>
                {renderSessionIcon(session.type)}
                <Text style={styles.sessionType}>
                  {SESSION_LABELS[session.type] || session.type}
                  {session.duration ? ` · ${session.duration}` : ""}
                </Text>
              </View>
              {session.items.map((item, ii) => (
                <View key={ii} style={styles.drillItem}>
                  <View style={styles.drillDot} />
                  <View style={styles.drillText}>
                    <Text style={styles.drillName}>{item.name}</Text>
                    {item.detail ? <Text style={styles.drillDetail}>{item.detail}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ))}
          {day.tags.length > 0 && (
            <View style={styles.tagRow}>
              {day.tags.map((tag, ti) => (
                <View key={ti} style={[styles.tag, ti === 0 && styles.tagGreen]}>
                  <Text style={[styles.tagText, ti === 0 && styles.tagTextGreen]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: UserStats }) {
  return (
    <View style={styles.statRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.dupr}</Text>
        <Text style={styles.statLabel}>DUPR</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.days}</Text>
        <Text style={styles.statLabel}>Active Days</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>{stats.sessionLength}<Text style={styles.statUnit}>m</Text></Text>
        <Text style={styles.statLabel}>Session</Text>
      </View>
    </View>
  );
}

// ─── Coach Notes ──────────────────────────────────────────────────────────────

function CoachNotes({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View style={styles.coachNotes}>
      <Text style={styles.coachNotesTitle}>Coach's Notes</Text>
      <Text style={styles.coachNotesBody}>{stripBold(text)}</Text>
    </View>
  );
}

// ─── Generating State ─────────────────────────────────────────────────────────

const PROGRESS_STEPS = [
  { pct: 10, msg: "Saving your profile..." },
  { pct: 30, msg: "Analyzing your feedback..." },
  { pct: 55, msg: "Building your pickleball workouts..." },
  { pct: 80, msg: "Personalizing your 7-day plan..." },
  { pct: 95, msg: "Finalizing your plan..." },
];

function GeneratingView({ progress, status }: { progress: number; status: string }) {
  return (
    <View style={styles.generatingContainer}>
      <ActivityIndicator size="large" color="#22c55e" style={{ marginBottom: 24 }} />
      <Text style={styles.generatingTitle}>Adapting Your Plan</Text>
      <Text style={styles.generatingStatus}>{status}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
      </View>
      <Text style={styles.progressPct}>{progress}%</Text>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onGenerate, generating }: { onGenerate: () => void; generating: boolean }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🏓</Text>
      <Text style={styles.emptyTitle}>No plan yet</Text>
      <Text style={styles.emptySubtitle}>Generate your personalized 7-day plan to get started.</Text>
      <Pressable style={[styles.regenBtn, generating && styles.regenBtnDisabled]} onPress={onGenerate} disabled={generating}>
        {generating
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.regenBtnText}>Generate Plan</Text>
        }
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PlanScreen() {
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [openDays, setOpenDays] = useState<number[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({ dupr: "—", days: 7, sessionLength: "—" });
  const [userName, setUserName] = useState("there");
  const [error, setError] = useState("");

  const progressTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    loadPlan();
    return () => progressTimers.current.forEach(clearTimeout);
  }, []);

  const loadPlan = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("current_plan, dupr_rating, days_per_week, session_length, first_name")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (data) {
      setPlan(data.current_plan || "");
      setUserName(data.first_name || "there");
      setUserStats({
        dupr: data.dupr_rating ? String(data.dupr_rating) : "—",
        days: data.days_per_week || 7,
        sessionLength: data.session_length ? String(data.session_length) : "—",
      });
    }
    setLoading(false);
  };

  const startProgressAnimation = () => {
    progressTimers.current.forEach(clearTimeout);
    progressTimers.current = [];
    const delays = [0, 3000, 6000, 10000, 14000];
    PROGRESS_STEPS.forEach((step, i) => {
      const t = setTimeout(() => {
        setProgress(step.pct);
        setStatusMsg(step.msg);
      }, delays[i]);
      progressTimers.current.push(t);
    });
  };

  const regeneratePlan = async () => {
    setGenerating(true);
    setError("");
    setProgress(0);
    setStatusMsg("Getting ready...");
    startProgressAnimation();

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!profile) throw new Error("Profile not found");

      const newPlan = await generateWorkoutPlan({
        ...profile,
        user_id: userData.user.id,
      });

      const { error: saveError } = await supabase
        .from("profiles")
        .update({
          current_plan: newPlan,
          plan_created_at: new Date().toISOString(),
        })
        .eq("id", userData.user.id);

      if (saveError) throw new Error(saveError.message);

      setProgress(100);
      setStatusMsg("Plan ready!");
      setTimeout(() => {
        setPlan(newPlan);
        setGenerating(false);
        setProgress(0);
        setOpenDays([]);
      }, 800);

    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setGenerating(false);
      setProgress(0);
    }
  };

  const toggleDay = (index: number) => {
    setOpenDays((prev) =>
      prev.includes(index) ? prev.filter((d) => d !== index) : [...prev, index]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
        <Text style={styles.loadingText}>Loading your plan...</Text>
      </View>
    );
  }

  if (generating) {
    return <GeneratingView progress={progress} status={statusMsg} />;
  }

  const closingText = getClosingText(plan);
  const days = splitPlanIntoDays(plan).map(parseDay);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>{greeting} 👋</Text>
          <Text style={styles.heading}>Your Plan</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{userName.slice(0, 2).toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats */}
      <StatsBar stats={userStats} />

      {/* Error */}
      {error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Days */}
      {days.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>This week</Text>
          {days.map((day, index) => (
            <DayCard
              key={index}
              day={day}
              isOpen={openDays.includes(index)}
              onToggle={() => toggleDay(index)}
            />
          ))}
          <CoachNotes text={closingText} />
        </>
      ) : (
        <EmptyState onGenerate={regeneratePlan} generating={generating} />
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#22c55e";
const GREEN_DIM = "#14532d";
const GREEN_BRIGHT = "#4ade80";
const BG = "#0f0f0f";
const SURFACE = "#1a1a1a";
const SURFACE2 = "#222";
const BORDER = "#2a2a2a";
const TEXT_PRIMARY = "#ffffff";
const TEXT_SECONDARY = "#d1d5db";
const TEXT_MUTED = "#777777";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 20, paddingTop: 64, paddingBottom: 120 },
  centered: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },
  loadingText: { color: TEXT_MUTED, marginTop: 16, fontSize: 15 },

  // Generating view
  generatingContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  generatingTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  generatingStatus: { color: TEXT_MUTED, fontSize: 15, marginBottom: 28, textAlign: "center" },
  progressTrack: { width: "100%", height: 10, backgroundColor: SURFACE, borderRadius: 20, overflow: "hidden", marginBottom: 10 },
  progressFill: { height: "100%", backgroundColor: GREEN, borderRadius: 20 },
  progressPct: { color: TEXT_MUTED, fontSize: 13 },

  // Error
  errorCard: { backgroundColor: "#2a1a1a", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 0.5, borderColor: "#ef4444" },
  errorText: { color: "#ef4444", fontSize: 14, textAlign: "center" },

  // Header
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  greeting: { fontSize: 13, color: TEXT_MUTED, marginBottom: 2 },
  heading: { fontSize: 28, fontWeight: "700", color: TEXT_PRIMARY },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: GREEN_DIM, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 13, fontWeight: "600", color: GREEN_BRIGHT },

  // Stats
  statRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 14, padding: 14, alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "700", color: GREEN_BRIGHT, lineHeight: 26 },
  statUnit: { fontSize: 14, color: TEXT_MUTED },
  statLabel: { fontSize: 10, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 4 },

  sectionLabel: { fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },

  // Card
  card: { backgroundColor: SURFACE, borderRadius: 18, marginBottom: 10, borderWidth: 0.5, borderColor: BORDER, overflow: "hidden" },
  cardActive: { borderColor: GREEN, borderWidth: 1 },
  cardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },

  dayBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#252525", justifyContent: "center", alignItems: "center" },
  dayBadgeActive: { backgroundColor: GREEN_DIM },
  dayBadgeNum: { fontSize: 17, fontWeight: "700", color: TEXT_PRIMARY, lineHeight: 20 },
  dayBadgeNumActive: { color: GREEN_BRIGHT },
  dayBadgeLabel: { fontSize: 8, color: TEXT_MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  dayBadgeLabelActive: { color: "#166534" },

  dayInfo: { flex: 1, minWidth: 0 },
  dayTitle: { fontSize: 14, fontWeight: "600", color: TEXT_PRIMARY, marginBottom: 3 },
  daySubtheme: { fontSize: 12, color: TEXT_MUTED },
  daySubthemeActive: { color: GREEN },

  chevron: { color: "#444", fontSize: 22, fontWeight: "300", transform: [{ rotate: "-90deg" }] },
  chevronActive: { color: GREEN },

  cardBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 0.5, borderTopColor: "#252525", paddingTop: 12 },

  sessionBlock: { marginBottom: 14 },
  sessionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  sessionIcon: { fontSize: 13 },
  sessionType: { fontSize: 11, color: GREEN, textTransform: "uppercase", letterSpacing: 0.8, fontWeight: "600" },

  drillItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 10, backgroundColor: SURFACE2, borderRadius: 10, marginBottom: 6 },
  drillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GREEN, marginTop: 5, flexShrink: 0 },
  drillText: { flex: 1 },
  drillName: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: "600", marginBottom: 2 },
  drillDetail: { fontSize: 12, color: TEXT_MUTED, lineHeight: 17 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "#252525" },
  tagGreen: { backgroundColor: GREEN_DIM },
  tagText: { fontSize: 11, color: TEXT_MUTED },
  tagTextGreen: { color: GREEN_BRIGHT },

  coachNotes: { marginTop: 8, marginBottom: 16, padding: 18, backgroundColor: "#151515", borderRadius: 18, borderWidth: 0.5, borderColor: BORDER },
  coachNotesTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700", marginBottom: 10 },
  coachNotesBody: { color: TEXT_SECONDARY, fontSize: 14, lineHeight: 22 },

  emptyState: { alignItems: "center", marginTop: 60, paddingHorizontal: 20 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: TEXT_PRIMARY, fontSize: 22, fontWeight: "700", marginBottom: 10 },
  emptySubtitle: { color: TEXT_MUTED, fontSize: 15, lineHeight: 23, textAlign: "center", marginBottom: 32 },

  regenBtn: { backgroundColor: GREEN, paddingVertical: 15, borderRadius: 14, alignItems: "center", marginTop: 8 },
  regenBtnDisabled: { opacity: 0.6 },
  regenBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },
});