import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { AuthScreen } from '@/components/auth/auth-screen';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField, type TextInputRef } from '@/components/ui/text-field';
import { signIn } from '@/lib/auth';
import { haptic } from '@/lib/haptics';

export default function SignInScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInputRef>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const message = await signIn(username, password);
    setBusy(false);
    // On success the session listener swaps to the app; nothing to do here.
    if (message) {
      haptic.heavy();
      setError(message);
    }
  };

  return (
    <AuthScreen
      title="Sign in"
      subtitle="Pick up where you left off."
      footer={
        <>
          <Button label="Create account" variant="ghost" onPress={() => router.push('/sign-up')} />
          <Text variant="caption" tone="textMuted" style={{ textAlign: 'center' }}>
            Forgot your password? Ask the admin to reset it.
          </Text>
        </>
      }>
      <TextField
        label="Username"
        value={username}
        onChangeText={(t) => {
          // Keep exactly what was typed: rewriting text mid-keystroke fights the Android
          // keyboard (duplicated letters, jumping cursor). Sign-in ignores case.
          setUsername(t);
          setError(null);
        }}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
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
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        hint={error ? { text: error, tone: 'danger' } : null}
      />
      <Button label="Sign in" variant="primary" onPress={submit} disabled={!canSubmit && !busy} loading={busy} />
    </AuthScreen>
  );
}
