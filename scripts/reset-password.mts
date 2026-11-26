// Reset a user's password (there is no "forgot password" flow; PLAN.md §4.1).
// Usage: npm run reset-password -- <username> <new-password>
import { admin } from './admin-client.mts';

const [rawUsername, password] = process.argv.slice(2);
if (!rawUsername || !password) {
  console.error('Usage: npm run reset-password -- <username> <new-password>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const username = rawUsername.trim();
const { data: profile, error: findError } = await admin
  .from('profiles')
  .select('id, username')
  .eq('username', username)
  .maybeSingle();

if (findError) {
  console.error(`Lookup failed: ${findError.message}`);
  process.exit(1);
}
if (!profile) {
  console.error(`No user named "${username}".`);
  process.exit(1);
}

const { error } = await admin.auth.admin.updateUserById(profile.id, { password });
if (error) {
  console.error(`Reset failed: ${error.message}`);
  process.exit(1);
}
// Sign them out everywhere so the old password's sessions end.
await admin.auth.admin.signOut(profile.id).catch(() => {});
console.log(`Password for "${profile.username}" was reset. Tell them the new one in person.`);
