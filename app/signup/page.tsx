import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScreen } from "@/components/auth/auth-screen";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Create your account | Creed",
  description: "Create your Creed account.",
};

export default async function SignupPage() {
  const configured = isSupabaseConfigured();

  // Already signed in? Send them into the app rather than showing the form.
  if (configured) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      redirect("/");
    }
  }

  return <AuthScreen mode="signup" configured={configured} />;
}
