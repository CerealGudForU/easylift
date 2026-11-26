import { EmptyScreen } from '@/components/ui/empty-state';

export default function ProfileScreen() {
  return (
    <EmptyScreen
      screenTitle="Profile"
      icon="chart-line"
      headline="Your progress lives here"
      body="Finish your first workout to see volume, records, and streaks."
    />
  );
}
