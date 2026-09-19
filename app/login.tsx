import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "./lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0f0f0f",
        padding: 24,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#22c55e",
          fontSize: 22,
          fontWeight: "700",
        }}
      >
        PickleFit AI
      </Text>

      <Text
        style={{
          color: "white",
          fontSize: 36,
          fontWeight: "bold",
          marginTop: 10,
        }}
      >
        Welcome!
      </Text>

      <Text
        style={{
          color: "#aaa",
          fontSize: 16,
          marginTop: 10,
        }}
      >
        Log in to continue your training plan.
      </Text>

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
          marginTop: 32,
          fontSize: 16,
        }}
      />

      <View
        style={{
          backgroundColor: "#1a1a1a",
          borderRadius: 16,
          marginTop: 14,
          flexDirection: "row",
          alignItems: "center",
          paddingRight: 16,
        }}
      >
        <TextInput
          placeholder="Password"
          placeholderTextColor="#777"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          style={{
            color: "white",
            padding: 16,
            fontSize: 16,
            flex: 1,
          }}
        />

        <Pressable onPress={() => setShowPassword(!showPassword)}>
          <Text
            style={{
              color: "#22c55e",
              fontSize: 16,
              fontWeight: "600",
            }}
          >
            {showPassword ? "Hide" : "Show"}
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
          }}
        >
          {errorMessage}
        </Text>
      ) : null}

      <Pressable
        onPress={async () => {
          if (!email || !password) {
            setErrorMessage("Please enter your email and password.");
            return;
          }

          const cleanEmail = email.trim().toLowerCase();

          const { error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (error) {
            setErrorMessage(error.message);
            return;
          }

          setErrorMessage("");
          router.replace("/home");
        }}
        style={{
          backgroundColor: "#22c55e",
          padding: 17,
          borderRadius: 50,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: "white",
            textAlign: "center",
            fontSize: 17,
            fontWeight: "700",
          }}
        >
          Log In
        </Text>
      </Pressable>

      <Text
        style={{
          color: "#aaa",
          textAlign: "center",
          marginTop: 36,
          fontSize: 16,
        }}
      >
        Don’t have an account?
      </Text>

      <Pressable
        onPress={() => router.push("/create-account")}
        style={{ alignSelf: "center" }}
      >
        <Text
          style={{
            color: "#22c55e",
            textAlign: "center",
            fontSize: 16,
            fontWeight: "700",
            marginTop: 8,
          }}
        >
          Create one
        </Text>
      </Pressable>
    </View>
  );
}