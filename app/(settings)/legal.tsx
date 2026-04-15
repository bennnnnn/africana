import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT } from '@/constants';
import { SettingsHeaderBar } from '@/components/settings/SettingsHeaderBar';

type Tab = 'privacy' | 'terms';

export default function LegalScreen() {
  const [tab, setTab] = useState<Tab>('terms');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SettingsHeaderBar title="Legal" titleAlign="center" />

      {/* Tab switch */}
      <View style={s.tabs}>
        {(['terms', 'privacy'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab === t && s.tabBtnOn]}>
            <Text style={[s.tabText, tab === t && s.tabTextOn]}>
              {t === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {tab === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.body}>{children}</Text>
    </View>
  );
}

function TermsContent() {
  return (
    <>
      <Text style={s.lastUpdated}>Last updated: March 2026</Text>

      <Section title="1. Acceptance of Terms">
        By creating an account on Africana, you agree to these Terms of Service. If you do not agree, please do not use the app. These terms apply to all users of Africana worldwide.
      </Section>

      <Section title="2. Eligibility">
        You must be at least 18 years old to use Africana. By registering, you confirm that you are 18 or older. We reserve the right to terminate accounts of users found to be underage.
      </Section>

      <Section title="3. Account Responsibility">
        You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. Africana is not liable for any loss resulting from unauthorized account access.
      </Section>

      <Section title="4. Acceptable Use">
        You agree not to:
        {'\n'}• Post false, misleading, or deceptive information
        {'\n'}• Use the app to harass, abuse, or harm others
        {'\n'}• Upload explicit, offensive, or illegal content
        {'\n'}• Create fake profiles or impersonate others
        {'\n'}• Attempt to scrape, hack, or reverse-engineer the platform
        {'\n'}• Use the app for commercial solicitation or spam
      </Section>

      <Section title="5. Profile Content">
        You retain ownership of content you submit. By uploading photos or text, you grant Africana a non-exclusive, royalty-free license to display your content within the platform. We reserve the right to remove content that violates these terms.
      </Section>

      <Section title="6. Safety">
        Africana takes user safety seriously. We encourage users to report suspicious behavior. While we moderate reported content, we cannot guarantee the authenticity of all profiles. Always meet people in public places for the first time.
      </Section>

      <Section title="7. Termination">
        We reserve the right to suspend or terminate accounts that violate these terms without notice. You may delete your account at any time from Settings → Delete Account.
      </Section>

      <Section title="8. Disclaimers">
        Africana is provided "as is" without warranties of any kind. We are not responsible for the actions of other users on or off the platform.
      </Section>

      <Section title="9. Contact">
        For questions about these terms, contact us at: support@africana.app
      </Section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <Text style={s.lastUpdated}>Last updated: March 2026</Text>

      <Section title="1. Information We Collect">
        We collect information you provide directly:
        {'\n'}• Profile information (name, age, gender, photos, bio)
        {'\n'}• Location data (country, region, city)
        {'\n'}• Usage data (who you like, message, and view)
        {'\n'}• Device information (push notification token)
        {'\n'}• Authentication data (email or Google account)
      </Section>

      <Section title="2. How We Use Your Information">
        Your data is used to:
        {'\n'}• Show your profile to compatible members
        {'\n'}• Send notifications (messages, likes, matches)
        {'\n'}• Improve matching algorithms
        {'\n'}• Enforce our Terms of Service and safety policies
        {'\n'}• Comply with legal obligations
      </Section>

      <Section title="3. Data Sharing">
        We do not sell your personal data to third parties. Your profile is visible to other authenticated Africana users according to your privacy settings. We may share data with:
        {'\n'}• Supabase (database & authentication infrastructure)
        {'\n'}• Expo (push notification delivery)
        {'\n'}• Law enforcement when legally required
      </Section>

      <Section title="4. Your Controls">
        You can:
        {'\n'}• Hide your profile from discovery (Settings → Profile Visible)
        {'\n'}• Hide your online status (Settings → Show Online Status)
        {'\n'}• Disable messages (Settings → Receive Messages)
        {'\n'}• Block any user from your profile
        {'\n'}• Delete your account and all data permanently (Settings → Delete Account)
      </Section>

      <Section title="5. Data Retention">
        If you delete your account, we permanently delete your profile, photos, messages, and all associated data within 30 days. Some anonymized analytics may be retained.
      </Section>

      <Section title="6. Security">
        We use industry-standard encryption for data in transit and at rest. Authentication is handled by Supabase, which is SOC 2 compliant. However, no system is 100% secure.
      </Section>

      <Section title="7. Children">
        Africana is strictly for users 18 and older. We do not knowingly collect data from minors.
      </Section>

      <Section title="8. Contact">
        For privacy questions or data deletion requests: privacy@africana.app
      </Section>
    </>
  );
}

const s = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnOn: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: FONT.sm, fontWeight: FONT.medium, color: COLORS.textSecondary },
  tabTextOn: { color: COLORS.primary, fontWeight: FONT.bold },
  content: { padding: 20, paddingBottom: 60 },
  lastUpdated: { fontSize: FONT.xs, color: COLORS.textMuted, marginBottom: 20 },
  sectionTitle: { fontSize: FONT.md, fontWeight: FONT.bold, color: COLORS.text, marginBottom: 6 },
  body: { fontSize: FONT.sm, color: COLORS.textSecondary, lineHeight: 22 },
});
