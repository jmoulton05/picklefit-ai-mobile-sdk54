import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Dropdown, MultiSelect } from "react-native-element-dropdown";
import { supabase } from "./lib/supabase";

const PICKLE_OPTIONS = [
  { label: "Dinking", value: "dinking" },
  { label: "Serves/Returns", value: "serves_returns" },
  { label: "Third shot", value: "third_shot" },
  { label: "Volleys", value: "volleys" },
  { label: "Resets", value: "resets" },
  { label: "Lobs", value: "lobs" },
  { label: "Overheads/Putaways", value: "overheads_putaways" },
  { label: "Footwork/Positioning", value: "footwork_positioning" },
  { label: "Flicks", value: "flicks" },
  { label: "Speedups", value: "speedups" },
  { label: "Counters", value: "counters" },
];

const FITNESS_OPTIONS = [
  { label: "Speed", value: "speed" },
  { label: "Endurance", value: "endurance" },
  { label: "Strength", value: "strength" },
  { label: "Balance/Stability", value: "balance_stability" },
  { label: "Agility", value: "agility" },
  { label: "Flexibility/Mobility", value: "flexibility_mobility" },
  { label: "Reaction Time", value: "reaction_time" },
  { label: "Injury Prevention", value: "injury_prevention" },
  { label: "Weight Loss", value: "weight_loss" },
];

const flatListProps = {
  showsVerticalScrollIndicator: true,
  indicatorStyle: "white" as const,
  persistentScrollbar: true,
};

export default function GoalsScreen() {
  const [goal, setGoal] = useState<string | null>(null);
  const [pickleFocus, setPickleFocus] = useState<string[]>([]);
  const [fitnessFocus, setFitnessFocus] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const allPickleSelected = pickleFocus.length === PICKLE_OPTIONS.length;
  const allFitnessSelected = fitnessFocus.length === FITNESS_OPTIONS.length;

  const toggleAllPickle = () => {
    setPickleFocus(allPickleSelected ? [] : PICKLE_OPTIONS.map((o) => o.value));
  };

  const toggleAllFitness = () => {
    setFitnessFocus(allFitnessSelected ? [] : FITNESS_OPTIONS.map((o) => o.value));
  };

  const multiSelectStyle = { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 };
  const containerStyle = { backgroundColor: "#1a1a1a", borderRadius: 16, borderWidth: 0, overflow: "hidden" as const };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f0f0f" }}
      contentContainerStyle={{ padding: 24, paddingTop: 70 }}
    >
      {/* Back button */}
      <Pressable onPress={() => router.back()} style={{ marginBottom: 20 }}>
        <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "600" }}>← Back</Text>
      </Pressable>

      <View>
        <Text style={{ color: "#ffffff", fontSize: 34, fontWeight: "bold" }}>
          Set Your Goals
        </Text>
        <Text style={{ color: "#aaa", fontSize: 16, marginTop: 10, lineHeight: 22 }}>
          Define your objectives and track your progress.
        </Text>
      </View>

      <View style={{ marginTop: 24, gap: 18 }}>
        {/* Overall goal */}
        <Dropdown
          data={[
            { label: "Learn the fundamentals", value: "learn_fundamentals" },
            { label: "Improve fitness", value: "improve_fitness" },
            { label: "General improvement", value: "general_improvement" },
            { label: "Want to be 5.0+", value: "be_5.0" },
          ]}
          labelField="label"
          valueField="value"
          placeholder="Select an overall goal"
          value={goal}
          onChange={(item) => setGoal(item.value)}
          style={multiSelectStyle}
          containerStyle={containerStyle}
          itemContainerStyle={{ backgroundColor: "#1a1a1a" }}
          itemTextStyle={{ color: "#777", fontSize: 16 }}
          activeColor="#22c55e"
          placeholderStyle={{ color: "#777", fontSize: 16 }}
          selectedTextStyle={{ color: "#ffffff", fontSize: 16 }}
        />

        {/* Pickleball focus */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: "#aaa", fontSize: 14 }}>Pickleball Focus Areas</Text>
            <Pressable onPress={toggleAllPickle}>
              <Text style={{ color: "#22c55e", fontSize: 14, fontWeight: "600" }}>
                {allPickleSelected ? "Deselect All" : "Select All"}
              </Text>
            </Pressable>
          </View>
          <MultiSelect
            data={PICKLE_OPTIONS}
            labelField="label"
            valueField="value"
            placeholder="Select pickleball focus area(s)"
            value={pickleFocus}
            onChange={(item) => setPickleFocus(item)}
            flatListProps={flatListProps}
            style={multiSelectStyle}
            containerStyle={containerStyle}
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

        {/* Fitness focus */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: "#aaa", fontSize: 14 }}>Fitness Focus Areas</Text>
            <Pressable onPress={toggleAllFitness}>
              <Text style={{ color: "#22c55e", fontSize: 14, fontWeight: "600" }}>
                {allFitnessSelected ? "Deselect All" : "Select All"}
              </Text>
            </Pressable>
          </View>
          <MultiSelect
            data={FITNESS_OPTIONS}
            labelField="label"
            valueField="value"
            placeholder="Select fitness focus area(s)"
            value={fitnessFocus}
            onChange={(item) => setFitnessFocus(item)}
            flatListProps={flatListProps}
            style={multiSelectStyle}
            containerStyle={containerStyle}
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

        {errorMessage ? (
          <Text style={{ color: "#ff4d4d", fontSize: 15, textAlign: "center" }}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={async () => {
            if (!goal || pickleFocus.length === 0 || fitnessFocus.length === 0) {
              setErrorMessage("Please fill out all fields.");
              return;
            }

            const { data: userData, error: userError } = await supabase.auth.getUser();

            if (userError || !userData.user) {
              setErrorMessage("You must be logged in to continue.");
              return;
            }

            const { error } = await supabase
              .from("profiles")
              .update({
                goal,
                pickle_focus_area: pickleFocus,
                fit_focus_area: fitnessFocus,
              })
              .eq("id", userData.user.id);

            if (error) {
              setErrorMessage(error.message);
              return;
            }

            setErrorMessage("");
            router.push("/injuries-equipment");
          }}
          style={{
            backgroundColor: "#22c55e",
            padding: 17,
            borderRadius: 50,
            marginTop: 24,
            alignSelf: "center",
            width: "50%",
          }}
        >
          <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "bold", textAlign: "center" }}>
            Next
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}