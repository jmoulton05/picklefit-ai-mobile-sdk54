import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// ─── Planned features ─────────────────────────────────────────────────────────

const COMING_SOON = [
  {
    emoji: "🏆",
    title: "Leaderboards",
    description: "Compete with other PickleFit users on weekly workout volume, streaks, and DUPR improvements.",
  },
  {
    emoji: "👥",
    title: "Training Groups",
    description: "Create or join groups with your pickleball crew. Share plans, track each other's progress, and stay accountable.",
  },
  {
    emoji: "💬",
    title: "Community Feed",
    description: "Share workout completions, personal bests, and tips with the PickleFit community.",
  },
  {
    emoji: "📍",
    title: "Find Courts",
    description: "Discover pickleball courts near you, see who's playing, and organize pickup games.",
  },
  {
    emoji: "🎯",
    title: "Challenges",
    description: "Join weekly and monthly challenges — most workouts completed, biggest DUPR jump, longest streak.",
  },
  {
    emoji: "📊",
    title: "DUPR Comparisons",
    description: "See how your DUPR progression compares to players at your level across the PickleFit community.",
  },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Back */}
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backBtnText}>← Back</Text>
      </Pressable>

      <Text style={styles.heading}>Community</Text>
      <Text style={styles.subheading}>
        Connect with pickleball players and train together.
      </Text>

      {/* Coming soon hero */}
      <View style={styles.heroBanner}>
        <Text style={styles.heroEmoji}>🚀</Text>
        <Text style={styles.heroTitle}>Coming Soon</Text>
        <Text style={styles.heroText}>
          We're building a community of competitive pickleball players just like you. Features are in development and will roll out over the coming months.
        </Text>
      </View>

      {/* Planned features */}
      <Text style={styles.sectionHeader}>What's Coming</Text>
      {COMING_SOON.map((feature, i) => (
        <View key={i} style={styles.featureCard}>
          <Text style={styles.featureEmoji}>{feature.emoji}</Text>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureDescription}>{feature.description}</Text>
          </View>
        </View>
      ))}

      {/* Stay in the loop */}
      <View style={styles.notifyCard}>
        <Text style={styles.notifyTitle}>Want early access?</Text>
        <Text style={styles.notifyText}>
          Follow us on social media to stay up to date on community feature launches and PickleFit news.
        </Text>
        <View style={styles.socialRow}>
          <Pressable
            style={styles.socialBtn}
            onPress={() => Linking.openURL("https://instagram.com")}
          >
            <Text style={styles.socialBtnText}>Instagram</Text>
          </Pressable>
          <Pressable
            style={styles.socialBtn}
            onPress={() => Linking.openURL("https://tiktok.com")}
          >
            <Text style={styles.socialBtnText}>TikTok</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#22c55e";
const GREEN_DIM = "#14532d";
const GREEN_BRIGHT = "#4ade80";
const BG = "#111";
const SURFACE = "#1a1a1a";
const BORDER = "#2a2a2a";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED = "#888888";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 20, paddingTop: 70, paddingBottom: 120 },

  backBtn: { marginBottom: 20 },
  backBtnText: { color: GREEN, fontSize: 16, fontWeight: "600" },

  heading: { color: TEXT_PRIMARY, fontSize: 34, fontWeight: "700", marginBottom: 6 },
  subheading: { color: TEXT_MUTED, fontSize: 16, lineHeight: 22, marginBottom: 24 },

  // Hero banner
  heroBanner: {
    backgroundColor: "#0d1f0d",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: GREEN,
  },
  heroEmoji: { fontSize: 40, marginBottom: 12 },
  heroTitle: { color: GREEN_BRIGHT, fontSize: 24, fontWeight: "700", marginBottom: 10 },
  heroText: {
    color: "#86efac",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  // Section header
  sectionHeader: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 14,
  },

  // Feature cards
  featureCard: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  featureEmoji: { fontSize: 28, marginTop: 2 },
  featureText: { flex: 1 },
  featureTitle: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "700", marginBottom: 4 },
  featureDescription: { color: TEXT_MUTED, fontSize: 13, lineHeight: 20 },

  // Notify card
  notifyCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 20,
    marginTop: 24,
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  notifyTitle: { color: TEXT_PRIMARY, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  notifyText: {
    color: TEXT_MUTED,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  socialBtnText: { color: "#000", fontSize: 14, fontWeight: "700" },
});