"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FIELD_TEXT = "text-[15px]";
const CONTROL_HEIGHT = "h-12"; // ~48px — matches label/input/button proportions

const ERROR_MESSAGES: Record<string, string> = {
  EmailSignin: "We couldn't send the sign-in email. Check the address and try again.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  AccessDenied: "That sign-in attempt was denied. Try again or use a different email.",
  Configuration: "Sign-in isn't configured correctly. Try again shortly.",
  CredentialsSignin: "Those credentials weren't recognized.",
  Default: "Something went wrong signing you in. Please try again.",
};

export default function SignInPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";
  const backHref = callbackUrl.startsWith("/") ? callbackUrl : "/dashboard";
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    urlError ? (ERROR_MESSAGES[urlError] ?? ERROR_MESSAGES.Default) : null,
  );

  // Only present in local/E2E test builds (see src/auth.config.ts) — never in production.
  const [hasCredentialsProvider, setHasCredentialsProvider] = useState(false);
  useEffect(() => {
    let cancelled = false;
    getProviders().then((providers) => {
      if (!cancelled && providers?.credentials) setHasCredentialsProvider(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSending(true);
    setError(null);
    try {
      const result = await signIn("email", { email, callbackUrl, redirect: false });
      if (result?.error) {
        setError(ERROR_MESSAGES[result.error] ?? ERROR_MESSAGES.Default);
      } else {
        setSent(true);
      }
    } catch {
      setError(ERROR_MESSAGES.Default);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-light-blue/12 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-h1">Save your progress</h1>
          <p className={`${FIELD_TEXT} text-muted-foreground leading-normal`}>
            Your work is currently saved on this device. Sign in to keep it across devices —
            it&rsquo;s optional, the app works fully without an account.
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {sent ? (
              <div className="space-y-4">
                <p className={`${FIELD_TEXT} text-foreground`}>
                  Check your email. We sent a sign-in link to{" "}
                  <span className="font-medium">{email}</span>.
                </p>
                <p className="text-small text-muted-foreground">
                  Didn&rsquo;t get it?{" "}
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="font-medium text-foreground underline underline-offset-2 hover:no-underline cursor-pointer"
                  >
                    Try again
                  </button>
                </p>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className={`${FIELD_TEXT} font-medium text-foreground`}>
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full ${CONTROL_HEIGHT} ${FIELD_TEXT} rounded-[var(--radius-md)] border border-input bg-secondary px-3.5 text-foreground ring-offset-background transition-colors duration-150 placeholder:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [transition-timing-function:var(--ease-out)]`}
                  />
                </div>

                {error && <p className="text-small text-destructive">{error}</p>}

                <Button
                  type="submit"
                  loading={isSending}
                  className={`w-full ${CONTROL_HEIGHT} ${FIELD_TEXT} font-medium`}
                >
                  {isSending ? "Sending…" : "Send sign-in link"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {hasCredentialsProvider && (
          <TestCredentialsForm callbackUrl={callbackUrl} onError={setError} />
        )}

        <div className="mt-4">
          <Button asChild variant="outline" className={`w-full ${CONTROL_HEIGHT} ${FIELD_TEXT}`}>
            <Link href={backHref}>Back to guest mode</Link>
          </Button>
          <p className="mt-2 text-center text-small text-muted-foreground">
            Nothing on this device is changed or lost by going back.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Local/E2E-only credentials form — the `credentials` provider is only
 * registered when E2E_TEST_MODE=1 (see src/auth.config.ts), so this never
 * renders in production. Kept plain since it's test tooling, not product UI.
 */
function TestCredentialsForm({
  callbackUrl,
  onError,
}: {
  callbackUrl: string;
  onError: (message: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    onError(null);
    const result = await signIn("credentials", { email, password, callbackUrl, redirect: false });
    if (result?.error) {
      onError(ERROR_MESSAGES.CredentialsSignin);
      setIsSubmitting(false);
      return;
    }
    window.location.href = result?.url ?? callbackUrl;
  }

  return (
    <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-input p-3">
      <p className="mb-2 text-small text-muted-foreground">Test sign-in (E2E only)</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="test-email" className="text-small font-medium">
          Email
        </label>
        <input
          id="test-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-9 rounded-[var(--radius-md)] border border-input bg-secondary px-3 text-small text-foreground"
        />
        <label htmlFor="test-password" className="text-small font-medium">
          Password
        </label>
        <input
          id="test-password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-9 rounded-[var(--radius-md)] border border-input bg-secondary px-3 text-small text-foreground"
        />
        <Button type="submit" size="sm" variant="outline" loading={isSubmitting} className="w-full">
          Sign in with Credentials
        </Button>
      </form>
    </div>
  );
}
