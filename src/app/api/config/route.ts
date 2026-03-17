import { NextResponse } from 'next/server'

// Returns client-safe configuration values
// Google OAuth Client ID is needed by the frontend for Drive export
export async function GET() {
  return NextResponse.json({
    googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || null,
  })
}
