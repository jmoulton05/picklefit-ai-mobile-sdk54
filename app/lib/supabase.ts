import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = "https://uhovbwzkebvcywoffbam.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVob3Zid3prZWJ2Y3l3b2ZmYmFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMTg2NTgsImV4cCI6MjA5NDg5NDY1OH0.8QgYo5kwd03PmceYcegh8GMZPoKI1-jwqbV8Qn4YjfY";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);