import { Stack } from 'expo-router';

export default function SocialLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Feed', headerShown: false }} />
      <Stack.Screen name="search" options={{ title: 'Find people' }} />
      <Stack.Screen name="profile/[uid]/index" options={{ title: 'Profile' }} />
      <Stack.Screen name="profile/[uid]/followers" options={{ title: 'Followers' }} />
      <Stack.Screen name="compose" options={{ title: 'Share progress' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="saved" options={{ title: 'Saved posts' }} />
      <Stack.Screen name="clubs/index" options={{ title: 'Clubs' }} />
      <Stack.Screen name="clubs/create" options={{ title: 'Create Club', presentation: 'modal' }} />
      <Stack.Screen name="clubs/[clubId]" options={{ title: 'Club' }} />
      <Stack.Screen name="clubs/edit" options={{ title: 'Edit Club', presentation: 'modal' }} />
      <Stack.Screen name="clubs/delete-club" options={{ title: 'Delete Club', presentation: 'modal' }} />
      <Stack.Screen name="clubs/add-members" options={{ title: 'Invite People', presentation: 'modal' }} />
      <Stack.Screen name="clubs/challenge-new" options={{ title: 'New Challenge', presentation: 'modal' }} />
      <Stack.Screen name="clubs/challenge" options={{ title: 'Challenge' }} />
      <Stack.Screen name="clubs/event-new" options={{ title: 'New Event', presentation: 'modal' }} />
      <Stack.Screen name="clubs/event" options={{ title: 'Event' }} />
    </Stack>
  );
}
