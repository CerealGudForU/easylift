import { EmptyScreen } from '@/components/ui/empty-state';

export default function FeedScreen() {
  return (
    <EmptyScreen
      screenTitle="Feed"
      icon="account-group-outline"
      headline="Lift with your friends"
      body="Add friends by username to see their workouts here."
      action={{ label: 'Add friends', onPress: () => {} }}
    />
  );
}
