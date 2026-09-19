import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

export default function SettingsScreen() {
  const router = useRouter();

  // Placeholder toggle states
  const [notifications, setNotifications] = useState(true);
  const [workoutReminders, setWorkoutReminders] = useState(true);

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

      <Text style={styles.heading}>Settings</Text>
      <Text style={styles.subheading}>Manage your app preferences.</Text>

      {/* Notifications */}
      <Text style={styles.sectionHeader}>Notifications</Text>
      <View style={styles.card}>
        <SettingsRow
          label="Push Notifications"
          subtitle="Receive app notifications"
          value={notifications}
          onToggle={setNotifications}
        />
        <SettingsRow
          label="Workout Reminders"
          subtitle="Daily reminder to train"
          value={workoutReminders}
          onToggle={setWorkoutReminders}
          last
        />
      </View>

      {/* Account */}
      <Text style={styles.sectionHeader}>Account</Text>
      <View style={styles.card}>
        <SettingsLink label="Edit Profile" onPress={() => router.push("/profile")} />
        <SettingsLink label="Change Password" onPress={() => {}} />
        <SettingsLink label="Privacy Policy" onPress={() => {}} />
        <SettingsLink label="Terms of Service" onPress={() => {}} last />
      </View>

      {/* Danger zone */}
      <Text style={styles.sectionHeader}></Text>
      <View style={styles.card}>
        <SettingsLink
          label="Delete Account"
          onPress={() => {}}
          destructive
          last
        />
      </View>

      <Text style={styles.versionText}>PickleFit v1.0.0 · More features coming soon</Text>
    </ScrollView>
  );
}

// ─── Row components ───────────────────────────────────────────────────────────

function SettingsRow({
  label,
  subtitle,
  value,
  onToggle,
  last,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#333", true: "#14532d" }}
        thumbColor={value ? "#22c55e" : "#666"}
      />
    </View>
  );
}

function SettingsLink({
  label,
  onPress,
  destructive,
  last,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.row, last && styles.rowLast]} onPress={onPress}>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
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
  subheading: { color: TEXT_MUTED, fontSize: 16, marginBottom: 28 },

  sectionHeader: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },

  card: {
    backgroundColor: SURFACE,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { color: TEXT_PRIMARY, fontSize: 15, fontWeight: "500" },
  rowLabelDestructive: { color: "#ef4444" },
  rowSubtitle: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  rowChevron: { color: TEXT_MUTED, fontSize: 20 },

  versionText: {
    color: "#333",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
});