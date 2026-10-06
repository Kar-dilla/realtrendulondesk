/**
 * Name shown in greetings.
 * Uses `user_metadata.name` when it is set; otherwise the part of the email before "@", capitalised.
 */
export function toDisplayName(email: string, metadataName?: unknown): string {
  if (typeof metadataName === 'string' && metadataName.trim()) return metadataName.trim();
  const local = email.split('@')[0]?.trim() ?? '';
  if (!local) return email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}
