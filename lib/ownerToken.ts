const OWNER_ID_STORAGE_KEY = 'researchlens_owner_id';
const OWNER_ID_HEADER = 'x-owner-id';
const OWNER_ID_PATTERN = /^[a-z0-9-]{16,64}$/i;

/**
 * Opaque per-browser identifier used to scope saved reports and faculty
 * shortlists to "whoever created them" without a real accounts system.
 * Persisted in localStorage so it survives across tabs/sessions on the same
 * browser, but it is not a security boundary against a determined attacker —
 * it exists to stop casual/accidental cross-user data exposure, not to
 * replace real authentication.
 */
export function getOrCreateOwnerId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const existing = window.localStorage.getItem(OWNER_ID_STORAGE_KEY);
    if (existing && OWNER_ID_PATTERN.test(existing)) return existing;
    const next =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(OWNER_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return '';
  }
}

export function ownerIdHeaders(): Record<string, string> {
  const ownerId = getOrCreateOwnerId();
  return ownerId ? { [OWNER_ID_HEADER]: ownerId } : {};
}

export function isValidOwnerId(value: unknown): value is string {
  return typeof value === 'string' && OWNER_ID_PATTERN.test(value);
}

export function readOwnerIdFromRequest(request: Request): string | null {
  const value = request.headers.get(OWNER_ID_HEADER);
  return isValidOwnerId(value) ? value : null;
}
