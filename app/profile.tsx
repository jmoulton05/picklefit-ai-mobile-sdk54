import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "./lib/supabase";
import { BADGES, getLevel, getLevelProgress, xpToNextLevel } from "./lib/xp";

// Darken a hex color by a factor (0–1) — used to build the level-bar gradient
// that fades from a deeper shade of the tier color up to the tier color itself.
const darkenHex = (hex: string, factor = 0.55): string => {
  const h = hex.replace("#", "");
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  first_name: string;
  age: number;
  gender: string;
  height: string;
  weight: number;
  dupr_rating: number;
  workout_frequency: number;
  days_per_week: number;
  session_length: string;
  goal: string;
  pickle_focus_area: string[];
  fit_focus_area: string[];
  injuries: string;
  equipment: string[];
  other_equipment: string;
}

type EditingField = keyof Profile | null;

// Normalize the badges column to a real string array. Supabase may return it as
// a JS array, a JSON array string ("[\"a\",\"b\"]"), or a Postgres literal ("{a,b}").
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

// ─── Label maps ───────────────────────────────────────────────────────────────

const GOAL_LABELS: Record<string, string> = {
  learn_fundamentals: "Learn the fundamentals",
  improve_fitness: "Improve fitness",
  general_improvement: "General improvement",
  "be_5.0": "Want to be 5.0+",
};

