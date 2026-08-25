import { redirect } from "next/navigation";

// Guest-first: the app is usable immediately, with no sign-in screen. There's
// nothing session-specific to decide here on the server (guest data lives in
// the browser), so every visitor — guest or signed-in — goes straight to the
// dashboard, which handles onboarding/guest state on the client.
export default function Home() {
  redirect("/dashboard");
}
