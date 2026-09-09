import { useRef } from 'react';
import { View } from 'react-native';

import { Button } from './Button';
import { useFollow, useIsFollowedBy } from '@/modules/social';

type Props = {
  targetUid: string;
};

// Reserves the same slot for every label ("Follow", "Following", "Follow Back") and for the
// still-loading state, so a card/row showing this never resizes or jumps as the button's own
// state resolves or changes — the labels themselves stay left-aligned within it since Button
// sizes to its own text, not stretched to fill.
const SLOT_WIDTH = 132;

/** Follow/Unfollow toggle for a given uid — wraps modules/social/useFollow.ts's live doc listener
 * + follow()/unfollow() callables, so any screen showing a uid can drop this in without wiring
 * its own state. Reads "Follow Back" instead of plain "Follow" when the other person already
 * follows the viewer and the viewer hasn't followed back yet, matching Instagram's convention.
 *
 * The double-tap guard below is deliberately NOT surfaced as Button's own `disabled`/`loading`
 * prop — useFollow's `isFollowing` already flips instantly (optimistic), so the button's label is
 * correct the moment it's tapped; dimming it for the ~1-2s a Cloud Function callable takes to
 * actually resolve would just read as a flicker (correct label → dim → correct label again) for
 * no benefit, since the guard against a genuine double-tap is enforced here in JS instead. */
export function FollowButton({ targetUid }: Props) {
  const { isFollowing, loading, follow, unfollow } = useFollow(targetUid);
  const theyFollowMe = useIsFollowedBy(targetUid);
  const inFlight = useRef(false);

  if (loading) return <View style={{ width: SLOT_WIDTH }} />;

  const onPress = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await (isFollowing ? unfollow() : follow());
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <View style={{ width: SLOT_WIDTH, alignItems: 'center' }}>
      <Button label={isFollowing ? 'Following' : theyFollowMe ? 'Follow Back' : 'Follow'} variant={isFollowing ? 'secondary' : 'primary'} onPress={onPress} />
    </View>
  );
}
