import { Ionicons } from "@expo/vector-icons";
import AntDesign from '@expo/vector-icons/AntDesign';
import Foundation from '@expo/vector-icons/Foundation';
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1a1a1a",
          borderTopColor: "#22c55e",
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: "#22c55e",
        tabBarInactiveTintColor: "#777",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", 
          tabBarIcon : ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="plan"
        options={{ title: "Plan", 
          tabBarIcon : ({ color, size }) => (
            <Foundation name="clipboard-notes" size={size} color={color} />
          )
        }}
      />

      <Tabs.Screen
        name="progress"
        options={{ title: "Progress",
          tabBarIcon : ({ color, size }) => (
            <AntDesign name="area-chart" size={size} color={color} />
          )
         }}
      />

      <Tabs.Screen
        name="more"
        options={{ title: "More",
          tabBarIcon : ({ color, size }) => (
            <Ionicons name="menu" size={size} color={color} />
          )
         }}
      />
    </Tabs>
  );
}
