import { supabase } from "./lib/supabase";

export async function generateWorkoutPlan(profile: any) {
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    throw new Error("User not authenticated.");
  }

  const { data, error } = await supabase.functions.invoke("generate-plan", {
    body: {
      profile: {
        ...profile,
        user_id: userData.user.id,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.plan) {
    throw new Error("No plan was generated.");
  }

  return data.plan;
}