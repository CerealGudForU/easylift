// Username + password login (PLAN.md §4.1). Supabase Auth needs an email, so each
// username maps to a synthetic address the user never sees. The domain is a
// subdomain of our own workers.dev host with no mail server, and email
// confirmation is off, so nothing is ever sent. Never change it: existing
// accounts sign in through it.
import type { AuthError } from '@supabase/supabase-js';

import { supabase } from './supabase';

export const AUTH_EMAIL_DOMAIN = 'users.easylift.cerealgudforu.workers.dev';
export const USERNAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
export const MIN_PASSWORD = 8;

/**
 * Usernames keep the capitals the user picked ("EthanG") for display, but are
 * unique and matched ignoring case. The login email always uses the lowercase
 * form, so "ethang" and "EthanG" sign in to the same account.
 */
export const cleanUsername = (u: string) => u.trim();
export const usernameToEmail = (u: string) => `${cleanUsername(u).toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;

/** Why a username can't be used, or null if the format is fine. */
export function usernameProblem(raw: string): string | null {
  const u = cleanUsername(raw);
  if (u.length < 3) return 'At least 3 characters.';
  if (u.length > 20) return 'At most 20 characters.';
  if (!USERNAME_RE.test(u)) return 'Only letters, numbers, _ and .';
  return null;
}

export function passwordProblem(p: string): string | null {
  return p.length < MIN_PASSWORD ? `At least ${MIN_PASSWORD} characters.` : null;
}

/** Returns an error message, or null on success. */
export async function signIn(username: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  return error ? friendly(error) : null;
}

/** Returns an error message, or null on success (the user is signed in right away). */
export async function signUp(username: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
    options: { data: { username: cleanUsername(username) } },
  });
  return error ? friendly(error) : null;
}

export async function signOut() {
  await supabase.auth.signOut();
}

/** null when the check itself failed (offline). */
export async function isUsernameAvailable(username: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('username_available', { name: cleanUsername(username) });
  return error ? null : Boolean(data);
}

function friendly(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'Wrong username or password.';
    case 'user_already_exists':
    case 'email_exists':
      return 'That username is taken.';
    case 'weak_password':
      return error.message.toLowerCase().includes('pwned') || error.message.toLowerCase().includes('known')
        ? 'That password is too common. Pick another.'
        : `Use at least ${MIN_PASSWORD} characters.`;
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many tries. Wait a minute and try again.';
    case 'signup_disabled':
      return 'New accounts are switched off right now.';
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) {
    return "Can't reach EasyLift. Check your connection.";
  }
  return 'Something went wrong. Try again.';
}
