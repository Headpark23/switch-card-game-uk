export interface SignedInUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly picture?: string;
}

interface CredentialResponse { readonly credential: string }
interface GoogleAccountsId {
  initialize(config: { client_id: string; callback(response: CredentialResponse): void; use_fedcm_for_prompt?: boolean; use_fedcm_for_button?: boolean }): void;
  prompt(): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window { google?: { accounts: { id: GoogleAccountsId } } }
}

let scriptPromise: Promise<void> | null = null;
let currentCredentialHandler: ((response: CredentialResponse) => void) | null = null;
let initializedClientId: string | null = null;

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in could not be loaded."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function googleSignInConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID && import.meta.env.VITE_GOOGLE_AUTH_ENDPOINT);
}

export async function mountGoogleOneTap(
  parent: HTMLElement,
  onSignedIn: (user: SignedInUser) => void,
  onError: (message: string) => void,
): Promise<"mounted" | "unconfigured"> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const endpoint = import.meta.env.VITE_GOOGLE_AUTH_ENDPOINT as string | undefined;
  if (!clientId || !endpoint) return "unconfigured";
  await loadGoogleScript();
  const googleId = window.google?.accounts.id;
  if (!googleId) throw new Error("Google sign-in is unavailable in this browser.");
  currentCredentialHandler = async ({ credential }) => {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      if (!response.ok) throw new Error("Google sign-in could not be verified.");
      const result = await response.json() as { user?: SignedInUser };
      if (!result.user?.id || !result.user.email) throw new Error("The sign-in server returned an invalid profile.");
      onSignedIn(result.user);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Google sign-in failed.");
    }
  };
  if (initializedClientId !== clientId) {
    googleId.initialize({
      client_id: clientId,
      callback: (response) => currentCredentialHandler?.(response),
      use_fedcm_for_prompt: true,
      use_fedcm_for_button: true,
    });
    initializedClientId = clientId;
  }
  parent.replaceChildren();
  googleId.renderButton(parent, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", width: Math.min(300, parent.clientWidth || 300) });
  googleId.prompt();
  return "mounted";
}

export function disableGoogleAutoSelect(): void {
  window.google?.accounts.id.disableAutoSelect();
}

export async function signOutGoogleSession(): Promise<void> {
  const endpoint = import.meta.env.VITE_GOOGLE_LOGOUT_ENDPOINT as string | undefined;
  if (!endpoint) throw new Error("Secure sign-out is not configured.");
  const response = await fetch(endpoint, { method: "POST", credentials: "include" });
  if (!response.ok) throw new Error("Sign-out could not be completed.");
  disableGoogleAutoSelect();
}
