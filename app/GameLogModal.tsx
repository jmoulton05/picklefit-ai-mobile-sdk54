import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { VictoryArea, VictoryAxis, VictoryChart, VictoryScatter } from "victory-native";
import { supabase } from "./lib/supabase";

// Map stored focus keys → display labels (parallel to the Log Match survey).
const FOCUS_LABELS: Record<string, string> = {
  dinking: "Dinking",
  serves_returns: "Serves/Returns",
  third_shot: "Third Shot",
  volleys: "Volleys",
  resets: "Resets",
  lobs: "Lobs",
  overheads_putaways: "Overheads/Putaways",
  footwork_positioning: "Footwork/Positioning",
  flicks: "Flicks",
  speedups: "Speedups",
  counters: "Counters",
};

// ─── Game Log Modal ───────────────────────────────────────────────────────────
// Shows the user's overall W–L record and a chronological list of logged
// matches, each with a green W or red L badge on the right.

interface Match {
  id: string;
  format: string;
  your_score: number;
  opponent_score: number;
  won: boolean;
  notes: string | null;
  went_well: string[] | null;
  needs_improvement: string[] | null;
  created_at: string;
}

const STATUS_BAR_TOP = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 54;

export default function GameLogModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"overall" | "singles" | "doubles">("overall");

  useEffect(() => {
    if (visible) loadMatches();
  }, [visible]);

  const loadMatches = async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("matches")
      .select("id, format, your_score, opponent_score, won, notes, went_well, needs_improvement, created_at")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false });
    setMatches(data || []);
    setLoading(false);
  };

  // Matches shown depend on the active filter.
  const visibleMatches =
    filter === "overall" ? matches : matches.filter((m) => m.format === filter);

  // Record reflects the active filter.
  const wins = visibleMatches.filter((m) => m.won).length;
  const losses = visibleMatches.length - wins;
  const total = visibleMatches.length;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

  // Current streak: walk from the most recent match (visibleMatches is newest-first)
  // and count how many in a row share the same result.
  let streakCount = 0;
  let streakWon = false;
  if (visibleMatches.length > 0) {
    streakWon = visibleMatches[0].won;
    for (const m of visibleMatches) {
      if (m.won === streakWon) streakCount++;
      else break;
    }
  }

  // Cumulative win % over time. Needs oldest→newest, so reverse the list.
  // Each point = win rate across all matches up to and including that one.
  const CHART_MIN_MATCHES = 10;
  const chronological = [...visibleMatches].reverse();
  const winPctData = chronological.map((_, i) => {
    const upTo = chronological.slice(0, i + 1);
    const w = upTo.filter((m) => m.won).length;
    return { x: i + 1, y: Math.round((w / upTo.length) * 100) };
  });
  const showChart = winPctData.length >= CHART_MIN_MATCHES;
  const CHART_WIDTH = Dimensions.get("window").width - 48 - 48; // screen - sheet padding

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Game Log</Text>
              <View style={styles.recordRow}>
                <Text style={styles.record}>
                  Record: <Text style={styles.recordWin}>{wins}W</Text>
                  {" – "}
                  <Text style={styles.recordLoss}>{losses}L</Text>
                  {total > 0 ? <Text style={styles.recordPct}>  ({winPct}%)</Text> : null}
                </Text>
                {streakCount > 0 && (
                  <View style={[styles.streakBadge, streakWon ? styles.streakWin : styles.streakLoss]}>
                    <Text style={[styles.streakText, streakWon ? styles.streakTextWin : styles.streakTextLoss]}>
                      {streakWon ? "W" : "L"}{streakCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Overall / Singles / Doubles toggle */}
          <View style={styles.filterRow}>
            {(["overall", "singles", "doubles"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setFilter(opt)}
                style={[styles.filterBtn, filter === opt && styles.filterBtnActive]}
              >
                <Text style={[styles.filterText, filter === opt && styles.filterTextActive]}>
                  {opt === "overall" ? "Overall" : opt === "singles" ? "Singles" : "Doubles"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Cumulative win % chart (only with enough matches) */}
          {!loading && showChart && (
            <View style={styles.chartBlock}>
              <Text style={styles.chartTitle}>Win % Over Time</Text>
              <VictoryChart
                width={CHART_WIDTH}
                height={200}
                padding={{ top: 20, bottom: 32, left: 44, right: 16 }}
                domain={{ y: [0, 100] }}
                domainPadding={{ x: 8 }}
              >
                <VictoryAxis
                  style={{
                    axis: { stroke: "#2a2a2a" },
                    tickLabels: { fill: "#888888", fontSize: 9, padding: 5 },
                    grid: { stroke: "transparent" },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  tickValues={[0, 25, 50, 75, 100]}
                  tickFormat={(t: number) => `${t}%`}
                  style={{
                    axis: { stroke: "transparent" },
                    tickLabels: { fill: "#888888", fontSize: 9, padding: 5 },
                    grid: { stroke: "#222222", strokeDasharray: "3,5" },
                  }}
                />
                <VictoryArea
                  data={winPctData}
                  interpolation="monotoneX"
                  style={{
                    data: { fill: "#22c55e", fillOpacity: 0.12, stroke: "#22c55e", strokeWidth: 2.5 },
                  }}
                />
                <VictoryScatter
                  data={winPctData}
                  size={3}
                  style={{ data: { fill: "#4ade80", stroke: "#0f0f0f", strokeWidth: 2 } }}
                />
              </VictoryChart>
            </View>
          )}

          {/* Chart locked until enough matches are logged */}
          {!loading && !showChart && total > 0 && (
            <View style={styles.chartLocked}>
              <Text style={styles.chartLockedTitle}>Win % Over Time</Text>
              <Text style={styles.chartLockedText}>
                Log at least {CHART_MIN_MATCHES} {filter === "overall" ? "" : filter + " "}matches to unlock your win % trend.
                {" "}{CHART_MIN_MATCHES - total} more to go.
              </Text>
            </View>
          )}

          {loading ? (
            <ActivityIndicator color="#22c55e" style={{ marginVertical: 40 }} />
          ) : visibleMatches.length === 0 ? (
            <Text style={styles.emptyText}>
              {matches.length === 0
                ? 'No matches logged yet. Tap "Log Match" on the home screen to track your games.'
                : `No ${filter} matches logged yet.`}
            </Text>
          ) : (
            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {visibleMatches.map((m) => {
                const isOpen = expandedId === m.id;
                return (
                  <Pressable
                    key={m.id}
                    style={styles.matchRow}
                    onPress={() => setExpandedId(isOpen ? null : m.id)}
                  >
                    <View style={styles.matchMain}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.matchScore}>
                          {m.your_score} – {m.opponent_score}
                        </Text>
                        <Text style={styles.matchMeta}>
                          {m.format === "doubles" ? "Doubles" : "Singles"} · {formatDate(m.created_at)}
                        </Text>
                      </View>
                      <View style={[styles.resultBadge, m.won ? styles.resultWin : styles.resultLoss]}>
                        <Text style={[styles.resultText, m.won ? styles.resultTextWin : styles.resultTextLoss]}>
                          {m.won ? "W" : "L"}
                        </Text>
                      </View>
                    </View>

                    {isOpen && (
                      <View style={styles.detail}>
                        {m.went_well && m.went_well.length > 0 && (
                          <>
                            <Text style={styles.detailLabel}>What went well</Text>
                            <View style={styles.chipWrap}>
                              {m.went_well.map((k) => (
                                <View key={k} style={[styles.chip, styles.chipWell]}>
                                  <Text style={[styles.chipText, styles.chipTextWell]}>
                                    {FOCUS_LABELS[k] || k}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </>
                        )}

                        {m.needs_improvement && m.needs_improvement.length > 0 && (
                          <>
                            <Text style={styles.detailLabel}>Needs improvement</Text>
                            <View style={styles.chipWrap}>
                              {m.needs_improvement.map((k) => (
                                <View key={k} style={[styles.chip, styles.chipImprove]}>
                                  <Text style={[styles.chipText, styles.chipTextImprove]}>
                                    {FOCUS_LABELS[k] || k}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </>
                        )}

                        {m.notes ? (
                          <>
                            <Text style={styles.detailLabel}>Notes</Text>
                            <Text style={styles.matchNotes}>{m.notes}</Text>
                          </>
                        ) : null}

                        {!m.notes &&
                          (!m.went_well || m.went_well.length === 0) &&
                          (!m.needs_improvement || m.needs_improvement.length === 0) && (
                            <Text style={styles.detailEmpty}>No survey or notes for this match.</Text>
                          )}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const GREEN = "#22c55e";
const GREEN_DIM = "#14532d";
const GREEN_BRIGHT = "#4ade80";
const RED = "#ef4444";
const SURFACE = "#1a1a1a";
const SURFACE2 = "#252525";
const BORDER = "#2a2a2a";
const TEXT_MUTED = "#888";

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0f0f0f",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: Dimensions.get("window").height - STATUS_BAR_TOP - 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 4 },
  recordRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  record: { color: TEXT_MUTED, fontSize: 15, fontWeight: "600" },
  recordWin: { color: GREEN_BRIGHT, fontWeight: "700" },
  recordLoss: { color: RED, fontWeight: "700" },
  recordPct: { color: "#aaa", fontWeight: "600" },

  streakBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  streakWin: { backgroundColor: GREEN_DIM, borderColor: GREEN },
  streakLoss: { backgroundColor: "#3a1a1a", borderColor: RED },
  streakText: { fontSize: 13, fontWeight: "800" },
  streakTextWin: { color: GREEN_BRIGHT },
  streakTextLoss: { color: RED },

  chartBlock: { marginBottom: 18 },
  chartTitle: { color: TEXT_MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },

  chartLocked: {
    backgroundColor: SURFACE, borderRadius: 14, padding: 16, marginBottom: 18,
    borderWidth: 0.5, borderColor: BORDER,
  },
  chartLockedTitle: { color: TEXT_MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  chartLockedText: { color: "#aaa", fontSize: 13, lineHeight: 19 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  closeBtnText: { color: "#fff", fontSize: 13 },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  filterBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center",
    backgroundColor: SURFACE2, borderWidth: 1, borderColor: BORDER,
  },
  filterBtnActive: { backgroundColor: GREEN_DIM, borderColor: GREEN },
  filterText: { color: TEXT_MUTED, fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: GREEN_BRIGHT },

  emptyText: { color: TEXT_MUTED, fontSize: 14, lineHeight: 21, textAlign: "center", marginVertical: 30, paddingHorizontal: 10 },

  matchRow: {
    backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 0.5, borderColor: BORDER,
  },
  matchMain: { flexDirection: "row", alignItems: "center", gap: 12 },
  matchScore: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 3 },
  matchMeta: { color: TEXT_MUTED, fontSize: 13 },
  matchNotes: { color: "#bbb", fontSize: 14, lineHeight: 20, marginTop: 4 },

  // ── Expanded detail (parallel to the Log Match survey) ──
  detail: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: BORDER },
  detailLabel: {
    color: TEXT_MUTED, fontSize: 11, textTransform: "uppercase",
    letterSpacing: 0.5, marginBottom: 8, marginTop: 4,
  },
  detailEmpty: { color: "#666", fontSize: 13, fontStyle: "italic" },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipWell: { backgroundColor: GREEN_DIM, borderColor: GREEN },
  chipImprove: { backgroundColor: GREEN_DIM, borderColor: GREEN_BRIGHT },
  chipText: { fontSize: 13, fontWeight: "600" },
  chipTextWell: { color: GREEN_BRIGHT },
  chipTextImprove: { color: GREEN_BRIGHT },

  resultBadge: {
    width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center",
    borderWidth: 1,
  },
  resultWin: { backgroundColor: GREEN_DIM, borderColor: GREEN },
  resultLoss: { backgroundColor: "#3a1a1a", borderColor: RED },
  resultText: { fontSize: 18, fontWeight: "800" },
  resultTextWin: { color: GREEN_BRIGHT },
  resultTextLoss: { color: RED },
});