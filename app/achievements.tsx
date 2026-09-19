import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "./lib/supabase";
import {
  BADGES,
  fetchPercentiles,
  getLevel,
  getLevelProgress,
  LEVELS,
  toTopPercent,
  xpToNextLevel,
  type Percentiles,
} from "./lib/xp";

// Darken a hex color by a factor (0–1) — used for the level-bar gradient that
// fades from a deeper shade of the tier color up to the tier color itself.
const darkenHex = (hex: string, factor = 0.55): string => {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Normalize the badges column to a real string array (JS array, JSON string, or
// Postgres literal — all handled).
const parseBadges = (raw: any): string[] => {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string") {
    const s = raw.trim();
    if (s === "" || s === "{}" || s === "[]") return [];
    if (s.startsWith("[")) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.filter(Boolean);
      } catch {}
    }
    return s.replace(/^\{|\}$/g, "").split(",").map((x) => x.replace(/^"|"$/g, "").trim()).filter(Boolean);
  }
  return [];
};

export default function AchievementsScreen() {
  const [loading, setLoading] = useState(true);
  const [xp, setXp] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [percentiles, setPercentiles] = useState<Percentiles | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }

    const { data } = await supabase
      .from("profiles")
      .select("xp, badges")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (data) {
      setXp(data.xp || 0);
      setEarnedBadges(parseBadges((data as any).badges));
    }

    const pct = await fetchPercentiles(userData.user.id);
    setPercentiles(pct);

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  const level = getLevel(xp);
  const levelProgress = getLevelProgress(xp);
  const xpRemaining = xpToNextLevel(xp);
  const earnedCount = BADGES.filter((b) => earnedBadges.includes(b.id)).length;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Back button */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>Achievements</Text>
      <Text style={styles.subheading}>Track your XP, level, and badges.</Text>

      {/* ── Level / XP ── */}
      <Text style={styles.sectionHeader}>Level</Text>
      <View style={styles.card}>
        <View style={styles.levelCardHeader}>
          <View style={styles.levelBadge}>
            <MaterialCommunityIcons name="trophy-variant" size={22} color={level.color} />
            <Text style={[styles.levelBadgeText, { color: level.color }]}>{level.name}</Text>
          </View>
          <Text style={styles.levelXpText}>{xp.toLocaleString()} XP</Text>
        </View>
        <View style={styles.levelTrack}>
          <View style={[styles.levelFill, { width: `${Math.round(levelProgress * 100)}%` as any, backgroundColor: level.color }]} />
        </View>
        <Text style={styles.levelHint}>
          {xpRemaining > 0
            ? `${xpRemaining.toLocaleString()} XP to next level`
            : "Max level reached — you're Elite! 🏆"}
        </Text>
      </View>

      {/* ── Rankings ── */}
      {percentiles && (percentiles.xpOverall != null || percentiles.duprOverall != null) && (
        <>
          <Text style={styles.sectionHeader}>Rankings</Text>
          <View style={styles.card}>
            {/* XP rankings */}
            <View style={styles.rankBlock}>
              <View style={styles.rankBlockHeader}>
                <MaterialCommunityIcons name="star-four-points" size={18} color="#facc15" />
                <Text style={styles.rankBlockTitle}>XP</Text>
              </View>
              {percentiles.xpGroup != null && percentiles.ageLow != null && (
                <Text style={styles.rankLine}>
                  Top <Text style={styles.rankHighlight}>{toTopPercent(percentiles.xpGroup)}%</Text> of players aged {percentiles.ageLow}–{percentiles.ageHigh}
                </Text>
              )}
              {percentiles.xpOverall != null && (
                <Text style={styles.rankLine}>
                  Top <Text style={styles.rankHighlight}>{toTopPercent(percentiles.xpOverall)}%</Text> of all players
                </Text>
              )}
            </View>

            {/* DUPR rankings */}
            {(percentiles.duprOverall != null || percentiles.duprGroup != null) && (
              <View style={[styles.rankBlock, styles.rankBlockBorder]}>
                <View style={styles.rankBlockHeader}>
                  <MaterialCommunityIcons name="tennis" size={18} color="#22c55e" />
                  <Text style={styles.rankBlockTitle}>DUPR</Text>
                </View>
                {percentiles.duprGroup != null && percentiles.ageLow != null && (
                  <Text style={styles.rankLine}>
                    Top <Text style={styles.rankHighlight}>{toTopPercent(percentiles.duprGroup)}%</Text> of players aged {percentiles.ageLow}–{percentiles.ageHigh}
                  </Text>
                )}
                {percentiles.duprOverall != null && (
                  <Text style={styles.rankLine}>
                    Top <Text style={styles.rankHighlight}>{toTopPercent(percentiles.duprOverall)}%</Text> of all players
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
      )}

      {/* ── All tiers ── */}
      <Text style={styles.sectionHeader}>Tiers</Text>
      <View style={styles.card}>
        {LEVELS.map((l, i) => {
          const isCurrent = l.name === level.name;
          const reached = xp >= l.minXp;
          return (
            <View
              key={l.name}
              style={[
                styles.tierRow,
                i < LEVELS.length - 1 && styles.tierRowBorder,
              ]}
            >
              <View style={styles.tierLeft}>
                <MaterialCommunityIcons
                  name={reached ? "trophy-variant" : "lock"}
                  size={18}
                  color={reached ? l.color : "#444"}
                />
                <Text style={[styles.tierName, reached && { color: l.color }]}>
                  {l.name}
                </Text>
                {isCurrent && (
                  <View style={[styles.currentPill, { borderColor: l.color, backgroundColor: "#1a1a1a" }]}>
                    <Text style={[styles.currentPillText, { color: l.color }]}>Current</Text>
                  </View>
                )}
              </View>
              <Text style={styles.tierXp}>
                {l.maxXp === Infinity
                  ? `${l.minXp.toLocaleString()}+`
                  : `${l.minXp.toLocaleString()}`}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Badges ── */}
      <View style={styles.badgeHeaderRow}>
        <Text style={styles.sectionHeader}>Badges</Text>
        <Text style={styles.badgeCount}>{earnedCount} / {BADGES.length}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.badgeGrid}>
          {BADGES.map((badge) => {
            const earned = earnedBadges.includes(badge.id);
            return (
              <View
                key={badge.id}
                style={[styles.badgeItem, !earned && styles.badgeItemLocked]}
              >
                <MaterialCommunityIcons
                  name={badge.icon as any}
                  size={28}
                  color={earned ? "#facc15" : "#444"}
                />
                <Text style={[styles.badgeLabel, !earned && styles.badgeLabelLocked]} numberOfLines={2}>
                  {badge.label}
                </Text>
                {!earned && (
                  <Text style={styles.badgeLockedHint} numberOfLines={3}>
                    {badge.description}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#22c55e";
const BG = "#111";
const SURFACE = "#1a1a1a";
const SURFACE2 = "#252525";
const BORDER = "#2a2a2a";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED = "#888888";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 20, paddingTop: 70, paddingBottom: 120 },
  centered: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },

  backBtn: { marginBottom: 20 },
  backBtnText: { color: GREEN, fontSize: 16, fontWeight: "600" },

  heading: { color: TEXT_PRIMARY, fontSize: 34, fontWeight: "700", marginBottom: 6 },
  subheading: { color: TEXT_MUTED, fontSize: 16, marginBottom: 24 },

  sectionHeader: { color: TEXT_MUTED, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 8 },

  card: { backgroundColor: SURFACE, borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: BORDER },

  // Level
  levelCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelBadgeText: { color: "#facc15", fontSize: 18, fontWeight: "700" },
  levelXpText: { color: TEXT_MUTED, fontSize: 14, fontWeight: "600" },
  levelTrack: { backgroundColor: "#333", height: 10, borderRadius: 20, overflow: "hidden", marginBottom: 10 },
  levelFill: { backgroundColor: "#facc15", height: "100%", borderRadius: 20 },
  levelHint: { color: TEXT_MUTED, fontSize: 13 },

  // Rankings
  rankBlock: { paddingVertical: 6 },
  rankBlockBorder: { borderTopWidth: 0.5, borderTopColor: BORDER, marginTop: 10, paddingTop: 14 },
  rankBlockHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  rankBlockTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "700" },
  rankLine: { color: TEXT_MUTED, fontSize: 14, lineHeight: 22 },
  rankHighlight: { color: GREEN, fontWeight: "700" },

  // Tiers
  tierRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  tierRowBorder: { borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tierLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  tierName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "600" },
  tierNameCurrent: { color: "#facc15" },
  currentPill: { backgroundColor: "#1a1500", borderWidth: 0.5, borderColor: "#facc15", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  currentPillText: { color: "#facc15", fontSize: 10, fontWeight: "700" },
  tierXp: { color: TEXT_MUTED, fontSize: 13, fontWeight: "600" },

  // Badges
  badgeHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeCount: { color: "#facc15", fontSize: 13, fontWeight: "700" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeItem: {
    width: "30%",
    backgroundColor: SURFACE2,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#facc15",
  },
  badgeItemLocked: { borderColor: BORDER, opacity: 0.6 },
  badgeLabel: { color: TEXT_PRIMARY, fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 6 },
  badgeLabelLocked: { color: TEXT_MUTED },
  badgeLockedHint: { color: "#555", fontSize: 9, textAlign: "center", marginTop: 4, lineHeight: 12 },
});