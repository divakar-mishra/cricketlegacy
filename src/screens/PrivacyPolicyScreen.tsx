import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text, Button, Card, Icon, Screen, ScreenHeader } from '../components';
import {
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_POLICY_EFFECTIVE_DATE,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_UPDATE_DATE,
} from '../content/privacyPolicy';
import { PUBLIC_RESOURCES } from '../config/legal';
import { ScreenProps } from '../navigation';
import { fontSize, fontWeight, spacing, ThemeColors, useThemedStyles } from '../theme';

export function PrivacyPolicyScreen({ navigation }: ScreenProps<'PrivacyPolicy'>) {
  const styles = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set([0, 1]));

  const toggle = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <Screen scroll>
      <ScreenHeader title="Privacy Policy" onBack={() => navigation.goBack()} />

      <Card style={styles.introCard}>
        <Text style={styles.kicker}>YOUR DATA</Text>
        <Text style={styles.title}>Cricket Legacy Privacy Policy</Text>
        <Text style={styles.intro}>How Sunlight handles information in Cricket Legacy.</Text>
        <Text style={styles.effective}>Effective {PRIVACY_POLICY_EFFECTIVE_DATE}</Text>
        <Text style={styles.update}>Privacy update: {PRIVACY_POLICY_UPDATE_DATE}</Text>
      </Card>

      <View style={styles.sections}>
        {PRIVACY_POLICY_SECTIONS.map((section, index) => {
          const open = expanded.has(index);
          return (
            <Card key={section.title} style={styles.sectionCard}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${section.title}`}
                accessibilityState={{ expanded: open }}
                onPress={() => toggle(index)}
                style={({ pressed }) => [styles.sectionHeader, pressed && styles.pressed]}
              >
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} />
              </Pressable>
              {open ? (
                <View style={styles.sectionBody}>
                  {section.bullets?.map((bullet) => (
                    <View key={bullet} style={styles.bulletRow}>
                      <Text style={styles.bullet}>•</Text>
                      <Text style={styles.body}>{bullet}</Text>
                    </View>
                  ))}
                  {section.paragraphs?.map((paragraph) => (
                    <Text key={paragraph} style={styles.body} selectable>
                      {paragraph}
                    </Text>
                  ))}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>

      <Text style={styles.contact} selectable>
        Privacy contact: {PRIVACY_CONTACT_EMAIL}
      </Text>
      {PUBLIC_RESOURCES.privacyPolicy ? (
        <Button
          label="Open current policy online"
          variant="secondary"
          onPress={() => void Linking.openURL(PUBLIC_RESOURCES.privacyPolicy as string)}
        />
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    introCard: { marginBottom: spacing.lg },
    kicker: { color: colors.primaryLight, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
    title: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy, marginTop: spacing.xs },
    intro: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22, marginTop: spacing.sm },
    effective: { color: colors.text, fontSize: fontSize.sm, marginTop: spacing.md },
    update: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xs },
    sections: { gap: spacing.sm },
    sectionCard: { paddingVertical: spacing.xs },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
    sectionTitle: { color: colors.text, flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    sectionBody: { borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm, paddingTop: spacing.md },
    body: { color: colors.textMuted, flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
    bulletRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    bullet: { color: colors.primaryLight, fontSize: fontSize.md, lineHeight: 20 },
    pressed: { opacity: 0.78 },
    contact: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, marginVertical: spacing.lg },
  });
