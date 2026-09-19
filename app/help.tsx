import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

// ─── FAQ Data ─────────────────────────────────────────────────────────────────

const FAQS = [
  {
    category: "Getting Started",
    items: [
      {
        q: "How do I generate my first training plan?",
        a: "After completing your profile setup, PickleFit automatically generates a personalized 7-day plan based on your goals, fitness level, and DUPR rating. You can regenerate your plan anytime from the Plan tab.",
      },
      {
        q: "What is a DUPR rating?",
        a: "DUPR (Dynamic Universal Pickleball Rating) is the most accurate pickleball rating system in the world. It ranges from 2.0 (beginner) to 8.0 (professional). If you don't know yours, enter 2.0 and update it as you improve.",
      },
      {
        q: "Can I change my profile information?",
        a: "Yes — go to More → Profile to view your current profile. Full profile editing is coming soon, which will also regenerate your plan with your updated information.",
      },
    ],
  },
  {
    category: "Workouts",
    items: [
      {
        q: "How do I start a workout?",
        a: "Tap 'Start Workout' on the home screen to launch today's session. The timer starts automatically and you can log sets, reps, and weights as you go.",
      },
      {
        q: "What if I want to skip an exercise?",
        a: "Inside the active workout screen, tap 'Skip' on any exercise card. It will be marked as skipped and won't count toward your logged sets.",
      },
      {
        q: "Can I add or remove sets?",
        a: "Yes — inside each exercise card during a workout, use the '+ Add Set' and '− Remove Set' buttons to adjust your sets on the fly.",
      },
      {
        q: "What does the rest timer do?",
        a: "After logging a set, a rest timer automatically pops up counting down from 60 seconds. You can adjust the time with the +15s and −15s buttons, or skip it entirely.",
      },
      {
        q: "How do I view a demo of an exercise?",
        a: "Tap the '▶ Demo' button next to any exercise name to open a YouTube search for that exercise. This opens in your browser.",
      },
    ],
  },
  {
    category: "Your Plan",
    items: [
      {
        q: "How does the AI personalize my plan?",
        a: "PickleFit AI uses your DUPR rating, fitness goals, available equipment, injuries, and post-workout feedback to generate and adapt your plan. The more workouts you complete and rate, the smarter it gets.",
      },
      {
        q: "How often should I regenerate my plan?",
        a: "Your plan is designed as a 7-day cycle. After completing the week, regenerate a new plan to keep progressing. The AI will factor in your recent feedback automatically.",
      },
      {
        q: "Why does my plan include both gym and pickleball days?",
        a: "PickleFit alternates between fitness/strength days and pickleball skill days to build well-rounded performance. Gym days improve your athleticism; skill days improve your court game.",
      },
    ],
  },
  {
    category: "Progress & Tracking",
    items: [
      {
        q: "Where can I see my workout history?",
        a: "Go to the Progress tab to view your recent workouts, personal bests, volume trends, and weekly frequency charts.",
      },
      {
        q: "What is the Workout Catalog?",
        a: "The Workout Catalog in the Progress tab shows every exercise you've ever logged, along with your personal records for weight, reps, and duration.",
      },
      {
        q: "How is my weekly progress calculated?",
        a: "Weekly progress is based on the number of workouts you've completed since your plan started, divided by your available training days per week.",
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Pressable
      style={[styles.faqItem, open && styles.faqItemOpen]}
      onPress={() => setOpen((v) => !v)}
    >
      <View style={styles.faqRow}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Text style={styles.faqChevron}>{open ? "−" : "+"}</Text>
      </View>
      {open && <Text style={styles.faqAnswer}>{answer}</Text>}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HelpScreen() {
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

      <Text style={styles.heading}>Help</Text>
      <Text style={styles.subheading}>
        Find answers to common questions or get in touch with our team.
      </Text>

      {/* FAQ */}
      {FAQS.map((section, i) => (
        <View key={i}>
          <Text style={styles.sectionHeader}>{section.category}</Text>
          <View style={styles.card}>
            {section.items.map((item, j) => (
              <FAQItem
                key={j}
                question={item.q}
                answer={item.a}
              />
            ))}
          </View>
        </View>
      ))}

      {/* Contact support */}
      <Text style={styles.sectionHeader}>Contact Support</Text>
      <View style={styles.contactCard}>
        <Text style={styles.contactTitle}>Still need help?</Text>
        <Text style={styles.contactText}>
          Our support team is here for you. Send us an email and we'll get back to you within 24 hours.
        </Text>
        <Pressable
          style={styles.contactBtn}
          onPress={() => Linking.openURL("mailto:support@picklefit.app?subject=PickleFit Support Request")}
        >
          <Text style={styles.contactBtnText}>Email Support</Text>
        </Pressable>
        <Text style={styles.contactNote}>
          📧 support@picklefit.app
        </Text>
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
const SURFACE2 = "#252525";
const BORDER = "#2a2a2a";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED = "#888888";

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BG },
  scrollContent: { padding: 20, paddingTop: 70, paddingBottom: 120 },

  backBtn: { marginBottom: 20 },
  backBtnText: { color: GREEN, fontSize: 16, fontWeight: "600" },

  heading: { color: TEXT_PRIMARY, fontSize: 34, fontWeight: "700", marginBottom: 6 },
  subheading: { color: TEXT_MUTED, fontSize: 16, lineHeight: 22, marginBottom: 28 },

  sectionHeader: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },

  // FAQ
  card: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: "hidden",
  },
  faqItem: {
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  faqItemOpen: { backgroundColor: SURFACE2 },
  faqRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  faqQuestion: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    lineHeight: 20,
  },
  faqChevron: {
    color: GREEN,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 22,
  },
  faqAnswer: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 21,
    marginTop: 10,
  },

  // Contact
  contactCard: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: GREEN,
    alignItems: "center",
  },
  contactTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  contactText: {
    color: TEXT_MUTED,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  contactBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  contactBtnText: { color: "#000", fontSize: 15, fontWeight: "700" },
  contactNote: { color: TEXT_MUTED, fontSize: 13 },
});