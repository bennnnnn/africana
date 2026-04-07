import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { notifyUser } from '@/lib/notifications';
import { useAuthStore } from '@/store/auth.store';
import { MOCK_USERS } from '@/lib/mock-data';
import { useChatStore } from '@/store/chat.store';
import { useDiscoverStore } from '@/store/discover.store';
import { User } from '@/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, DEFAULT_AVATAR, RELIGION_OPTIONS, EDUCATION_OPTIONS, MARITAL_STATUS_OPTIONS, LOOKING_FOR_OPTIONS, WANT_CHILDREN_OPTIONS } from '@/constants';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { MatchModal } from '@/components/ui/MatchModal';
import { calculateAge, getEffectiveAgePreferenceRange } from '@/lib/utils';

const { width } = Dimensions.get('window');

const GENDER_LABEL: Record<string, string> = { male: 'Man', female: 'Woman' };
const REPORT_REASONS = ['Fake profile', 'Scam', 'Harassment', 'Nudity', 'Underage', 'Other'] as const;

type ProfileWithAgePrefs = User & { min_age_pref?: number | null; max_age_pref?: number | null };

function isMeaningfulText(value: string | null | undefined): boolean {
  const n = value?.trim();
  return !!n && n !== '-' && n !== '—';
}

export default function ProfileViewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const { getOrCreateConversation } = useChatStore();
  const { likedUserIds, toggleLike } = useDiscoverStore();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [matchUser, setMatchUser] = useState<User | null>(null);
  const [compatibilityExpanded, setCompatibilityExpanded] = useState(false);
  const [reportPromptVisible, setReportPromptVisible] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<typeof REPORT_REASONS[number] | null>(null);
  const [reportValidationVisible, setReportValidationVisible] = useState(false);
  const [blockPromptVisible, setBlockPromptVisible] = useState(false);

  useEffect(() => {
    setCompatibilityExpanded(false);
    setReportPromptVisible(false);
    setSelectedReportReason(null);
    setReportValidationVisible(false);
    setBlockPromptVisible(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Serve mock data instantly for mock user IDs (no DB round-trip needed)
    if (String(id).startsWith('mock-')) {
      const today = new Date();
      const mock = MOCK_USERS.find((u) => u.id === id);
      if (mock) {
        const bday = mock.birthdate ? new Date(mock.birthdate) : null;
        const age = bday
          ? today.getFullYear() - bday.getFullYear()
            - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
          : undefined;
        setProfile({ ...mock, age, profile_photos: mock.profile_photos ?? [], languages: mock.languages ?? [] });
      }
      setIsLoading(false);
      return;
    }

    supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const today = new Date();
          const bday = data.birthdate ? new Date(data.birthdate) : null;
          const age = bday
            ? today.getFullYear() - bday.getFullYear()
              - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
            : undefined;
          setProfile({ ...data, age, profile_photos: data.profile_photos ?? [], languages: data.languages ?? [] });

          // Record profile view (upsert so we don't spam rows)
          if (currentUser && currentUser.id !== id) {
            supabase.from('profile_views').upsert(
              { viewer_id: currentUser.id, viewed_id: id, viewed_at: new Date().toISOString() },
              { onConflict: 'viewer_id,viewed_id' },
            );
            // Notify the viewed user (respects their notify_views preference)
            notifyUser({
              type: 'view',
              recipientId: id as string,
              senderId: currentUser.id,
              senderName: currentUser.full_name ?? 'Someone',
              extra: { userId: currentUser.id },
            });
          }
        }
        setIsLoading(false);
      });
  }, [id]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Profile not found</Text>
        <Button title="Go Back" onPress={() => router.back()} style={{ marginTop: 16 }} />
      </SafeAreaView>
    );
  }

  const religionLabel = profile.religion
    ? RELIGION_OPTIONS.find(r => r.value === profile.religion)?.label ?? profile.religion
    : null;
  const educationLabel = profile.education
    ? EDUCATION_OPTIONS.find(e => e.value === profile.education)?.label ?? profile.education
    : null;
  const maritalLabel = profile.marital_status
    ? MARITAL_STATUS_OPTIONS.find(m => m.value === profile.marital_status)?.label ?? profile.marital_status
    : null;

  const safePhotos = profile.profile_photos ?? [];
  const photos = safePhotos.length > 0
    ? safePhotos
    : [profile.avatar_url || `${DEFAULT_AVATAR}${encodeURIComponent(profile.full_name.charAt(0))}`];

  const location = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
  const isLiked = likedUserIds.has(profile.id);
  const isOwnProfile = currentUser?.id === profile.id;

  const p = profile as ProfileWithAgePrefs;
  const normalizeText = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
  const viewerLanguages = new Set((currentUser?.languages ?? []).map((lang) => normalizeText(lang)).filter(Boolean));
  const effectiveTheirAgePref = getEffectiveAgePreferenceRange(p.min_age_pref, p.max_age_pref);
  const viewerAge = calculateAge(currentUser?.birthdate) ?? null;
  const profileFirstName = profile.full_name?.trim().split(/\s+/)[0] ?? 'Their';

  type CompatibilityCriterion = {
    key: string;
    label: string;
    viewerValue: string;
    matched: boolean;
  };
  const compatibilityCriteria: CompatibilityCriterion[] = [];
  const pushCompatibility = (
    key: string,
    label: string,
    theirValue: string | null | undefined,
    viewerValue: string | null | undefined,
    matched: boolean,
  ) => {
    if (!theirValue || !viewerValue) return;
    compatibilityCriteria.push({ key, label, viewerValue, matched });
  };

  const LOOKING_SINGLE: Record<string, string> = { men: 'Man', women: 'Woman' };
  const theirLookingFor =
    p.interested_in === 'men' || p.interested_in === 'women' ? LOOKING_SINGLE[p.interested_in] : null;
  const genderPrefMatch =
    !!p.interested_in &&
    (p.interested_in === 'men' || p.interested_in === 'women') &&
    !!currentUser?.gender &&
    ((p.interested_in === 'men' && currentUser.gender === 'male') ||
      (p.interested_in === 'women' && currentUser.gender === 'female'));
  pushCompatibility(
    'gender',
    'Looking for',
    theirLookingFor,
    currentUser?.gender ? GENDER_LABEL[currentUser.gender] ?? currentUser.gender : null,
    genderPrefMatch,
  );

  if (!effectiveTheirAgePref.isImplicit) {
    pushCompatibility(
      'age',
      'Age they prefer',
      `${effectiveTheirAgePref.min}–${effectiveTheirAgePref.max} yrs`,
      typeof viewerAge === 'number' ? `${viewerAge} yrs` : null,
      typeof viewerAge === 'number' &&
        viewerAge >= effectiveTheirAgePref.min &&
        viewerAge <= effectiveTheirAgePref.max,
    );
  }

  const viewerGoalLabels = (currentUser?.looking_for ?? [])
    .map((goal) => LOOKING_FOR_OPTIONS.find((option) => option.value === goal)?.label ?? goal.replace('_', ' '))
    .filter(Boolean);
  const profileGoalLabels = (p.looking_for ?? [])
    .map((goal) => LOOKING_FOR_OPTIONS.find((option) => option.value === goal)?.label ?? goal.replace('_', ' '))
    .filter(Boolean);
  const hasGoalOverlap = (currentUser?.looking_for ?? []).some((goal) => (p.looking_for ?? []).includes(goal));
  pushCompatibility(
    'relation_type',
    'Goals',
    profileGoalLabels.join(', '),
    viewerGoalLabels.join(', '),
    hasGoalOverlap,
  );

  pushCompatibility(
    'religion',
    'Religion',
    religionLabel,
    currentUser?.religion
      ? RELIGION_OPTIONS.find((option) => option.value === currentUser.religion)?.label ?? currentUser.religion
      : null,
    !!currentUser?.religion && !!p.religion && currentUser.religion === p.religion,
  );

  const viewerWantChildrenLabel = currentUser?.want_children
    ? WANT_CHILDREN_OPTIONS.find((option) => option.value === currentUser.want_children)?.label ?? currentUser.want_children
    : null;
  const wantLabelRow = p.want_children
    ? WANT_CHILDREN_OPTIONS.find((o) => o.value === p.want_children)?.label ?? p.want_children
    : '';
  pushCompatibility(
    'want_children',
    'Want children',
    wantLabelRow || null,
    viewerWantChildrenLabel,
    !!currentUser?.want_children && !!p.want_children && currentUser.want_children === p.want_children,
  );

  const sharedLanguages = (p.languages ?? []).filter((lang) => viewerLanguages.has(normalizeText(lang)));
  pushCompatibility(
    'languages',
    'Languages',
    (p.languages ?? []).join(', '),
    (currentUser?.languages ?? []).join(', '),
    sharedLanguages.length > 0,
  );

  pushCompatibility(
    'ethnicity',
    'Ethnicity',
    isMeaningfulText(p.ethnicity) ? (p.ethnicity ?? '').trim() : null,
    isMeaningfulText(currentUser?.ethnicity) ? (currentUser?.ethnicity ?? '').trim() : null,
    isMeaningfulText(currentUser?.ethnicity) &&
      isMeaningfulText(p.ethnicity) &&
      normalizeText(currentUser?.ethnicity) === normalizeText(p.ethnicity),
  );

  const matchedCriteriaCount = compatibilityCriteria.filter((c) => c.matched).length;
  const compatibilityPercent =
    compatibilityCriteria.length > 0
      ? Math.round((matchedCriteriaCount / compatibilityCriteria.length) * 100)
      : null;
  const canShowCompatibility = !isOwnProfile && currentUser && compatibilityCriteria.length > 0;

  const handleLike = async () => {
    if (!currentUser) return;
    const wasLiked = likedUserIds.has(profile.id);
    const isMatch = await toggleLike(currentUser.id, profile.id);
    if (isMatch && !wasLiked) {
      setMatchUser(profile);
    }
  };

  const handleMessage = async () => {
    if (!currentUser) return;
    const convId = await getOrCreateConversation(currentUser.id, profile.id);
    if (convId) router.push(`/(chat)/${convId}`);
  };

  const handleBlock = () => {
    setBlockPromptVisible(true);
  };

  const handleReport = () => {
    setSelectedReportReason(null);
    setReportValidationVisible(false);
    setReportPromptVisible(true);
  };

  const confirmBlockUser = async () => {
    if (!currentUser) return;
    await supabase.from('blocks').insert({
      blocker_id: currentUser.id,
      blocked_id: profile.id,
    });
    setBlockPromptVisible(false);
    router.back();
  };

  const submitReport = async () => {
    if (!currentUser) return;
    if (!selectedReportReason) {
      setReportValidationVisible(true);
      return;
    }
    await supabase.from('reports').insert({
      reporter_id: currentUser.id,
      reported_id: profile.id,
      reason: selectedReportReason,
    });
    setReportPromptVisible(false);
    setSelectedReportReason(null);
    setReportValidationVisible(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo Carousel */}
        <View style={{ position: 'relative', backgroundColor: '#000' }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / width));
            }}
          >
            {photos.map((photo, i) => (
              <Image
                key={i}
                source={{ uri: photo }}
                style={{ width, height: width * 1.1 }}
                contentFit="cover"
              />
            ))}
          </ScrollView>

          {/* Photo dots */}
          {photos.length > 1 && (
            <View
              style={{
                position: 'absolute',
                bottom: 16,
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              {photos.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: i === photoIndex ? 20 : 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: i === photoIndex ? '#FFF' : 'rgba(255,255,255,0.5)',
                  }}
                />
              ))}
            </View>
          )}

          {/* Back button + report/block — row at top of photo */}
          <SafeAreaView style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="arrow-back" size={22} color="#FFF" />
              </TouchableOpacity>

              {!isOwnProfile && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={handleReport}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="flag-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleBlock}
                    style={{
                      width: 40, height: 40, borderRadius: 20,
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="ban-outline" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>

        {/* Profile Info */}
        <View style={{ padding: 20, backgroundColor: '#FFFFFF', marginBottom: 8 }}>
          {/* Name + status inline */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: COLORS.text }}>
              {profile.full_name}{profile.age ? `, ${profile.age}` : ''}
            </Text>
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor:
                profile.online_status === 'online' ? `${COLORS.online}20` : `${COLORS.offline}18`,
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
            }}>
              <View style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor:
                  profile.online_status === 'online' ? COLORS.online : COLORS.offline,
              }} />
              <Text style={{
                fontSize: 11, fontWeight: '600', textTransform: 'capitalize',
                color: profile.online_status === 'online' ? COLORS.online : COLORS.textSecondary,
              }}>
                {profile.online_status === 'online'
                  ? 'Online'
                  : `Last seen ${formatLastSeen(profile.last_seen)}`}
              </Text>
            </View>
          </View>

          {location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Ionicons name="location-outline" size={14} color={COLORS.primary} />
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{location}</Text>
            </View>
          ) : null}

          {profile.looking_for.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {profile.looking_for.map((lf) => {
                const label = LOOKING_FOR_OPTIONS.find((o) => o.value === lf)?.label ?? lf.replace('_', ' ');
                return <Badge key={lf} label={label} variant="secondary" />;
              })}
            </View>
          )}

          {profile.bio && (
            <View style={{ marginTop: 16 }}>
              <Text style={detailSectionLabel}>About</Text>
              <Text style={{ fontSize: 15, color: COLORS.text, lineHeight: 23 }}>{profile.bio}</Text>
            </View>
          )}
        </View>

        {/* Details grid */}
        <View style={{ backgroundColor: '#FFFFFF', padding: 20, marginBottom: 8 }}>
          <Text style={detailSectionLabel}>Profile Details</Text>
          <View style={{ gap: 2 }}>
            {buildDetailRows(profile, religionLabel, educationLabel, maritalLabel).map((item, i) => (
              <View key={i} style={detailRow}>
                <View style={detailIconBox}>
                  <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={detailLabel}>{item.label}</Text>
                  <Text style={detailValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Languages */}
        {profile.languages && profile.languages.length > 0 && (
          <View style={{ backgroundColor: '#FFFFFF', padding: 20, marginBottom: 8 }}>
            <Text style={detailSectionLabel}>Languages</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {profile.languages.map((lang) => (
                <View key={lang} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.savanna }}>
                  <Text style={{ fontSize: 13, color: COLORS.earth, fontWeight: '600' }}>{lang}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {canShowCompatibility && compatibilityPercent !== null && (
          <View style={{ backgroundColor: '#FFFFFF', padding: 20, marginBottom: 8 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setCompatibilityExpanded((prev) => !prev)}
              style={{ paddingVertical: 2 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: `${COLORS.success}12`,
                    borderWidth: 1,
                    borderColor: `${COLORS.success}24`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.success }}>
                    {compatibilityPercent}%
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 4 }}>
                    COMPATIBILITY
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: COLORS.text }}>
                    {matchedCriteriaCount} of {compatibilityCriteria.length} match
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 }}>
                    Their preferences compared with yours.
                  </Text>
                </View>
                <Ionicons
                  name={compatibilityExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.textSecondary}
                />
              </View>
            </TouchableOpacity>

            {compatibilityExpanded && (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingBottom: 10 }}>
                  <Text style={{ width: 88, fontSize: 11, fontWeight: '700', color: COLORS.textMuted }}>
                    {profileFirstName}
                  </Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: COLORS.textMuted, textAlign: 'right' }}>
                    You
                  </Text>
                </View>
                {compatibilityCriteria.map((criterion, index) => (
                  <View key={criterion.key}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingBottom: 14 }}>
                      <View style={{ width: 88, paddingRight: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.text }}>
                          {criterion.label}:
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 6 }}>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 14,
                              fontWeight: criterion.matched ? '700' : '600',
                              color: criterion.matched ? COLORS.text : '#C45A5A',
                              fontStyle: criterion.matched ? 'normal' : 'italic',
                              textDecorationLine: criterion.matched ? 'none' : 'line-through',
                            }}
                            numberOfLines={5}
                          >
                            {criterion.viewerValue}
                          </Text>
                          {criterion.matched ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={COLORS.success}
                              style={{ marginTop: 1 }}
                            />
                          ) : null}
                        </View>
                      </View>
                    </View>
                    {index < compatibilityCriteria.length - 1 ? (
                      <View style={{ height: 1, backgroundColor: `${COLORS.border}88`, marginBottom: 14, marginLeft: 98 }} />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Fixed Action Bar */}
      {!isOwnProfile && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 1,
            borderTopColor: COLORS.border,
            flexDirection: 'row',
            padding: 16,
            gap: 12,
            paddingBottom: Math.max(insets.bottom + 8, 20),
          }}
        >
          <TouchableOpacity
            onPress={handleLike}
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              borderWidth: 1.5,
              borderColor: isLiked ? COLORS.primary : COLORS.border,
              backgroundColor: isLiked ? `${COLORS.primary}12` : '#FFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>
          <Button
            title="Send Message"
            onPress={handleMessage}
            style={{ flex: 1, height: 54, borderRadius: 27 }}
            size="lg"
          />
        </View>
      )}

      <MatchModal
        visible={!!matchUser}
        matchedUser={matchUser}
        onClose={() => setMatchUser(null)}
      />

      <Modal
        visible={reportPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setReportPromptVisible(false);
          setReportValidationVisible(false);
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.34)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', lineHeight: 27 }}>
              Reason reporting {profile.full_name}
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: '#555555' }}>
              Select one reason before submitting your report.
            </Text>
            <View style={{ marginTop: 18, gap: 10 }}>
              {REPORT_REASONS.map((reason) => {
                const selected = selectedReportReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedReportReason(reason);
                      setReportValidationVisible(false);
                    }}
                    style={{
                      minHeight: 50,
                      borderRadius: 16,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      backgroundColor: selected ? '#FFF5F1' : '#FFFFFF',
                      borderWidth: 1,
                      borderColor: selected ? COLORS.primary : '#E7E1DC',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>{reason}</Text>
                    {selected ? <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            {reportValidationVisible ? (
              <View style={{ marginTop: 12, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF7E8' }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#A06A00' }}>Select a reason</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  setReportPromptVisible(false);
                  setReportValidationVisible(false);
                }}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E7E1DC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void submitReport()}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#111111',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Ionicons name="flag-outline" size={17} color="#FFFFFF" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={blockPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBlockPromptVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.34)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#111111', lineHeight: 27 }}>
              Block user
            </Text>
            <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 22, color: '#555555' }}>
              Block {profile.full_name}?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setBlockPromptVisible(false)}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: '#E7E1DC',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#111111' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => void confirmBlockUser()}
                style={{
                  flex: 1,
                  minHeight: 50,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#111111',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF' }}>Block</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────

function formatLastSeen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  < 7)   return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const INTERESTED_IN_LABEL: Record<string, string> = { men: 'Men', women: 'Women', everyone: 'Everyone' };

function buildDetailRows(
  p: User,
  religionLabel: string | null,
  educationLabel: string | null,
  maritalLabel: string | null,
) {
  const rows: { icon: string; label: string; value: string }[] = [];
  rows.push({ icon: 'person-outline',    label: 'Gender',       value: GENDER_LABEL[p.gender] ?? p.gender });
  if (p.age)          rows.push({ icon: 'calendar-outline',  label: 'Age',          value: `${p.age} years old` });
  if (maritalLabel)   rows.push({ icon: 'heart-outline',     label: 'Status',       value: maritalLabel });
  if (p.height_cm)    rows.push({ icon: 'resize-outline',    label: 'Height',       value: `${p.height_cm} cm` });
  if (religionLabel)  rows.push({ icon: 'sunny-outline',     label: 'Religion',     value: religionLabel });
  if (educationLabel) rows.push({ icon: 'school-outline',    label: 'Education',    value: educationLabel });
  if (p.occupation)   rows.push({ icon: 'briefcase-outline', label: 'Work',         value: p.occupation });
  if (p.ethnicity)    rows.push({ icon: 'globe-outline',     label: 'Ethnicity',    value: p.ethnicity });
  if (p.has_children != null)
    rows.push({ icon: 'people-outline',  label: 'Children',    value: p.has_children ? 'Has children' : 'No children' });
  if (p.want_children) {
    const wantLabel = WANT_CHILDREN_OPTIONS.find((o) => o.value === p.want_children)?.label ?? p.want_children;
    rows.push({ icon: 'happy-outline',   label: 'Wants children', value: wantLabel });
  }
  if (p.interested_in)
    rows.push({ icon: 'search-outline',  label: 'Interested in', value: INTERESTED_IN_LABEL[p.interested_in] ?? p.interested_in });
  return rows;
}

const detailSectionLabel: import('react-native').TextStyle = {
  fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
  textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 14,
};
const detailRow: import('react-native').ViewStyle = {
  flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8,
  borderBottomWidth: 1, borderBottomColor: COLORS.border,
};
const detailIconBox: import('react-native').ViewStyle = {
  width: 34, height: 34, borderRadius: 10,
  backgroundColor: `${COLORS.primary}12`,
  alignItems: 'center', justifyContent: 'center',
};
const detailLabel: import('react-native').TextStyle = {
  fontSize: 11, color: COLORS.textMuted, textTransform: 'capitalize',
};
const detailValue: import('react-native').TextStyle = {
  fontSize: 14, color: COLORS.text, fontWeight: '600', textTransform: 'capitalize', marginTop: 1,
};
