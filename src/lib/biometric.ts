// Device biometric unlock (Face ID / fingerprint) via WebAuthn platform authenticator.
// This is a local convenience gate on top of the signed-in account session; the
// credential id is stored per device and never leaves it except as a WebAuthn request.
const KEY = "barnmappen.biometric";

function rand(n: number) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}
const toB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function biometricSupported(): Promise<boolean> {
  try {
    return (
      typeof window !== "undefined" &&
      !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    );
  } catch {
    return false;
  }
}

export function biometricEnrolled(workspaceId: string) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v?.ws === workspaceId ? (v.id as string) : null;
  } catch {
    return null;
  }
}

export function removeBiometric() {
  localStorage.removeItem(KEY);
}

export async function enrollBiometric(workspaceId: string, label: string) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: "Barnmappen", id: location.hostname },
      user: { id: rand(16), name: label, displayName: label },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) return false;
  localStorage.setItem(KEY, JSON.stringify({ ws: workspaceId, id: toB64(cred.rawId) }));
  return true;
}

export async function verifyBiometric(credId: string) {
  try {
    const res = await navigator.credentials.get({
      publicKey: {
        challenge: rand(32),
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: fromB64(credId) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
    return !!res;
  } catch {
    return false;
  }
}
