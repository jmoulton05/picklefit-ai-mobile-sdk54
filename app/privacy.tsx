import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// ─── Privacy Policy Content ───────────────────────────────────────────────────

const SECTIONS = [
  {
    title: "1. Introduction",
    content:
      "Welcome to PickleFit. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application. Please read this policy carefully. If you disagree with its terms, please discontinue use of the app.",
  },
  {
    title: "2. Information We Collect",
    content:
      "We collect information you provide directly to us when creating an account and building your profile, including your name, email address, age, gender, height, weight, DUPR rating, fitness goals, injuries, and equipment preferences. We also collect data you generate while using the app, such as workout logs, exercise sets, reps, weights, durations, and post-workout feedback ratings.",
  },
  {
    title: "3. How We Use Your Information",
    content:
      "We use the information we collect to provide and personalize your experience, including generating AI-powered training plans tailored to your profile and goals. Your workout feedback is used to improve future plan recommendations. We do not use your personal information for advertising purposes or sell it to third parties.",
  },
  {
    title: "4. Data Storage & Security",
    content:
      "Your data is stored securely using Supabase, a trusted cloud database provider. We implement industry-standard security measures including row-level security to ensure only you can access your personal data. However, no method of electronic storage is 100% secure and we cannot guarantee absolute security.",
  },
  {
    title: "5. Third-Party Services",
    content:
      "PickleFit uses Google Gemini AI to generate personalized training plans. Your profile data is sent to this service solely for the purpose of plan generation and is not stored or used by Google for any other purpose. We may include links to third-party websites in our Resources section. We are not responsible for the privacy practices of those sites.",
  },
  {
    title: "6. Data Retention",
    content:
      "We retain your personal data for as long as your account is active. If you delete your account, your personal information and workout history will be permanently deleted from our systems within 30 days. Some anonymized, non-identifiable data may be retained for analytical purposes.",
  },
  {
    title: "7. Your Rights",
    content:
      "You have the right to access, update, or delete your personal information at any time. You can update your profile information within the app. To request deletion of your account and all associated data, contact us at support@picklefit.app. We will process your request within 30 days.",
  },
  {
    title: "8. Children's Privacy",
    content:
      "PickleFit is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete that information immediately.",
  },
  {
    title: "9. Changes to This Policy",
    content:
      "We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the date at the bottom of this page and, where appropriate, through an in-app notification. Your continued use of PickleFit after changes are posted constitutes your acceptance of the updated policy.",
  },
  {
    title: "10. Contact Us",
    content:
      "If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at support@picklefit.app. We take privacy seriously and will respond to all inquiries within 48 hours.",
  },
];

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PrivacyScreen() {
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

      <Text style={styles.heading}>Privacy Policy</Text>
      <Text style={styles.lastUpdated}>Last updated: May 28, 2026</Text>
      <Text style={styles.intro}>
        Your privacy matters to us. This policy explains exactly what data PickleFit collects, how we use it, and your rights as a user.
      </Text>

      {SECTIONS.map((section, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionContent}>{section.content}</Text>
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          PickleFit is committed to protecting your privacy. If you have any questions, reach us at support@picklefit.app.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const GREEN = "#22c55e";
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
  lastUpdated: { color: TEXT_MUTED, fontSize: 13, marginBottom: 16 },
  intro: {
    color: "#d1d5db",
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 28,
    padding: 16,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
  },

  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  sectionContent: {
    color: TEXT_MUTED,
    fontSize: 14,
    lineHeight: 23,
  },

  footer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
  },
  footerText: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});