import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { supabase } from "./lib/supabase";

export default function CreateAccountScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
      <View
        style={{
          flex: 1,
          backgroundColor: "#0f0f0f",
          justifyContent: "center",
          paddingLeft: 26,
          paddingTop: 70,
          paddingBottom: 60,
        }}
      >
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={{ marginBottom: 20 }}>
          <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "600" }}>← Back</Text>
        </Pressable>

        <Text
          style={{
            color: "#ffffff",
            fontSize: 34,
            fontWeight: "bold",
          }}
        >
          Create Account
        </Text>

        <TextInput
          placeholder="First Name"
          placeholderTextColor="#777"
          value={firstName}
          onChangeText={setFirstName}
          style={{
            backgroundColor: "#1a1a1a",
            color: "white",
            padding: 16,
            borderRadius: 16,
            marginTop: 32,
            fontSize: 16,
            marginRight: 26,
          }}
        />

        <TextInput
          placeholder="Last Name"
          placeholderTextColor="#777"
          value={lastName}
          onChangeText={setLastName}
          style={{
            backgroundColor: "#1a1a1a",
            color: "white",
            padding: 16,
            borderRadius: 16,
            marginTop: 18,
            fontSize: 16,
            marginRight: 26,
          }}
        />

        <TextInput
          placeholder="Email"
          placeholderTextColor="#777"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={{
            backgroundColor: "#1a1a1a",
            color: "white",
            padding: 16,
            borderRadius: 16,
            marginTop: 18,
            fontSize: 16,
            marginRight: 26,
          }}
        />

        <View
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            marginTop: 18,
            marginRight: 26,
            flexDirection: "row",
            alignItems: "center",
            paddingRight: 16,
          }}
        >
          <TextInput
            placeholder="Password"
            placeholderTextColor="#777"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            style={{
              color: "white",
              padding: 16,
              fontSize: 16,
              flex: 1,
            }}
          />
          <Pressable onPress={() => setShowPassword(!showPassword)}>
            <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "600" }}>
              {showPassword ? "Hide" : "Show"}
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            marginTop: 18,
            marginRight: 26,
            flexDirection: "row",
            alignItems: "center",
            paddingRight: 16,
          }}
        >
          <TextInput
            placeholder="Confirm Password"
            placeholderTextColor="#777"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={{
              color: "white",
              padding: 16,
              fontSize: 16,
              flex: 1,
            }}
          />
          <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "600" }}>
              {showConfirmPassword ? "Hide" : "Show"}
            </Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <Text
            style={{
              color: "#ff4d4d",
              marginTop: 18,
              fontSize: 15,
              textAlign: "center",
              marginRight: 26,
            }}
          >
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={async () => {
            if (!firstName || !lastName || !email || !password || !confirmPassword) {
              setErrorMessage("Please fill out all fields.");
              return;
            }

            const cleanEmail = email.trim().toLowerCase();

            if (!cleanEmail.includes("@")) {
              setErrorMessage("Please enter a valid email.");
              return;
            }

            if (password !== confirmPassword) {
              setErrorMessage("Passwords do not match.");
              return;
            }

            const { error } = await supabase.auth.signUp({
              email: cleanEmail,
              password,
              options: {
                data: {
                  first_name: firstName.trim(),
                  last_name: lastName.trim(),
                },
              },
            });

            if (error) {
              setErrorMessage(error.message);
              return;
            }

            setErrorMessage("");
            router.push("/profile-builder");
          }}
          style={{
            backgroundColor: "#22c55e",
            padding: 17,
            borderRadius: 50,
            marginTop: 24,
            marginRight: 26,
            alignSelf: "center",
          }}
        >
          <Text
            style={{
              color: "#ffffff",
              fontSize: 16,
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Create Account
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}