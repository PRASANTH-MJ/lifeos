import { Image } from 'react-native';

import { IconBadge } from './IconBadge';

type Size = 'sm' | 'md' | 'lg';

const SIZE_PX: Record<Size, number> = { sm: 32, md: 40, lg: 48 };

type Props = {
  url: string | null | undefined;
  size?: Size;
  color?: string;
};

/** A user's profile photo, same footprint as IconBadge('person') so it drops into any spot
 * that used the placeholder icon — falls back to that same placeholder when no photo is set. */
export function Avatar({ url, size = 'md', color }: Props) {
  if (!url) return <IconBadge name="person" size={size} color={color} />;
  const box = SIZE_PX[size];
  return <Image source={{ uri: url }} style={{ width: box, height: box, borderRadius: box / 2 }} />;
}
