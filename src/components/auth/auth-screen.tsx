import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { space, useColors } from '@/theme';

type Props = { title: string; subtitle: string; children: ReactNode; footer?: ReactNode };

/** Shared frame for sign-in and sign-up: brand mark, title, form, footer. */
export function AuthScreen({ title, subtitle, children, footer }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + space.huge, paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={[styles.mark, { backgroundColor: c.accent }]}>
            <Icon name="dumbbell" size={26} color={c.onAccent} />
          </View>
          <Text variant="exercise" tone="textSecondary">
            EasyLift
          </Text>
        </View>
        <View style={styles.heading}>
          <Text variant="display" accessibilityRole="header">
            {title}
          </Text>
          <Text variant="body" tone="textSecondary">
            {subtitle}
          </Text>
        </View>
        <View style={styles.form}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: space.lg, gap: space.xxl, maxWidth: 480, width: '100%', alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  mark: { width: 44, height: 44, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  heading: { gap: space.sm },
  form: { gap: space.lg },
  footer: { marginTop: 'auto', gap: space.md, alignItems: 'center' },
});
