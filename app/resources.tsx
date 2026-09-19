import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// ─── Placeholder brand data ───────────────────────────────────────────────────
// Replace with real data from Supabase when ready

const CATEGORIES = [
  {
    title: "Paddles",
    emoji: "🏓",
    brands: [
      { name: "Selkirk Sport", description: "Premium pickleball paddles & gear", url: "https://selkirk.com" },
      { name: "JOOLA", description: "Professional-grade paddles", url: "https://joolausa.com" },
      { name: "Engage Pickleball", description: "High-performance paddles", url: "https://engagepickleball.com" },
    ],
  },
  {
    title: "Apparel",
    emoji: "👕",
    brands: [
      { name: "Fila", description: "Pickleball & tennis apparel", url: "https://fila.com" },
      { name: "Lululemon", description: "Performance athletic wear", url: "https://lululemon.com" },
      { name: "Nike", description: "Sport apparel & footwear", url: "https://nike.com" },
    ],
  },
  {
    title: "Shoes",
    emoji: "👟",
    brands: [
      { name: "K-Swiss", description: "Court shoes for pickleball", url: "https://kswiss.com" },
      { name: "ASICS", description: "Performance court footwear", url: "https://asics.com" },
      { name: "New Balance", description: "Athletic & court shoes", url: "https://newbalance.com" },
    ],
  },
  {
    title: "Accessories",
    emoji: "🎒",
    brands: [
      { name: "Franklin Sports", description: "Balls, bags & accessories", url: "https://franklinsports.com" },
      { name: "Tourna", description: "Grips, bags & court gear", url: "https://tournagrip.com" },
      { name: "Gamma Sports", description: "Strings, grips & accessories", url: "https://gammasports.com" },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function BrandCard({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  return (
    <Pressable
      style={styles.brandCard}
      onPress={() => Linking.openURL(url)}
    >
      <View style={styles.brandCardLeft}>
        <Text style={styles.brandName}>{name}</Text>
        <Text style={styles.brandDescription}>{description}</Text>
      </View>
      <Text style={styles.brandChevron}>›</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ResourcesScreen() {
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

      <Text style={styles.heading}>Gear</Text>
      <Text style={styles.subheading}>
        Gear up with the best pickleball brands and equipment.
      </Text>

      {/* Coming soon banner */}
      <View style={styles.comingSoonBanner}>
        <Text style={styles.comingSoonTitle}>🚀 More coming soon</Text>
        <Text style={styles.comingSoonText}>
          We're partnering with top pickleball brands to bring you exclusive deals and gear recommendations tailored to your game.
        </Text>
      </View>

      {/* Categories */}
      {CATEGORIES.map((category, i) => (
        <View key={i}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryEmoji}>{category.emoji}</Text>
            <Text style={styles.categoryTitle}>{category.title}</Text>
          </View>
          <View style={styles.card}>
            {category.brands.map((brand, j) => (
              <BrandCard
                key={j}
                name={brand.name}
                description={brand.description}
                url={brand.url}
              />
            ))}
          </View>
        </View>
      ))}
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

  // Coming soon banner
  comingSoonBanner: {
    backgroundColor: "#0d1f0d",
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: GREEN,
  },
  comingSoonTitle: { color: GREEN_BRIGHT, fontSize: 15, fontWeight: "700", marginBottom: 6 },
  comingSoonText: { color: "#86efac", fontSize: 13, lineHeight: 20 },

  // Category
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  categoryEmoji: { fontSize: 20 },
  categoryTitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  // Card
  card: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: "hidden",
  },

  // Brand card
  brandCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  brandCardLeft: { flex: 1 },
  brandName: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "600", marginBottom: 3 },
  brandDescription: { color: TEXT_MUTED, fontSize: 13 },
  brandChevron: { color: TEXT_MUTED, fontSize: 20, marginLeft: 8 },
});