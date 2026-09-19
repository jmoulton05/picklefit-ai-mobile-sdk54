import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { supabase } from "./lib/supabase";

export default function ProfileBuilderScreen() {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [feet, setFeet] = useState("");
  const [inches, setInches] = useState("");
  const [weight, setWeight] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f0f0f" }}
      contentContainerStyle={{ padding: 24, paddingTop: 70 }}
    >
      <View>
        <Text style={{ color: "#ffffff", fontSize: 34, fontWeight: "bold" }}>
          Build your profile
        </Text>

        <Text style={{ color: "#aaa", fontSize: 16, marginTop: 10, lineHeight: 22 }}>
          Enter your information to get a personalized training plan.
        </Text>
      </View>

      <View style={{ marginTop: 24, gap: 18 }}>
        <TextInput
          placeholder="Age"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={age}
          onChangeText={setAge}
          style={{
            color: "#ffffff",
            fontSize: 16,
            backgroundColor: "#1a1a1a",
            padding: 16,
            borderRadius: 16,
          }}
        />

        <Dropdown
          data={[
            { label: "Male", value: "male" },
            { label: "Female", value: "female" },
            { label: "Other", value: "other" },
            { label: "Prefer not to say", value: "prefer_not_to_say" },
          ]}
          labelField="label"
          valueField="value"
          placeholder="Select Gender"
          value={gender}
          onChange={(item) => setGender(item.value)}
          style={{ backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 }}
          containerStyle={{ backgroundColor: "#1a1a1a", borderRadius: 16, borderWidth: 0, overflow: "hidden" }}
          itemContainerStyle={{ backgroundColor: "#1a1a1a"}}
          itemTextStyle={{ color: "#777", fontSize: 16 }}
          activeColor="#22c55e"
          placeholderStyle={{ color: "#777", fontSize: 16 }}
          selectedTextStyle={{ color: "#ffffff", fontSize: 16}}
        />

        <TextInput
          placeholder="Height (feet)"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={feet}
          onChangeText={setFeet}
          style={{
            color: "#ffffff",
            fontSize: 16,
            backgroundColor: "#1a1a1a",
            padding: 16,
            borderRadius: 16,
          }}
        />

        <TextInput
          placeholder="Height (inches)"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={inches}
          onChangeText={setInches}
          style={{
            color: "#ffffff",
            fontSize: 16,
            backgroundColor: "#1a1a1a",
            padding: 16,
            borderRadius: 16,
          }}
        />

        <TextInput
          placeholder="Weight"
          placeholderTextColor="#777"
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
          style={{
            color: "#ffffff",
            fontSize: 16,
            backgroundColor: "#1a1a1a",
            padding: 16,
            borderRadius: 16,
          }}
        />

        {errorMessage ? (
          <Text style={{ color: "#ff4d4d", fontSize: 15, textAlign: "center" }}>
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={async () => {
            if (!age || !gender || !feet || !inches || !weight) {
              setErrorMessage("Please fill out all fields.");
              return;
            }

            const { data: userData, error: userError } = await supabase.auth.getUser();

            if (userError || !userData.user) {
              setErrorMessage("You must be logged in to continue.");
              return;
            }

            const height = `${feet}'${inches}"`;

            const { error } = await supabase
              .from("profiles")
              .update({
                age: Number(age),
                gender,
                height,
                weight: Number(weight),
              })
              .eq("id", userData.user.id);

            if (error) {
              setErrorMessage(error.message);
              return;
            }

            setErrorMessage("");
            router.push("/pickleball-experience");
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