const PICKLE_FOCUS_LABELS: Record<string, string> = {
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

const FITNESS_FOCUS_LABELS: Record<string, string> = {
  speed: "Speed",
  endurance: "Endurance",
  strength: "Strength",
  balance_stability: "Balance/Stability",
  agility: "Agility",
  flexibility_mobility: "Flexibility/Mobility",
  reaction_time: "Reaction Time",
  injury_prevention: "Injury Prevention",
  weight_loss: "Weight Loss",
};

const EQUIPMENT_LABELS: Record<string, string> = {
  gym_access: "Gym Access",
  dumbbells_medicine_ball: "Dumbbells/Medicine Ball",
  resistance_bands: "Resistance Bands",
  cardio_machines: "Cardio Machines",
  jump_rope: "Jump Rope",
  agility_ladder: "Agility Ladder",
  none: "None",
  other: "Other",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

const SESSION_LABELS: Record<string, string> = {
  "30": "30 minutes",
  "45": "45 minutes",
  "60": "60 minutes",
  "90": "90 minutes",
  "120+": "120+ minutes",
};

// Fields that should trigger a regen prompt when changed
const REGEN_FIELDS = new Set<keyof Profile>([
  "dupr_rating", "workout_frequency", "days_per_week", "session_length",
  "goal", "pickle_focus_area", "fit_focus_area", "injuries", "equipment", "other_equipment",
]);

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

// ─── Editable Row ─────────────────────────────────────────────────────────────

function EditableRow({
  label,
  field,
  displayValue,
  editingField,
  editingValue,
  onEdit,
  onChangeText,
  onSaveField,
  keyboardType = "default",
}: {
  label: string;
  field: EditingField;
  displayValue: string;
  editingField: EditingField;
  editingValue: string;
  onEdit: (field: EditingField, current: string) => void;
  onChangeText: (val: string) => void;
  onSaveField: () => void;
  keyboardType?: "default" | "numeric" | "decimal-pad";
}) {
  const isEditing = editingField === field;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {isEditing ? (
        <View style={styles.inlineEditRow}>
          <TextInput
            style={styles.inlineInput}
            value={editingValue}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            autoFocus
            selectTextOnFocus
          />
          <Pressable style={styles.saveFieldBtn} onPress={onSaveField}>
            <Text style={styles.saveFieldBtnText}>✓</Text>
          </Pressable>
          <Pressable style={styles.cancelFieldBtn} onPress={() => onEdit(null, "")}>
            <Text style={styles.cancelFieldBtnText}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.rowRight}>
          <Text style={styles.rowValue}>{displayValue || "—"}</Text>
          <Pressable onPress={() => onEdit(field, displayValue)} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Pill Picker Row ──────────────────────────────────────────────────────────

function PillPickerRow({
  label,
  field,
  values,
  options,
  labelMap,
  editingField,
  onEdit,
  onToggle,
  onSaveField,
  multi = true,
}: {
  label: string;
  field: keyof Profile;
  values: string[];
  options: string[];
  labelMap: Record<string, string>;
  editingField: EditingField;
  onEdit: (field: EditingField, current: string) => void;
  onToggle: (field: keyof Profile, val: string) => void;
  onSaveField: () => void;
  multi?: boolean;
}) {
  const isEditing = editingField === field;
  return (
    <View style={styles.pillPickerBlock}>
      <View style={styles.pillPickerHeader}>
        <Text style={styles.tagSectionLabel}>{label}</Text>
        {!isEditing ? (
          <Pressable onPress={() => onEdit(field, "")} style={styles.editBtn}>
            <Text style={styles.editBtnText}>Edit</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onSaveField} style={styles.saveFieldBtn}>
            <Text style={styles.saveFieldBtnText}>Done</Text>
          </Pressable>
        )}
      </View>
      {isEditing ? (
        <View style={styles.tagRow}>
          {options.map((opt) => {
            const selected = values.includes(opt);
            return (
              <Pressable
                key={opt}
                onPress={() => onToggle(field, opt)}
                style={[styles.tag, selected ? styles.tagSelected : styles.tagUnselected]}
              >
                <Text style={[styles.tagText, !selected && styles.tagTextUnselected]}>
                  {labelMap[opt] || opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.tagRow}>
          {values && values.length > 0 ? (
            values.map((v, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{labelMap[v] || v}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>None selected</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Regen Prompt Modal ───────────────────────────────────────────────────────

function RegenPromptModal({
  visible,
  onRegenerate,
  onSkip,
  regenerating,
}: {
  visible: boolean;
  onRegenerate: () => void;
  onSkip: () => void;
  regenerating: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <Text style={styles.modalTitle}>Regenerate Your Plan?</Text>
          <Text style={styles.modalSub}>
            You updated fields that affect your training plan. Would you like to generate a new plan based on your updated profile?
          </Text>
          <Pressable
            style={[styles.regenBtn, regenerating && { opacity: 0.6 }]}
            onPress={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.regenBtnText}>Generate New Plan</Text>
            )}
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={onSkip} disabled={regenerating}>
            <Text style={styles.skipBtnText}>Keep Current Plan</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [daysActive, setDaysActive] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [editingValue, setEditingValue] = useState("");
  const [changedFields, setChangedFields] = useState<Set<keyof Profile>>(new Set());
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [xp, setXp] = useState(0);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setLoading(false); return; }
    setUserId(userData.user.id);

    const { data } = await supabase
      .from("profiles")
      .select("first_name, age, gender, height, weight, dupr_rating, workout_frequency, days_per_week, session_length, goal, pickle_focus_area, fit_focus_area, injuries, equipment, other_equipment, xp, badges")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (data) {
      setXp(data.xp || 0);
      setEarnedBadges(parseBadges((data as any).badges));
    }

    // Strip gamification fields from the editable profile/draft
    const profileFields = data
      ? (() => {
          const { xp: _xp, badges: _badges, ...rest } = data as any;
          return rest as Profile;
        })()
      : null;

    setProfile(profileFields);
    setDraft(profileFields ? { ...profileFields } : null);

    if (userData.user.created_at) {
      const start = new Date(userData.user.created_at);
      start.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      setDaysActive(diff + 1);
    }

    const { count } = await supabase
      .from("workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .not("completed_at", "is", null);
    setTotalWorkouts(count || 0);
    setLoading(false);
  };

  // ── Inline text field editing ──
  const handleEdit = (field: EditingField, current: string) => {
    setEditingField(field);
    setEditingValue(current);
  };

  const handleSaveField = () => {
    if (!editingField || !draft) return;
    const updated = { ...draft, [editingField]: editingValue };
    setDraft(updated);
    setChangedFields((prev) => new Set([...prev, editingField]));
    setEditingField(null);
    setEditingValue("");
  };

  // ── Pill toggle ──
  const handleToggle = (field: keyof Profile, val: string) => {
    if (!draft) return;
    const current = (draft[field] as string[]) || [];
    const updated = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val];
    setDraft({ ...draft, [field]: updated });
    setChangedFields((prev) => new Set([...prev, field]));
  };

  // ── Single-select pill (goal, gender, session_length) ──
  const handleSelectOne = (field: keyof Profile, val: string) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: val });
    setChangedFields((prev) => new Set([...prev, field]));
  };

  const handleSavePillField = () => {
    setEditingField(null);
  };

  // ── Save all changes ──
  const handleSaveAll = async () => {
    if (!draft || !userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update(draft)
      .eq("id", userId);
    setSaving(false);
    if (error) {
      Alert.alert("Error", "Failed to save changes. Please try again.");
      return;
    }
    setProfile({ ...draft });
    const needsRegen = [...changedFields].some((f) => REGEN_FIELDS.has(f));
    setChangedFields(new Set());
    if (needsRegen) {
      setShowRegenModal(true);
    }
  };

  // ── Regenerate plan ──
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const { data: fullProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      const { data, error } = await supabase.functions.invoke("generate-plan", {
        body: { profile: fullProfile },
      });

      // generate-plan returns a friendly `message` on a handled failure
      // (e.g. Gemini high demand). Surface it instead of a generic error.
      if (error || !data?.plan) {
        const friendly =
          data?.message ||
          "Failed to generate plan. Please try again in a moment.";
        Alert.alert("Couldn't generate plan", friendly);
        return;
      }

      await supabase
        .from("profiles")
        .update({ current_plan: data.plan, plan_created_at: new Date().toISOString() })
        .eq("id", userId);

      setShowRegenModal(false);
    } catch (e) {
      Alert.alert("Couldn't generate plan", "Something went wrong. Please try again in a moment.");
    } finally {
      setRegenerating(false);
    }
  };

  const hasDraftChanges = changedFields.size > 0;

  const level = getLevel(xp);
  const levelProgress = getLevelProgress(xp);
  const xpRemaining = xpToNextLevel(xp);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Profile not found.</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </Pressable>

        {/* Avatar + name */}
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {draft.first_name?.slice(0, 2).toUpperCase() || "?"}
            </Text>
          </View>
          <View>
            <Text style={styles.name}>{draft.first_name || "Athlete"}</Text>
            <Text style={styles.duprBadge}>DUPR {draft.dupr_rating ?? "—"}</Text>
          </View>
        </View>

        {/* Activity stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{daysActive}</Text>
            <Text style={styles.statLabel}>Days Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{draft.dupr_rating ?? "—"}</Text>
            <Text style={styles.statLabel}>DUPR</Text>
          </View>
        </View>

        {/* ── Level / XP ── */}
        <SectionHeader title="Level" />
        <View style={styles.card}>
          <View style={styles.levelCardHeader}>
            <View style={styles.levelBadge}>
              <MaterialCommunityIcons name="trophy-variant" size={20} color={level.color} />
              <Text style={[styles.levelBadgeText, { color: level.color }]}>{level.name}</Text>
            </View>
            <Text style={styles.levelXpText}>{xp.toLocaleString()} XP</Text>
          </View>
          <View style={styles.levelTrack}>
            <LinearGradient
              colors={[darkenHex(level.color), level.color]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.levelFill, { width: `${Math.round(levelProgress * 100)}%` as any }]}
            />
          </View>
          <Text style={styles.levelHint}>
            {xpRemaining > 0
              ? `${xpRemaining.toLocaleString()} XP to next level`
              : "Max level reached — you're Elite! 🏆"}
          </Text>
        </View>

        {/* ── Badges ── */}
        <SectionHeader title="Badges" />
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
                    <Text style={styles.badgeLockedHint} numberOfLines={2}>
                      {badge.description}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Personal Info ── */}
        <SectionHeader title="Personal Info" />
        <View style={styles.card}>
          <EditableRow
            label="First Name"
            field="first_name"
            displayValue={draft.first_name}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
          />
          <EditableRow
            label="Age"
            field="age"
            displayValue={draft.age ? `${draft.age}` : ""}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
            keyboardType="numeric"
          />

          {/* Gender — single-select pills */}
          <View style={styles.pillPickerBlock}>
            <View style={styles.pillPickerHeader}>
              <Text style={styles.rowLabel}>Gender</Text>
              {editingField !== "gender" ? (
                <Pressable onPress={() => handleEdit("gender", draft.gender)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleSavePillField} style={styles.saveFieldBtn}>
                  <Text style={styles.saveFieldBtnText}>Done</Text>
                </Pressable>
              )}
            </View>
            {editingField === "gender" ? (
              <View style={styles.tagRow}>
                {Object.entries(GENDER_LABELS).map(([val, lbl]) => (
                  <Pressable
                    key={val}
                    onPress={() => handleSelectOne("gender", val)}
                    style={[styles.tag, draft.gender === val ? styles.tagSelected : styles.tagUnselected]}
                  >
                    <Text style={[styles.tagText, draft.gender !== val && styles.tagTextUnselected]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.pillDisplayValue}>{GENDER_LABELS[draft.gender] || draft.gender || "—"}</Text>
            )}
          </View>

          <EditableRow
            label="Height"
            field="height"
            displayValue={draft.height}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
          />
          <EditableRow
            label="Weight (lbs)"
            field="weight"
            displayValue={draft.weight ? `${draft.weight}` : ""}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
            keyboardType="numeric"
          />
        </View>

        {/* ── Training ── */}
        <SectionHeader title="Training" />
        <View style={styles.card}>
          <EditableRow
            label="DUPR Rating"
            field="dupr_rating"
            displayValue={draft.dupr_rating ? `${draft.dupr_rating}` : ""}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
            keyboardType="decimal-pad"
          />
          <EditableRow
            label="Current Workout Freq."
            field="workout_frequency"
            displayValue={draft.workout_frequency ? `${draft.workout_frequency}` : ""}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
            keyboardType="numeric"
          />
          <EditableRow
            label="Training Days/Week"
            field="days_per_week"
            displayValue={draft.days_per_week ? `${draft.days_per_week}` : ""}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
            keyboardType="numeric"
          />

          {/* Session Length — single-select pills */}
          <View style={styles.pillPickerBlock}>
            <View style={styles.pillPickerHeader}>
              <Text style={styles.rowLabel}>Session Length</Text>
              {editingField !== "session_length" ? (
                <Pressable onPress={() => handleEdit("session_length", draft.session_length)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleSavePillField} style={styles.saveFieldBtn}>
                  <Text style={styles.saveFieldBtnText}>Done</Text>
                </Pressable>
              )}
            </View>
            {editingField === "session_length" ? (
              <View style={styles.tagRow}>
                {Object.entries(SESSION_LABELS).map(([val, lbl]) => (
                  <Pressable
                    key={val}
                    onPress={() => handleSelectOne("session_length", val)}
                    style={[styles.tag, draft.session_length === val ? styles.tagSelected : styles.tagUnselected]}
                  >
                    <Text style={[styles.tagText, draft.session_length !== val && styles.tagTextUnselected]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.pillDisplayValue}>{SESSION_LABELS[draft.session_length] || draft.session_length || "—"}</Text>
            )}
          </View>
        </View>

        {/* ── Goals ── */}
        <SectionHeader title="Goals" />
        <View style={styles.card}>
          {/* Overall Goal — single-select pills */}
          <View style={styles.pillPickerBlock}>
            <View style={styles.pillPickerHeader}>
              <Text style={styles.rowLabel}>Overall Goal</Text>
              {editingField !== "goal" ? (
                <Pressable onPress={() => handleEdit("goal", draft.goal)} style={styles.editBtn}>
                  <Text style={styles.editBtnText}>Edit</Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleSavePillField} style={styles.saveFieldBtn}>
                  <Text style={styles.saveFieldBtnText}>Done</Text>
                </Pressable>
              )}
            </View>
            {editingField === "goal" ? (
              <View style={styles.tagRow}>
                {Object.entries(GOAL_LABELS).map(([val, lbl]) => (
                  <Pressable
                    key={val}
                    onPress={() => handleSelectOne("goal", val)}
                    style={[styles.tag, draft.goal === val ? styles.tagSelected : styles.tagUnselected]}
                  >
                    <Text style={[styles.tagText, draft.goal !== val && styles.tagTextUnselected]}>{lbl}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={styles.pillDisplayValue}>{GOAL_LABELS[draft.goal] || draft.goal || "—"}</Text>
            )}
          </View>

          <PillPickerRow
            label="Pickleball Focus"
            field="pickle_focus_area"
            values={draft.pickle_focus_area || []}
            options={Object.keys(PICKLE_FOCUS_LABELS)}
            labelMap={PICKLE_FOCUS_LABELS}
            editingField={editingField}
            onEdit={handleEdit}
            onToggle={handleToggle}
            onSaveField={handleSavePillField}
          />
          <PillPickerRow
            label="Fitness Focus"
            field="fit_focus_area"
            values={draft.fit_focus_area || []}
            options={Object.keys(FITNESS_FOCUS_LABELS)}
            labelMap={FITNESS_FOCUS_LABELS}
            editingField={editingField}
            onEdit={handleEdit}
            onToggle={handleToggle}
            onSaveField={handleSavePillField}
          />
        </View>

        {/* ── Injuries & Equipment ── */}
        <SectionHeader title="Injuries & Equipment" />
        <View style={styles.card}>
          <EditableRow
            label="Injuries"
            field="injuries"
            displayValue={draft.injuries || ""}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
          />
          <PillPickerRow
            label="Equipment"
            field="equipment"
            values={draft.equipment || []}
            options={Object.keys(EQUIPMENT_LABELS)}
            labelMap={EQUIPMENT_LABELS}
            editingField={editingField}
            onEdit={handleEdit}
            onToggle={handleToggle}
            onSaveField={handleSavePillField}
          />
          <EditableRow
            label="Other Equipment"
            field="other_equipment"
            displayValue={draft.other_equipment || ""}
            editingField={editingField}
            editingValue={editingValue}
            onEdit={handleEdit}
            onChangeText={setEditingValue}
            onSaveField={handleSaveField}
          />
        </View>

        {/* ── Save Changes button ── */}
        {hasDraftChanges && (
          <Pressable
            style={[styles.saveAllBtn, saving && { opacity: 0.6 }]}
            onPress={handleSaveAll}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#000" />
              : <Text style={styles.saveAllBtnText}>Save Changes</Text>
            }
          </Pressable>
        )}
      </ScrollView>

      <RegenPromptModal
        visible={showRegenModal}
        onRegenerate={handleRegenerate}
        onSkip={() => setShowRegenModal(false)}
        regenerating={regenerating}
      />
    </>
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
  scrollContent: { padding: 20, paddingTop: 70, paddingBottom: 140 },
  centered: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },

  backBtn: { marginBottom: 20 },
  backBtnText: { color: GREEN, fontSize: 16, fontWeight: "600" },

  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16, marginBottom: 28 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: GREEN_DIM, justifyContent: "center", alignItems: "center" },
  avatarText: { color: GREEN_BRIGHT, fontSize: 22, fontWeight: "700" },
  name: { color: TEXT_PRIMARY, fontSize: 26, fontWeight: "700", marginBottom: 4 },
  duprBadge: { color: GREEN, fontSize: 14, fontWeight: "600" },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: SURFACE, borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 0.5, borderColor: BORDER },
  statValue: { color: GREEN_BRIGHT, fontSize: 22, fontWeight: "700", marginBottom: 4 },
  statLabel: { color: TEXT_MUTED, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" },

  // ── Level / XP ──
  levelCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  levelBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelBadgeText: { color: "#facc15", fontSize: 17, fontWeight: "700" },
  levelXpText: { color: TEXT_MUTED, fontSize: 14, fontWeight: "600" },
  levelTrack: { backgroundColor: "#333", height: 10, borderRadius: 20, overflow: "hidden", marginBottom: 10 },
  levelFill: { backgroundColor: "#facc15", height: "100%", borderRadius: 20 },
  levelHint: { color: TEXT_MUTED, fontSize: 13 },

  // ── Badges ──
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

  sectionHeader: { color: TEXT_MUTED, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginTop: 8 },

  card: { backgroundColor: SURFACE, borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: BORDER },

  // ── Row ──
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  rowLabel: { color: TEXT_MUTED, fontSize: 14, flexShrink: 0 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, justifyContent: "flex-end" },
  rowValue: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: "600", textAlign: "right" },

  // ── Inline edit ──
  inlineEditRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "flex-end" },
  inlineInput: { flex: 1, backgroundColor: SURFACE2, color: TEXT_PRIMARY, fontSize: 14, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: GREEN, textAlign: "right" },
  saveFieldBtn: { backgroundColor: GREEN, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  saveFieldBtnText: { color: "#000", fontSize: 13, fontWeight: "700" },
  cancelFieldBtn: { backgroundColor: SURFACE2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  cancelFieldBtnText: { color: TEXT_MUTED, fontSize: 13 },

  // ── Edit button ──
  editBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: BORDER },
  editBtnText: { color: TEXT_MUTED, fontSize: 12, fontWeight: "600" },

  // ── Pill picker ──
  pillPickerBlock: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  pillPickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  pillDisplayValue: { color: TEXT_PRIMARY, fontSize: 14, fontWeight: "600" },

  // ── Tags ──
  tagSectionLabel: { color: TEXT_MUTED, fontSize: 13 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  tag: { backgroundColor: GREEN_DIM, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  tagSelected: { backgroundColor: GREEN_DIM, borderWidth: 1.5, borderColor: GREEN },
  tagUnselected: { backgroundColor: SURFACE2, borderWidth: 1, borderColor: BORDER },
  tagText: { color: GREEN_BRIGHT, fontSize: 12, fontWeight: "600" },
  tagTextUnselected: { color: TEXT_MUTED },

  // ── Save all ──
  saveAllBtn: { backgroundColor: GREEN, borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 16 },
  saveAllBtnText: { color: "#000", fontSize: 17, fontWeight: "700" },

  // ── Regen modal ──
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalSheet: { backgroundColor: SURFACE, borderRadius: 24, padding: 28, width: "100%", borderWidth: 1, borderColor: GREEN },
  modalTitle: { color: TEXT_PRIMARY, fontSize: 20, fontWeight: "700", marginBottom: 10 },
  modalSub: { color: TEXT_MUTED, fontSize: 14, lineHeight: 21, marginBottom: 24 },
  regenBtn: { backgroundColor: GREEN, borderRadius: 14, padding: 15, alignItems: "center", marginBottom: 10 },
  regenBtnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  skipBtn: { borderRadius: 14, padding: 15, alignItems: "center", borderWidth: 1, borderColor: BORDER },
  skipBtnText: { color: TEXT_MUTED, fontSize: 15, fontWeight: "600" },

  emptyText: { color: TEXT_MUTED, fontSize: 14 },
});