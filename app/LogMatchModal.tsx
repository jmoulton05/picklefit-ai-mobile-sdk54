import { useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "./lib/supabase";

// Pickleball focus areas — same vocabulary as the profile/onboarding, so match
// surveys feed the plan generator using terms it already understands.
const PICKLE_FOCUS: { key: string; label: string }[] = [
  { key: "dinking", label: "Dinking" },
  { key: "serves_returns", label: "Serves/Returns" },
  { key: "third_shot", label: "Third Shot" },
  { key: "volleys", label: "Volleys" },
  { key: "resets", label: "Resets" },
  { key: "lobs", label: "Lobs" },
  { key: "overheads_putaways", label: "Overheads/Putaways" },
  { key: "footwork_positioning", label: "Footwork/Positioning" },
  { key: "flicks", label: "Flicks" },
  { key: "speedups", label: "Speedups" },
  { key: "counters", label: "Counters" },
];

// ─── Log Match Modal ──────────────────────────────────────────────────────────
// A quick match-logging form: Singles/Doubles toggle, your/opponent score,
// and notes. Win/loss is derived from the scores. Date is auto-stamped.

export default function LogMatchModal({
  visible,
  onClose,
  onLogged,
}: {
  visible: boolean;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const [format, setFormat] = useState<"singles" | "doubles">("singles");
  const [yourScore, setYourScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [notes, setNotes] = useState("");
  const [wentWell, setWentWell] = useState<string[]>([]);
  const [needsImprovement, setNeedsImprovement] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (
    list: string[],
    setList: (v: string[]) => void,
    key: string
  ) => {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  };

  const reset = () => {
    setFormat("singles");
    setYourScore("");
    setOpponentScore("");
    setNotes("");
    setWentWell([]);
    setNeedsImprovement([]);
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    setError("");
    const ys = parseInt(yourScore);
    const os = parseInt(opponentScore);

    if (isNaN(ys) || isNaN(os)) {
      setError("Please enter both scores.");
      return;
    }
    if (ys === os) {
      setError("Scores can't be tied — there must be a winner.");
      return;
    }

    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSaving(false);
      setError("You must be signed in to log a match.");
      return;
    }

    const { error: insertError } = await supabase.from("matches").insert({
      user_id: userData.user.id,
      format,
      your_score: ys,
      opponent_score: os,
      won: ys > os,
      notes: notes.trim() || null,
      went_well: wentWell,
      needs_improvement: needsImprovement,
    });

    setSaving(false);
    if (insertError) {
      setError("Couldn't save the match. Please try again.");
      return;
    }

    // Fire the adaptive agent in the background (not awaited) so a demonstrated
    // match weakness can flow into the plan. Safe to ignore failures here.
    supabase.functions
      .invoke("adjust-plan", { body: { user_id: userData.user.id } })
      .catch(() => {});

    reset();
    onLogged?.();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={{ flex: 1 }} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Log Match</Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {/* Singles / Doubles toggle */}
          <Text style={styles.fieldLabel}>Format</Text>
          <View style={styles.toggleRow}>
            {(["singles", "doubles"] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setFormat(opt)}
                style={[styles.toggleBtn, format === opt && styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleText, format === opt && styles.toggleTextActive]}>
                  {opt === "singles" ? "Singles" : "Doubles"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Scores */}
          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={styles.fieldLabel}>Your Score</Text>
              <TextInput
                style={styles.scoreInput}
                value={yourScore}
                onChangeText={setYourScore}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#555"
                maxLength={3}
              />
            </View>
            <View style={styles.scoreDivider}>
              <Text style={styles.scoreDividerText}>–</Text>
            </View>
            <View style={styles.scoreCol}>
              <Text style={styles.fieldLabel}>Opponent</Text>
              <TextInput
                style={styles.scoreInput}
                value={opponentScore}
                onChangeText={setOpponentScore}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#555"
                maxLength={3}
              />
            </View>
          </View>

          {/* Optional skill survey — feeds the adaptive plan over time */}
          <Text style={styles.fieldLabel}>What went well? (optional)</Text>
          <View style={styles.chipWrap}>
            {PICKLE_FOCUS.map(({ key, label }) => {
              const sel = wentWell.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => toggle(wentWell, setWentWell, key)}
                  style={[styles.chip, sel ? styles.chipWell : styles.chipOff]}
                >
                  <Text style={[styles.chipText, sel ? styles.chipTextWell : styles.chipTextOff]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>What needs improvement? (optional)</Text>
          <View style={styles.chipWrap}>
            {PICKLE_FOCUS.map(({ key, label }) => {
              const sel = needsImprovement.includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => toggle(needsImprovement, setNeedsImprovement, key)}
                  style={[styles.chip, sel ? styles.chipImprove : styles.chipOff]}
                >
                  <Text style={[styles.chipText, sel ? styles.chipTextImprove : styles.chipTextOff]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Notes */}
          <Text style={styles.fieldLabel}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="What worked, what to improve..."
            placeholderTextColor="#555"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveBtnText}>Save Match</Text>
            )}
          </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const GREEN = "#22c55e";
const GREEN_DIM = "#14532d";
const GREEN_BRIGHT = "#4ade80";
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
    maxHeight: Dimensions.get("window").height * 0.85,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  title: { color: "#fff", fontSize: 22, fontWeight: "700" },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: SURFACE, justifyContent: "center", alignItems: "center" },
  closeBtnText: { color: "#fff", fontSize: 13 },

  fieldLabel: { color: TEXT_MUTED, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },

  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  toggleBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center",
    backgroundColor: SURFACE2, borderWidth: 1, borderColor: BORDER,
  },
  toggleBtnActive: { backgroundColor: GREEN_DIM, borderColor: GREEN },
  toggleText: { color: TEXT_MUTED, fontSize: 15, fontWeight: "600" },
  toggleTextActive: { color: GREEN_BRIGHT },

  scoreRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 18 },
  scoreCol: { flex: 1 },
  scoreInput: {
    backgroundColor: SURFACE2, color: "#fff", fontSize: 28, fontWeight: "700",
    borderRadius: 14, paddingVertical: 14, textAlign: "center",
    borderWidth: 1, borderColor: BORDER,
  },
  scoreDivider: { paddingHorizontal: 14, paddingBottom: 14 },
  scoreDividerText: { color: TEXT_MUTED, fontSize: 24, fontWeight: "700" },

  notesInput: {
    backgroundColor: SURFACE2, color: "#fff", fontSize: 15,
    borderRadius: 14, padding: 14, minHeight: 80,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },

  errorText: { color: "#ef4444", fontSize: 13, marginBottom: 8, textAlign: "center" },

  // ── Survey chips ──
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipOff: { backgroundColor: SURFACE2, borderColor: BORDER },
  chipWell: { backgroundColor: GREEN_DIM, borderColor: GREEN },
  chipImprove: { backgroundColor: GREEN_DIM, borderColor: GREEN_BRIGHT },
  chipText: { fontSize: 13, fontWeight: "600" },
  chipTextOff: { color: TEXT_MUTED },
  chipTextWell: { color: GREEN_BRIGHT },
  chipTextImprove: { color: GREEN_BRIGHT },

  saveBtn: { backgroundColor: GREEN, borderRadius: 16, padding: 16, alignItems: "center", marginTop: 8 },
  saveBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
});