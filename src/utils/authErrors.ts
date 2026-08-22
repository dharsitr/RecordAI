/**
 * Helper to convert Supabase auth errors or client error instances
 * into clear, user-friendly human-readable messages.
 */
export function formatAuthError(error: unknown): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);

  const lower = message.toLowerCase();

  // Network / Fetch errors
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('fetcherror') ||
    lower.includes('networkerror')
  ) {
    return 'Network connection failure. Please check your internet connection and try again.';
  }

  // Invalid credentials
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid grant') ||
    lower.includes('wrong password')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  // Duplicate email / user already registered
  if (
    lower.includes('user already registered') ||
    lower.includes('already exists') ||
    lower.includes('email rate limit exceeded') ||
    lower.includes('user_already_exists')
  ) {
    return 'An account with this email address already exists. Please log in instead.';
  }

  // Weak password
  if (
    lower.includes('password should be at least') ||
    lower.includes('weak password') ||
    lower.includes('password is too short')
  ) {
    return 'Password is too weak. Please use at least 6 characters with a combination of letters and numbers.';
  }

  // Rate limiting
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a few moments and try again.';
  }

  // Signup disabled or confirmation pending
  if (lower.includes('email not confirmed')) {
    return 'Your email has not been confirmed yet. Please check your inbox.';
  }

  return message;
}
