import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';

import { Card, IconBadge, ReminderCard, ScreenContainer, StreakBadge, useTabSwipeNavigation } from '@/components';
import { useAffirmations } from '@/modules/affirmations';
import { useMindfulnessStreak } from '@/modules/mindfulness';
import { useModuleReminders } from '@/modules/reminders';
import { useCheckins } from '@/modules/journal';
import { useAppTheme } from '@/theme';

type ModuleHref = '/meditation' | '/mind-training' | '/breathing' | '/journal' | '/scoreboard' | '/relationships';

type ModuleLink = {
  href: ModuleHref;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  color: string;
  mutedColor: string;
};

/** The tab bar slot that used to be "Journal" — the actual journal entries moved to More's new
 * "Productivity" section (see more.tsx). This now leads with the Affirmation of the Day (the
 * same underlying data/actions as app/(tabs)/affirmations/index.tsx — see useAffirmations),
 * then groups Meditation/Mind Training/Breathing plus the daily morning/night check-in wizard
 * (app/(tabs)/mindfulness-checkin.tsx, writing through the same useCheckins/journal_checkins
 * this hub always has). */
export default function MindfulnessWellnessScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const swipeHandlers = useTabSwipeNavigation('/mindfulness-wellness');
  const { morning, night } = useCheckins();
  const mindfulnessStreak = useMindfulnessStreak();

  const { affirmations, loading: affirmationsLoading, todaysAffirmation, favorites, toggleFavorite } = useAffirmations();
  const { reminders, save: saveReminder, addReminder } = useModuleReminders(
    'affirmations',
    'Your daily affirmation',
    'Take a moment to reflect on something positive.'
  );

  const [index, setIndex] = useState<number | null>(null);

  useEffect(() => {
    if (todaysAffirmation && index === null) {
      const startIndex = affirmations.findIndex((a) => a.id === todaysAffirmation.id);
      setIndex(startIndex >= 0 ? startIndex : 0);
    }
  }, [todaysAffirmation, affirmations, index]);

  const displayed = index !== null ? affirmations[index] : null;

  const onShuffle = () => {
    if (affirmations.length < 2 || index === null) return;
    let next = index;
    while (next === index) {
      next = Math.floor(Math.random() * affirmations.length);
    }
    setIndex(next);
  };

  const onShare = () => {
    if (!displayed) return;
    Share.share({ message: `"${displayed.text}" — via Flowsy` });
  };

  const modules: ModuleLink[] = [
    {
      href: '/journal',
      icon: 'book',
      title: 'Journal',
      subtitle: 'Free-write entries and past check-ins',
      color: theme.colors.moduleJournal,
      mutedColor: theme.colors.moduleJournalMuted,
    },
    {
      href: '/meditation',
      icon: 'moon',
      title: 'Meditation',
      subtitle: 'Guided sessions and timed sits',
      color: theme.colors.moduleJournal,
      mutedColor: theme.colors.moduleJournalMuted,
    },
    {
      href: '/breathing',
      icon: 'pulse',
      title: 'Breathing',
      subtitle: 'Box breathing, 4-7-8, and more',
      color: theme.colors.moduleTasks,
      mutedColor: theme.colors.moduleTasksMuted,
    },
    {
      href: '/mind-training',
      icon: 'bulb',
      title: 'Mind Training',
      subtitle: 'Reaction time, memory, and focus exercises',
      color: theme.colors.primary,
      mutedColor: theme.colors.primaryMuted,
    },
    {
      href: '/relationships',
      icon: 'heart',
      title: 'Relationships',
      subtitle: 'Family, partner, and friends — check in and track your connection',
      color: theme.colors.danger,
      mutedColor: theme.colors.dangerMuted,
    },
    {
      href: '/scoreboard',
      icon: 'podium-outline',
      title: 'Life Scoreboard',
      subtitle: 'Physical, mental, spiritual, financial, and relationship balance',
      color: theme.colors.warning,
      mutedColor: theme.colors.warningMuted,
    },
  ];

  return (
    <View style={{ flex: 1 }} {...swipeHandlers}>
      <ScreenContainer edges={['top', 'bottom']}>
        <View style={{ gap: theme.spacing.xl }}>
          <Text
            style={{
              color: theme.colors.textPrimary,
              fontSize: theme.typography.size['3xl'],
              fontWeight: theme.typography.weight.bold,
            }}>
            Mindfulness & Wellness
          </Text>

          {/* Themed gradient "moment" card — same primary→glow gradient Button's `gradient`
              variant uses, in place of the external background photo the hero used to show. */}
          {!affirmationsLoading && displayed ? (
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.glow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: theme.radius.lg, overflow: 'hidden' }}>
              <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.semibold, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Affirmation of the Day
                </Text>
                <Text style={{ color: '#fff', fontSize: theme.typography.size.xl, fontWeight: theme.typography.weight.semibold, lineHeight: 28 }}>
                  “{displayed.text}”
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Pressable onPress={onShuffle} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="shuffle" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>Shuffle</Text>
                  </Pressable>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: theme.typography.size.xs, fontWeight: theme.typography.weight.medium }}>
                    {(index ?? 0) + 1}/{affirmations.length}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <Pressable onPress={onShare} hitSlop={8}>
                      <Ionicons name="share-social-outline" size={20} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => toggleFavorite(displayed)} hitSlop={8}>
                      <Ionicons
                        name={displayed.is_favorite ? 'heart' : 'heart-outline'}
                        size={22}
                        color={displayed.is_favorite ? theme.colors.danger : '#fff'}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            </LinearGradient>
          ) : null}

          <View style={{ gap: theme.spacing.sm }}>
            <Text
              style={{
                color: theme.colors.textTertiary,
                fontSize: theme.typography.size.xs,
                fontWeight: theme.typography.weight.semibold,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
              Daily mindfulness nudge
            </Text>
            {reminders.length > 0 ? (
              reminders.map((reminder) => (
                <ReminderCard key={reminder.id} state={reminder} onSave={(next) => saveReminder(reminder.id, next)} color={theme.colors.moduleJournal} />
              ))
            ) : (
              <Pressable onPress={addReminder}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <IconBadge name="notifications-outline" color={theme.colors.moduleJournal} />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                    Set a daily reminder to reflect
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                </Card>
              </Pressable>
            )}
          </View>

          <Pressable onPress={() => router.push('/affirmations/all')}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <IconBadge name="grid-outline" color={theme.colors.moduleJournal} shape="square" />
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                Browse all affirmations ({affirmations.length})
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
            </Card>
          </Pressable>

          {favorites.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                Saved for You
              </Text>
              {favorites.slice(0, 5).map((affirmation) => (
                <Card key={affirmation.id} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.sm }}>
                  <IconBadge name="sparkles" color={theme.colors.moduleJournal} size="sm" shape="square" />
                  <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.sm }}>{affirmation.text}</Text>
                  <Pressable onPress={() => toggleFavorite(affirmation)} hitSlop={8}>
                    <Ionicons name="heart" size={18} color={theme.colors.danger} />
                  </Pressable>
                </Card>
              ))}
            </View>
          ) : null}

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <IconBadge name="flame" color={theme.colors.warning} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                Reflection streak
              </Text>
              <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Meditation or breathing, logged daily</Text>
            </View>
            <StreakBadge streak={mindfulnessStreak} />
          </Card>

          <View style={{ gap: theme.spacing.sm }}>
            <Text
              style={{
                color: theme.colors.textTertiary,
                fontSize: theme.typography.size.xs,
                fontWeight: theme.typography.weight.semibold,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
              Daily check-in
            </Text>
            <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
              <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/mindfulness-checkin', params: { type: 'morning' } })}>
                <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
                  <IconBadge
                    name={morning ? 'sunny' : 'sunny-outline'}
                    color={theme.colors.moduleJournal}
                    tone={morning ? 'tinted' : 'neutral'}
                  />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                    {morning ? 'Morning check-in done' : 'Morning check-in'}
                  </Text>
                </Card>
              </Pressable>
              <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/mindfulness-checkin', params: { type: 'night' } })}>
                <Card style={{ alignItems: 'center', gap: theme.spacing.sm }}>
                  <IconBadge
                    name={night ? 'moon' : 'moon-outline'}
                    color={theme.colors.moduleJournal}
                    tone={night ? 'tinted' : 'neutral'}
                  />
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                    {night ? 'Night check-in done' : 'Night check-in'}
                  </Text>
                </Card>
              </Pressable>
            </View>
          </View>

          <View style={{ gap: theme.spacing.md }}>
            {modules.map((mod) => (
              <Link key={mod.href} href={mod.href} asChild>
                <Pressable>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                    <IconBadge name={mod.icon} color={mod.color} shape="square" />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: theme.colors.textPrimary,
                          fontSize: theme.typography.size.base,
                          fontWeight: theme.typography.weight.semibold,
                        }}>
                        {mod.title}
                      </Text>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                        {mod.subtitle}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        </View>
      </ScreenContainer>
    </View>
  );
}
