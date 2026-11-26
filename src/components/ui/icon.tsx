import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

// The only icon family in EasyLift (design/MASTER.md).
export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon(props: ComponentProps<typeof MaterialCommunityIcons>) {
  return <MaterialCommunityIcons size={20} {...props} />;
}
