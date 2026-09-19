import { Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

// ─── Menu Item ────────────────────────────────────────────────────────────────

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <View style={styles.menuItemLeft}>
        <View style={styles.iconWrap}>{icon}</View>
        <Text style={styles.menuItemLabel}>{label}</Text>
      </View>
      <Text style={styles.menuItemArrow}>›</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MoreScreen() {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>More</Text>
        <Pressable onPress={() => router.push("/login")}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Menu items */}
      <View style={styles.menuCard}>
        <MenuItem
          icon={<Ionicons name="person-circle" size={26} color="#fff" />}
          label="Profile"
          onPress={() => router.push("/profile")}
        />
        <MenuItem
          icon={<MaterialCommunityIcons name="trophy-variant" size={24} color="#fff" />}
          label="Achievements"
          onPress={() => router.push("/achievements")}
        />
        <MenuItem
          icon={<MaterialCommunityIcons name="bookshelf" size={24} color="#fff" />}
          label="Libraries"
          onPress={() => router.push("/libraries")}
        />
        <MenuItem
          icon={<Ionicons name="settings" size={26} color="#fff" />}
          label="Settings"
          onPress={() => router.push("/settings")}
        />
        <MenuItem
          icon={<MaterialIcons name="my-library-books" size={26} color="#fff" />}
          label="Gear"
          onPress={() => router.push("/resources")}
        />
        <MenuItem
          icon={<MaterialIcons name="help-outline" size={26} color="#fff" />}
          label="Help"
          onPress={() => router.push("/help")}
        />
        <MenuItem
          icon={<FontAwesome5 name="user-friends" size={22} color="#fff" />}
          label="Community"
          onPress={() => router.push("/community")}
        />
        <MenuItem
          icon={<Feather name="lock" size={22} color="#fff" />}
          label="Privacy"
          onPress={() => router.push("/privacy")}
        />
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#111" },
  scrollContent: { paddingHorizontal: 20, paddingTop: 70, paddingBottom: 120 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  heading: { color: "#fff", fontSize: 32, fontWeight: "bold" },
  logoutText: { color: "#dc1212", fontSize: 16, fontWeight: "bold" },

  menuCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 18,
    overflow: "hidden",
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#2a2a2a",
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconWrap: { width: 28, alignItems: "center" },
  menuItemLabel: { color: "#fff", fontSize: 17, fontWeight: "600" },
  menuItemArrow: { color: "#555", fontSize: 24 },
});