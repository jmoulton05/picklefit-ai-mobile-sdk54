import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { supabase } from "./lib/supabase";

export default function PickleballExperienceScreen() {
  const [experienceLevel, setExperienceLevel] = useState("");
  const [workoutFrequency, setWorkoutFrequency] = useState("");
  const [dailyAvailability, setDailyAvailability] = useState("");
  const [sessionLength, setSessionLength] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

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
        <Text
          style={{
            color: "white",
            fontSize: 34,
            fontWeight: "bold",
            marginBottom: 20,
          }}
        >
          Pickleball Experience
        </Text>

        <Text
          style={{
            color: "#aaa",
            fontSize: 16,
            marginTop: 10,
            lineHeight: 22,
          }}
        >
          Enter your pickleball experience to get a personalized training plan.
        </Text>
      </View>

      <View style={{ marginTop: 24, gap: 18 }}>
        <TextInput
          placeholder="Enter current DUPR rating:"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={experienceLevel}
          onChangeText={setExperienceLevel}
          style={{
            color: "#ffffff",
            fontSize: 16,
            lineHeight: 20,
            backgroundColor: "#1a1a1a",
            padding: 16,
            borderRadius: 16,
          }}
        />

        <Text style={{ color: "#aaa", fontSize: 12, marginTop: -10, marginLeft: 4 }}>
          (Enter 2.0 if you don't know)
        </Text>

        <TextInput
          placeholder="How many days per week do you workout?"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={workoutFrequency}
          onChangeText={setWorkoutFrequency}
          style={{
            color: "#ffffff",
            fontSize: 16,
            lineHeight: 20,
            backgroundColor: "#1a1a1a",
            padding: 16,
            borderRadius: 16,
          }}
        />

        <TextInput
          placeholder="How many days a week can you train?"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={dailyAvailability}
          onChangeText={setDailyAvailability}
          style={{
            color: "#ffffff",
            fontSize: 16,
            lineHeight: 20,
            backgroundColor: "#1a1a1a",
            padding: 16,
            borderRadius: 16,
          }}
        />

        <Dropdown
          data={[
            { label: "30 minutes", value: "30" },
            { label: "45 minutes", value: "45" },
            { label: "60 minutes", value: "60" },
            { label: "90 minutes", value: "90" },
            { label: "120+ minutes", value: "120+" },
          ]}
          labelField="label"
          valueField="value"
          placeholder="Select session length:"
          value={sessionLength}
          onChange={(item) => setSessionLength(item.value)}
          style={{ backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 }}
          containerStyle={{ backgroundColor: "#1a1a1a", borderRadius: 16, borderWidth: 0, overflow: "hidden" }}
          itemContainerStyle={{ backgroundColor: "#1a1a1a" }}
          itemTextStyle={{ color: "#777", fontSize: 16 }}
          activeColor="#22c55e"
          placeholderStyle={{ color: "#777", fontSize: 16 }}
          selectedTextStyle={{ color: "#ffffff", fontSize: 16 }}
        />

        {errorMessage ? (
          <Text style={{ color: "#ff4d4d", fontSize: 15, textAlign: "center" }}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={async () => {
            if (!experienceLevel || !workoutFrequency || !dailyAvailability || !sessionLength) {
              setErrorMessage("Please fill out all fields.");
              return;
            }

            if (
              Number(experienceLevel) <= 0 ||
              Number(workoutFrequency) < 0 ||
              Number(dailyAvailability) <= 0
            ) {
              setErrorMessage("Please enter valid numbers.");
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
                dupr_rating: Number(experienceLevel),
                workout_frequency: Number(workoutFrequency),
                days_per_week: Number(dailyAvailability),
                session_length: sessionLength,
              })
              .eq("id", userData.user.id);

            if (error) {
              setErrorMessage(error.message);
              return;
            }

            setErrorMessage("");
            router.push("/goals");
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