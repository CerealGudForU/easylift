import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { TextField, type TextInputRef } from '@/components/ui/text-field';
import type { Colors } from '@/theme';
import { cleanUsername, isUsernameAvailable, passwordProblem, signUp, usernameProblem } from '@/lib/auth';
import { haptic } from '@/lib/haptics';

type Hint = { text: string; tone: keyof Colors } | null;

export default function SignUpScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState({ password: false, confirm: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputRef>(null);
  const confirmRef = useRef<TextInputRef>(null);

  // Live availability, debounced. The result is keyed by name, so a stale answer
  // for an older value is simply ignored.
  const name = cleanUsername(username);
  const formatProblem = name ? usernameProblem(name) : null;
  const [check, setCheck] = useState<{ name: string; available: boolean | null } | null>(null);
  useEffect(() => {
    if (!name || usernameProblem(name)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const available = await isUsernameAvailable(name);
      if (!cancelled) setCheck({ name, available });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [name]);
  const result = check?.name === name ? check.available : undefined;

  const usernameHint: Hint = !name
    ? { text: '3–20 characters: letters, numbers, _ and .', tone: 'textMuted' }
    : formatProblem
      ? { text: formatProblem, tone: 'danger' }
      : result === undefined
        ? { text: 'Checking…', tone: 'textMuted' }
        : result === null
          ? { text: "Couldn't check right now. You can still try.", tone: 'textMuted' }
          : result
            ? { text: `${name} is available`, tone: 'successText' }
            : { text: 'That username is taken.', tone: 'danger' };

  const pwProblem = passwordProblem(password);
  const passwordHint: Hint =
    touched.password && pwProblem
      ? { text: pwProblem, tone: 'danger' }
      : { text: 'At least 8 characters. Ask the admin if you ever forget it.', tone: 'textMuted' };
  const mismatch = confirm.length > 0 && confirm !== password;
  const confirmHint: Hint = error
    ? { text: error, tone: 'danger' }
    : (touched.confirm || confirm.length >= password.length) && mismatch
      ? { text: "Passwords don't match.", tone: 'danger' }
      : null;

  const canSubmit = !!name && !formatProblem && result !== false && !pwProblem && confirm === password && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const message = await signUp(name, password);
    setBusy(false);
    if (message) {
      haptic.heavy();
      setError(message);
    } else {
      haptic.success();
    }
  };

  return (
    <AuthScreen
      title="Create account"
      subtitle="Your username is how friends find you."
      footer={
        <Button
          label="I already have an account"
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/sign-in'))}
        />
      }>
      <TextField
        label="Username"
        value={username}
        onChangeText={(t) => {
          // Keep exactly what was typed: rewriting text mid-keystroke fights the Android
          // keyboard (duplicated letters, jumping cursor). Capitals are kept; matching ignores case.
          setUsername(t);
          setError(null);
        }}
        maxLength={20}
        autoComplete="username-new"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
        hint={usernameHint}
        autoFocus
      />
      <TextField
        ref={passwordRef}
        label="Password"
        password
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        onBlur={() => setTouched((s) => ({ ...s, password: true }))}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
        hint={passwordHint}
      />
      <TextField
        ref={confirmRef}
        label="Confirm password"
        password
        value={confirm}
        onChangeText={(t) => {
          setConfirm(t);
          setError(null);
        }}
        onBlur={() => setTouched((s) => ({ ...s, confirm: true }))}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
        hint={confirmHint}
      />
      <Button label="Create account" variant="primary" onPress={submit} disabled={!canSubmit && !busy} loading={busy} />
    </AuthScreen>
  );
}
