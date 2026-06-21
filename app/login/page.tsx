import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/auth-screen";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in | Creed",
  description: "Sign in to your Creed.",
};

export default async function LoginPage() {
  const configured = isSupabaseConfigured();

  // Already signed in? Don't show the login form (which would let them loop
  // through OAuth pointlessly) - send them into the app.
  if (configured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/");
    }
  }

  return <AuthScreen mode="login" configured={configured} />;
}
