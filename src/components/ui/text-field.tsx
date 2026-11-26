import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fonts, radius, size, space, useColors, type Colors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

export type TextInputRef = ComponentRef<typeof TextInput>;

type Props = Omit<TextInputProps, 'style' | 'ref'> & {
  label: string;
  /** Message under the field. `tone` colours it (danger for errors). */
  hint?: { text: string; tone: keyof Colors } | null;
  /** Adds a show/hide toggle and hides the text by default. */
  password?: boolean;
  trailing?: ReactNode;
  ref?: Ref<TextInputRef>;
};

export function TextField({
  ref,
  label,
  hint,
  password,
  trailing,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const isError = hint?.tone === 'danger';
  const borderColor = isError ? c.danger : focused ? c.accent : 'transparent';

  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="textSecondary">
        {label.toUpperCase()}
      </Text>
      <View style={[styles.box, { backgroundColor: c.field, borderColor }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={c.textMuted}
          selectionColor={c.accent}
          cursorColor={c.accent}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={password && !shown}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: c.text }]}
          {...rest}
        />
        {trailing}
        {password ? (
          <Pressable
            onPress={() => setShown((s) => !s)}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
            hitSlop={4}
            style={styles.eye}>
            <Icon name={shown ? 'eye-off-outline' : 'eye-outline'} size={22} color={c.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <Text variant="caption" tone={hint.tone} accessibilityLiveRegion="polite">
          {hint.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: size.touch + 4,
    borderRadius: radius.control,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    paddingLeft: space.md,
  },
  // The field border already shows focus, so drop the browser's focus ring on web.
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    paddingVertical: space.md,
    paddingRight: space.md,
    outlineWidth: 0,
  },
  eye: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
});
