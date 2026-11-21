// Device biometric unlock (Face ID / fingerprint) via WebAuthn platform authenticator.
// The device confirms the person; the server then unlocks the session with a device secret it
// handed out when Face ID was turned on (see registerUnlockDevice). The credential id never leaves
// the device except as a WebAuthn request.
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

/** The server-issued secret that turns a confirmed Face ID into an unlocked session. */
export function biometricSecret(workspaceId: string) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v?.ws === workspaceId && typeof v.secret === "string" ? (v.secret as string) : null;
  } catch {
    return null;
  }
}

export function saveBiometricSecret(workspaceId: string, secret: string) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v?.ws === workspaceId) localStorage.setItem(KEY, JSON.stringify({ ...v, secret }));
  } catch {
    // Without the secret the device simply falls back to the PIN.
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
