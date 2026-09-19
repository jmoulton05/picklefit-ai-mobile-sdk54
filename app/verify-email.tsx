import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "./lib/supabase";

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const emailParam = params.email;
  const userEmail = Array.isArray(emailParam) ? emailParam[0] : emailParam;

  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#0f0f0f",
        padding: 26,
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#22c55e",
          fontSize: 16,
          fontWeight: "700",
        }}
      >
        PickleFit AI
      </Text>

      <Text
        style={{
          color: "white",
          fontSize: 34,
          fontWeight: "bold",
          marginTop: 10,
        }}
      >
        Verify your email
      </Text>

      <Text
        style={{
          color: "#aaa",
          fontSize: 16,
          marginTop: 12,
          lineHeight: 22,
        }}
      >
        Enter the 6-digit code sent to {userEmail || "your email"}.
      </Text>

      <TextInput
        placeholder="6-digit code"
        placeholderTextColor="#777"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        style={{
          backgroundColor: "#1a1a1a",
          color: "white",
          padding: 18,
          borderRadius: 16,
          marginTop: 32,
          fontSize: 22,
          textAlign: "center",
          letterSpacing: 6,
        }}
      />

      {errorMessage ? (
        <Text
          style={{
            color: errorMessage.includes("sent") ? "#22c55e" : "#ff4d4d",
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
          if (!userEmail || !userEmail.includes("@")) {
            setErrorMessage("Invalid email format.");
            return;
          }

          if (code.length !== 6) {
            setErrorMessage("Please enter the full 6-digit code.");
            return;
          }

          const { error } = await supabase.auth.verifyOtp({
            email: userEmail.trim(),
            token: code,
            type: "signup",
          });

          if (error) {
            setErrorMessage(error.message);
            return;
          }

          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (!session) {
            setErrorMessage("Session not found. Please log in again.");
            return;
          }

          setErrorMessage("");
          router.replace("/profile-builder");
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
            color: "#ffffff",
            fontSize: 16,
            fontWeight: "bold",
            textAlign: "center",
          }}
        >
          Verify Email
        </Text>
      </Pressable>

      <Pressable
        onPress={async () => {
          if (!userEmail || !userEmail.includes("@")) {
            setErrorMessage("Invalid email format.");
            return;
          }

          const { error } = await supabase.auth.resend({
            type: "signup",
            email: userEmail.trim(),
          });

          if (error) {
            setErrorMessage(error.message);
            return;
          }

          setCode("");
          setErrorMessage("A new code has been sent.");
        }}
        style={{
          alignSelf: "center",
          marginTop: 22,
        }}
      >
        <Text
          style={{
            color: "#22c55e",
            fontSize: 16,
            fontWeight: "700",
          }}
        >
          Resend code
        </Text>
      </Pressable>
    </View>
  );
}