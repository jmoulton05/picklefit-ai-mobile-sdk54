import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { MultiSelect } from "react-native-element-dropdown";
import { generateWorkoutPlan } from "./generatePlan";
import { supabase } from "./lib/supabase";

export default function InjuriesEquipmentScreen() {
  const [injuries, setInjuries] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [otherEquipment, setOtherEquipment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");

  const startProgressAnimation = () => {
    setTimeout(() => {
      setProgress(10);
      setStatusMessage("Saving your profile...");
    }, 2000);

    setTimeout(() => {
      setProgress(35);
      setStatusMessage("Analyzing your goals...");
    }, 4500);

    setTimeout(() => {
      setProgress(60);
      setStatusMessage("Building your pickleball workouts...");
    }, 7500);

    setTimeout(() => {
      setProgress(85);
      setStatusMessage("Finalizing your 7-day plan...");
    }, 10500);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f0f0f" }}
      contentContainerStyle={{ padding: 24, paddingTop: 70 }}
    >
      {/* Back button — hidden while generating */}
      {!isGenerating && (
        <Pressable onPress={() => router.back()} style={{ marginBottom: 20 }}>
          <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "600" }}>← Back</Text>
        </Pressable>
      )}

      <View>
        <Text style={{ color: "white", fontSize: 34, fontWeight: "bold" }}>
          Injuries & Equipment
        </Text>
        <Text style={{ color: "#aaa", fontSize: 16, marginTop: 10, lineHeight: 22 }}>
          Tell us about any injuries or equipment preferences to get a personalized training plan.
        </Text>
      </View>

      <View style={{ marginTop: 24, gap: 18 }}>
        <TextInput
          placeholder="List any current or past injuries:"
          placeholderTextColor="#777"
          value={injuries}
          onChangeText={setInjuries}
          style={{
            color: "#ffffff",
            fontSize: 16,
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            padding: 16,
          }}
        />

        <View>
          <MultiSelect
            data={[
              { label: "Gym Access", value: "gym_access" },
              { label: "Dumbbells/Medicine Ball", value: "dumbbells_medicine_ball" },
              { label: "Resistance Bands", value: "resistance_bands" },
              { label: "Cardio Machines", value: "cardio_machines" },
              { label: "Jump Rope", value: "jump_rope" },
              { label: "Agility Ladder", value: "agility_ladder" },
              { label: "None", value: "none" },
              { label: "Other", value: "other" },
            ]}
            labelField="label"
            valueField="value"
            placeholder="Select available equipment"
            value={equipment}
            onChange={(item) => setEquipment(item)}
            flatListProps={{
              showsVerticalScrollIndicator: true,
              indicatorStyle: "white",
              persistentScrollbar: true,
            }}
            style={{ backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 }}
            containerStyle={{ backgroundColor: "#1a1a1a", borderRadius: 16, borderWidth: 0, overflow: "hidden" }}
            itemContainerStyle={{ backgroundColor: "#1a1a1a" }}
            itemTextStyle={{ color: "#777", fontSize: 16 }}
            activeColor="#22c55e"
            placeholderStyle={{ color: "#777", fontSize: 16 }}
            selectedTextStyle={{ color: "#ffffff", fontSize: 16 }}
          />
          <Text style={{ color: "#555", fontSize: 12, marginTop: 6, marginLeft: 4 }}>
            Scroll to see all options
          </Text>
        </View>

        {equipment.includes("other") && (
          <TextInput
            placeholder="If other, please specify:"
            placeholderTextColor="#777"
            value={otherEquipment}
            onChangeText={setOtherEquipment}
            style={{
              backgroundColor: "#1a1a1a",
              color: "#ffffff",
              borderRadius: 16,
              padding: 16,
              fontSize: 16,
            }}
          />
        )}

        {errorMessage ? (
          <Text style={{ color: "#ff4d4d", fontSize: 15, textAlign: "center" }}>
            {errorMessage}
          </Text>
        ) : null}

        {isGenerating ? (
          <View style={{ marginTop: 24 }}>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 16,
                fontWeight: "600",
                textAlign: "center",
                marginBottom: 12,
              }}
            >
              {statusMessage}
            </Text>

            <View
              style={{
                height: 12,
                backgroundColor: "#1a1a1a",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: "#22c55e",
                  borderRadius: 20,
                }}
              />
            </View>

            <Text style={{ color: "#aaa", fontSize: 14, textAlign: "center", marginTop: 10 }}>
              {progress}%
            </Text>

            <ActivityIndicator size="small" color="#22c55e" style={{ marginTop: 16 }} />
          </View>
        ) : (
          <Pressable
            onPress={async () => {
              if (!injuries || equipment.length === 0) {
                setErrorMessage("Please fill out all fields.");
                return;
              }

              if (equipment.includes("other") && !otherEquipment) {
                setErrorMessage("Please specify your other equipment.");
                return;
              }

              setIsGenerating(true);
              startProgressAnimation();

              const { data: userData, error: userError } = await supabase.auth.getUser();

              if (userError || !userData.user) {
                setErrorMessage("You must be logged in to continue.");
                setIsGenerating(false);
                setProgress(0);
                return;
              }

              const { error } = await supabase
                .from("profiles")
                .update({
                  injuries,
                  equipment,
                  other_equipment: otherEquipment,
                  profile_completed: true,
                })
                .eq("id", userData.user.id);

              if (error) {
                setErrorMessage(error.message);
                setIsGenerating(false);
                setProgress(0);
                return;
              }

              const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userData.user.id)
                .maybeSingle();

              if (profileError) {
                setErrorMessage(profileError.message);
                setIsGenerating(false);
                setProgress(0);
                return;
              }

              if (!profile) {
                setErrorMessage("Profile not found.");
                setIsGenerating(false);
                setProgress(0);
                return;
              }

              const plan = await generateWorkoutPlan(profile);

              const { error: planError } = await supabase
                .from("profiles")
                .update({
                  current_plan: plan,
                  plan_created_at: new Date().toISOString(),
                })
                .eq("id", userData.user.id);

              if (planError) {
                setErrorMessage(planError.message);
                setIsGenerating(false);
                setProgress(0);
                return;
              }

              setProgress(100);
              setStatusMessage("Plan generated!");

              setTimeout(() => {
                router.push("/plan");
              }, 1000);
            }}
            style={{
              backgroundColor: "#22c55e",
              borderRadius: 50,
              padding: 16,
              marginTop: 24,
              alignSelf: "center",
              width: "50%",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "bold", textAlign: "center" }}>
              Generate Plan
            </Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}