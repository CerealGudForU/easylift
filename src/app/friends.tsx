// Friends: search by username, incoming and sent requests, and your friends.
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/social/avatar';
import { ActionSheet } from '@/components/ui/action-sheet';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useFriendAction, useFriends, useSearchPeople, type FriendStatus, type Person } from '@/lib/social';
import { fonts, radius, size, space, useColors } from '@/theme';

export default function FriendsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const friends = useFriends();
  const search = useSearchPeople(query);
  const act = useFriendAction();
  const [menu, setMenu] = useState<Person | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<Person | null>(null);

  const list = friends.data ?? [];
  const received = list.filter((f) => f.status === 'received');
  const sent = list.filter((f) => f.status === 'sent');
  const accepted = list.filter((f) => f.status === 'friends');
  const searching = query.trim().length >= 2;
  const busy = (id: string) => act.isPending && act.variables?.otherId === id;

  const actionFor = (p: Person, status: FriendStatus) => {
    switch (status) {
      case 'none':
        return <Button label="Add" icon="account-plus" compact variant="primary" loading={busy(p.id)}
          onPress={() => act.mutate({ action: 'request', otherId: p.id })} />;
      case 'received':
        return (
          <View style={styles.pair}>
            <Button label="Decline" compact variant="ghost" disabled={busy(p.id)}
              onPress={() => act.mutate({ action: 'remove', otherId: p.id })} />
            <Button label="Accept" compact variant="primary" loading={busy(p.id)}
              onPress={() => act.mutate({ action: 'accept', otherId: p.id })} />
          </View>
        );
      case 'sent':
        return <Button label="Cancel" compact loading={busy(p.id)}
          onPress={() => act.mutate({ action: 'remove', otherId: p.id })} />;
      case 'friends':
        return (
          <Pressable onPress={() => setMenu(p)} hitSlop={8} accessibilityRole="button"
            accessibilityLabel={`Options for ${p.username}`} style={styles.more}>
            <Icon name="dots-vertical" size={22} color={c.textSecondary} />
          </Pressable>
        );
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <ScreenHeader title="Friends" />
      <View style={[styles.search, { backgroundColor: c.field }]}>
        <Icon name="magnify" size={20} color={c.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by username"
          placeholderTextColor={c.textMuted}
          selectionColor={c.accent}
          cursorColor={c.accent}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          maxLength={20}
          accessibilityLabel="Search by username"
          style={[styles.searchInput, { color: c.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <Icon name="close-circle" size={18} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {act.isError ? (
        <Text variant="label" tone="danger" style={styles.error}>
          That didn&apos;t work. Check your connection and try again.
        </Text>
      ) : null}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxxl }}>
        {searching ? (
          <Section title="Results">
            {search.isPending ? (
              <ActivityIndicator color={c.accent} style={styles.pad} />
            ) : search.isError ? (
              <Note text="Search needs a connection." />
            ) : search.data?.length ? (
              search.data.map((p) => <PersonRow key={p.id} person={p} trailing={actionFor(p, p.status)} />)
            ) : (
              <Note text={`No one called "${query.trim()}".`} />
            )}
          </Section>
        ) : query.trim().length === 1 ? (
          <Note text="Keep typing: at least 2 letters." />
        ) : friends.isPending ? (
          <ActivityIndicator color={c.accent} style={styles.pad} />
        ) : friends.isError ? (
          <View style={styles.pad}>
            <Note text="Friends need a connection." />
            <Button label="Try again" onPress={() => friends.refetch()} />
          </View>
        ) : (
          <>
            {received.length ? (
              <Section title={`Requests · ${received.length}`}>
                {received.map((p) => <PersonRow key={p.id} person={p} trailing={actionFor(p, 'received')} />)}
              </Section>
            ) : null}
            <Section title={`Friends${accepted.length ? ` · ${accepted.length}` : ''}`}>
              {accepted.length ? (
                accepted.map((p) => <PersonRow key={p.id} person={p} trailing={actionFor(p, 'friends')} />)
              ) : (
                <Note text="No friends yet. Search for someone's username above to send a request." />
              )}
            </Section>
            {sent.length ? (
              <Section title="Sent">
                {sent.map((p) => (
                  <PersonRow key={p.id} person={p} subtitle="Request sent" trailing={actionFor(p, 'sent')} />
                ))}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>

      <ActionSheet
        visible={!!menu}
        title={menu?.username}
        actions={[
          { label: 'Unfriend', icon: 'account-remove-outline', onPress: () => menu && act.mutate({ action: 'remove', otherId: menu.id }) },
          { label: 'Block', icon: 'cancel', destructive: true, onPress: () => setConfirmBlock(menu) },
        ]}
        onClose={() => setMenu(null)}
      />
      <ActionSheet
        visible={!!confirmBlock}
        title={`Block ${confirmBlock?.username ?? ''}?`}
        message="You'll stop being friends, and neither of you will find the other in search."
        actions={[
          {
            label: 'Block',
            icon: 'cancel',
            destructive: true,
            onPress: () => confirmBlock && act.mutate({ action: 'block', otherId: confirmBlock.id }),
          },
        ]}
        onClose={() => setConfirmBlock(null)}
      />
    </View>
  );
}

function PersonRow({ person, subtitle, trailing }: { person: Person; subtitle?: string; trailing: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.push({ pathname: '/user/[id]', params: { id: person.id } })}
        accessibilityRole="button"
        accessibilityLabel={`${person.username}, open profile`}
        style={({ pressed }) => [styles.person, { opacity: pressed ? 0.7 : 1 }]}>
        <Avatar name={person.username} />
        <View style={styles.flex}>
          <Text variant="headline" numberOfLines={1}>
            {person.username}
          </Text>
          {person.display_name || subtitle ? (
            <Text variant="label" tone="textMuted" numberOfLines={1}>
              {subtitle ?? person.display_name}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" tone="textMuted" accessibilityRole="header" style={styles.heading}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Note({ text }: { text: string }) {
  return (
    <Text variant="body" tone="textSecondary" style={styles.note}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    minHeight: size.touch,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 16, paddingVertical: space.sm, outlineWidth: 0 },
  error: { marginHorizontal: space.lg, marginTop: space.sm },
  section: { marginTop: space.lg },
  heading: { marginHorizontal: space.lg, marginBottom: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 64 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64 },
  pair: { flexDirection: 'row', gap: space.xs },
  more: { width: size.touch, height: size.touch, alignItems: 'center', justifyContent: 'center' },
  note: { marginHorizontal: space.lg, marginVertical: space.sm },
  pad: { margin: space.lg, gap: space.md },
});
