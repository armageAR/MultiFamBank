import type { User } from '@multifambank/api-client'

/**
 * Device lock with the phone's fingerprint or face (WebAuthn platform authenticator). It only
 * guards opening the app on this device: the session token is unchanged and the API is not
 * involved, so it also works offline.
 */

/** Time in the background after which the app asks again. */
export const LOCK_AFTER_MS = 2 * 60_000

export interface AppLockConfig {
  userId: number
  /** base64url of the credential's raw id. */
  credentialId: string
}

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const fromBase64Url = (value: string) => {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

// Nothing is verified by a server, so the challenge only has to be unpredictable.
const challenge = () => crypto.getRandomValues(new Uint8Array(32))

/** Whether this device can unlock with fingerprint, face or screen lock. */
export async function isAppLockAvailable(): Promise<boolean> {
  try {
    return typeof PublicKeyCredential !== 'undefined' && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  } catch {
    return false
  }
}

export function readAppLock(key: string): AppLockConfig | null {
  try {
    const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as AppLockConfig | null
    return stored && typeof stored.userId === 'number' && typeof stored.credentialId === 'string' ? stored : null
  } catch {
    return null
  }
}

export function clearAppLock(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Nothing stored.
  }
}

/**
 * Creates this device's credential for the user. The user handle is fixed per app and user, so
 * activating again replaces the saved key instead of piling up new ones.
 */
export async function registerAppLock(key: string, user: User): Promise<AppLockConfig> {
  // Without storage the lock could not survive a reload: fail before a key is saved on the phone.
  localStorage.setItem(key, 'null')
  localStorage.removeItem(key)

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: 'MultiFamBank' },
      user: { id: new TextEncoder().encode(`${key}:${user.id}`), name: user.email, displayName: user.name },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      attestation: 'none',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!credential) throw new Error('No se pudo activar el desbloqueo.')

  const config = { userId: user.id, credentialId: toBase64Url(credential.rawId) }
  localStorage.setItem(key, JSON.stringify(config))

  return config
}

/** Asks for the fingerprint or face. Resolves true only if the device verified the person. */
export async function verifyAppLock(config: AppLockConfig): Promise<boolean> {
  const credential = (await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      allowCredentials: [{ type: 'public-key', id: fromBase64Url(config.credentialId), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null

  if (!credential) return false

  // Authenticator data: 32-byte RP id hash, then the flags byte; bit 2 is "user verified".
  const data = new Uint8Array((credential.response as AuthenticatorAssertionResponse).authenticatorData)
  return data.length > 32 && (data[32] & 0x04) !== 0
}
