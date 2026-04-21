// Admin user detection for support access
// Admin users can view and edit any project regardless of ownership

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || 'scott@tourlytics.ai,samoitoza@gmail.com'
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}
