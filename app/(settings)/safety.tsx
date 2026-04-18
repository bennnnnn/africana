import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '@/constants';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';

type TipProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
};

/**
 * Bite-sized, scannable safety guidance. Apple's dating-app reviewer
 * explicitly looks for a dedicated safety-tips surface (not just a
 * section buried inside the Terms), so this screen is linked from
 * Settings → Privacy and Settings → Main hub.
 */
export default function SafetyScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Stay safe" titleAlign="leading" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Dating online opens up wonderful connections — and, occasionally, bad
          actors. A few simple habits keep you in charge. If anything feels off,
          trust your gut and pull back.
        </Text>

        <SectionHeader>Before you meet</SectionHeader>
        <Tip
          icon="eye-outline"
          iconColor="#3B82F6"
          iconBg="#DBEAFE"
          title="Video call first"
          body="A 2-minute video chat tells you more than weeks of texting. If they refuse on camera, that's a signal."
        />
        <Tip
          icon="search-outline"
          iconColor="#7C3AED"
          iconBg="#EDE9FE"
          title="Do a quick search"
          body="Reverse-search their photos, look them up on social media, and ask friends if the story they're telling matches."
        />
        <Tip
          icon="time-outline"
          iconColor={COLORS.earth}
          iconBg="#FEF3C7"
          title="Take your time"
          body="There's no rush. Anyone pressuring you to meet quickly, share contacts, or go off-platform early is a red flag."
        />

        <SectionHeader>When you meet in person</SectionHeader>
        <Tip
          icon="location-outline"
          iconColor={COLORS.primary}
          iconBg="#FEE2E2"
          title="Public place, your choice"
          body="Pick the venue yourself — a busy café, restaurant, or bar. Never the first meet at someone's home or in an isolated place."
        />
        <Tip
          icon="people-outline"
          iconColor={COLORS.success}
          iconBg={COLORS.successSurface}
          title="Tell someone"
          body="Share your plans and the person's name with a friend. Check in with them afterwards. Share your live location for the date if you can."
        />
        <Tip
          icon="car-outline"
          iconColor="#0891B2"
          iconBg="#CFFAFE"
          title="Own transport home"
          body="Arrange your own way home, and keep your phone charged. Never let someone who's a stranger drive you to or from the first date."
        />
        <Tip
          icon="wine-outline"
          iconColor={COLORS.earth}
          iconBg="#FEF3C7"
          title="Watch your drink"
          body="Order it yourself, keep it in sight, and leave any drink that's been out of your view. If you feel suddenly unwell, get help right away."
        />

        <SectionHeader>Protect your information</SectionHeader>
        <Tip
          icon="card-outline"
          iconColor={COLORS.primary}
          iconBg="#FEE2E2"
          title="Never send money"
          body="Nobody genuinely building a connection needs you to wire money, buy gift cards, or invest in anything. This is the #1 romance-scam playbook. Walk away."
        />
        <Tip
          icon="shield-checkmark-outline"
          iconColor={COLORS.success}
          iconBg={COLORS.successSurface}
          title="Keep it on Africana"
          body="Stay in-app while you're getting to know someone. Off-platform messaging loses our moderation protections and makes it easier for scammers."
        />
        <Tip
          icon="lock-closed-outline"
          iconColor="#0891B2"
          iconBg="#CFFAFE"
          title="Guard your details"
          body="Don't share your home address, workplace, full date of birth, or bank info with matches. Those are the keys to identity theft."
        />

        <SectionHeader>If something goes wrong</SectionHeader>
        <Tip
          icon="ban-outline"
          iconColor={COLORS.error}
          iconBg="#FEE2E2"
          title="Block and report"
          body="Tap the menu on any profile or chat, then Block or Report. Blocks are instant and private. Reports are reviewed by our team, and three reports auto-hides a profile from everyone."
        />
        <Tip
          icon="call-outline"
          iconColor={COLORS.error}
          iconBg="#FEE2E2"
          title="In an emergency"
          body="If you're in immediate danger, stop and call your local emergency services. Your safety matters more than finishing a date."
        />
        <Tip
          icon="mail-outline"
          iconColor={COLORS.textSecondary}
          iconBg={COLORS.savanna}
          title="Contact us"
          body="For anything the in-app tools can't handle — harassment, impersonation, serious concerns — email support@africana.app. We read every message."
        />

        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionHeader}>{children}</Text>;
}

function Tip({ icon, iconColor, iconBg, title, body }: TipProps) {
  return (
    <View style={styles.tipCard}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tipTitle}>{title}</Text>
        <Text style={styles.tipBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  intro: {
    fontSize: FONT.md,
    lineHeight: 22,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 8,
    fontSize: FONT.sm,
    fontWeight: FONT.extrabold,
    color: COLORS.textStrong,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tipCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: {
    fontSize: FONT.md,
    fontWeight: FONT.bold,
    color: COLORS.textStrong,
    marginBottom: 2,
  },
  tipBody: {
    fontSize: FONT.sm,
    lineHeight: 20,
    color: COLORS.textSecondary,
  },
});
