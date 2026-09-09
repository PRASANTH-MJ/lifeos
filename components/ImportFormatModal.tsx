import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/theme';

export type ImportFieldSpec = {
  /** Column header the parser actually matches on (first match wins when more than one alias is
   * accepted — e.g. finance's "account" also accepts "accountname"). Shown as the row's title. */
  column: string;
  /** Other header spellings the parser accepts for this same field, shown as "or ...". */
  aliases?: string[];
  required: boolean;
  /** Short type/format description, e.g. "YYYY-MM-DD" or "plain number, no currency symbol". */
  format: string;
  example: string;
  /** Extra context, e.g. the exact enum values accepted or a matching rule. */
  notes?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  /** e.g. "Finance Records CSV format". */
  title: string;
  /** One-line context shown under the title, e.g. what a header row needs to look like. */
  intro?: string;
  fields: ImportFieldSpec[];
};

/** Bottom-sheet reference for exactly which columns/format a CSV or Excel import expects — shown
 * from the import entry point on both Finance Records and Shopping List so a user building their
 * own file in a spreadsheet app knows what to type in each column without first downloading and
 * reverse-engineering a sample file. Column matching in both parsers is case-insensitive and
 * trims whitespace, so header casing/spacing never matters. */
export function ImportFormatModal({ visible, onClose, title, intro, fields }: Props) {
  const theme = useAppTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
            maxHeight: '85%',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.colors.textTertiary} />
            </Pressable>
          </View>

          {intro ? (
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm, lineHeight: 20 }}>{intro}</Text>
          ) : null}

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: theme.spacing.md }} showsVerticalScrollIndicator={false}>
            {fields.map((field) => (
              <View
                key={field.column}
                style={{
                  gap: theme.spacing.xs,
                  paddingBottom: theme.spacing.md,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.colors.border,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.semibold }}>
                    {field.column}
                  </Text>
                  <View
                    style={{
                      paddingHorizontal: theme.spacing.sm,
                      paddingVertical: 2,
                      borderRadius: theme.radius.full,
                      backgroundColor: field.required ? theme.colors.dangerMuted : theme.colors.primaryMuted,
                    }}>
                    <Text
                      style={{
                        color: field.required ? theme.colors.danger : theme.colors.primary,
                        fontSize: theme.typography.size.xs,
                        fontWeight: theme.typography.weight.semibold,
                      }}>
                      {field.required ? 'Required' : 'Optional'}
                    </Text>
                  </View>
                </View>

                {field.aliases && field.aliases.length > 0 ? (
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                    or: {field.aliases.join(', ')}
                  </Text>
                ) : null}

                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.size.sm }}>{field.format}</Text>

                {field.notes ? (
                  <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, lineHeight: 18 }}>{field.notes}</Text>
                ) : null}

                <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontStyle: 'italic' }}>
                  e.g. {field.example}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
