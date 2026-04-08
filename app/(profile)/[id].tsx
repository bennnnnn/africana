import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
  Animated,
  StyleSheet,
  Dimensions,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
import { COLORS, DEFAULT_AVATAR, GENDER_OPTIONS, INTERESTED_IN_OPTIONS, RELIGION_OPTIONS, EDUCATION_OPTIONS, MARITAL_STATUS_OPTIONS, LOOKING_FOR_OPTIONS, WANT_CHILDREN_YES_NO, OCCUPATION_OPTIONS, PHYSICAL_CONDITION_OPTIONS } from '@/constants';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { MatchModal } from '@/components/ui/MatchModal';
import { calculateAge, getEffectiveAgePreferenceRange } from '@/lib/utils';

const { width } = Dimensions.get('window');

const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female' };
const REPORT_REASONS = ['Fake profile', 'Scam', 'Harassment', 'Nudity', 'Underage', 'Other'] as const;

function ReadOnlyRow({ icon, label, value }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: string | null | undefined;
}) {
  const filled = !!value;
  return (
    <View style={pr.fieldRow}>
      <View style={[pr.fieldIcon, !filled && pr.fieldIconEmpty]}>
        <Ionicons name={icon} size={15} color={filled ? '#111' : '#CCC'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={pr.fieldLabel}>{label}</Text>
        <Text style={[pr.fieldValue, !filled && pr.fieldValueEmpty]}>
          {value ?? '—'}
        </Text>
      </View>
    </View>
  );
}

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
  const [isFavourite, setIsFavourite] = useState(false);
  const [compatibilityExpanded, setCompatibilityExpanded] = useState(false);
  const [reportPromptVisible, setReportPromptVisible] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<typeof REPORT_REASONS[number] | null>(null);
  const [reportValidationVisible, setReportValidationVisible] = useState(false);
  const [blockPromptVisible, setBlockPromptVisible] = useState(false);

  // Toast
  const toastAnim = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState<{ icon: string; msg: string } | null>(null);
  const showToast = (icon: string, msg: string) => {
    setToast({ icon, msg });
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  };

  useEffect(() => {
    setCompatibilityExpanded(false);
    setIsFavourite(false);
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

  useEffect(() => {
    if (!currentUser || !profile || currentUser.id === profile.id) return;
    supabase
      .from('favourites')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('favourited_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setIsFavourite(!!data));
  }, [currentUser?.id, profile?.id]);

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

  const religionLabel    = profile.religion       ? RELIGION_OPTIONS.find(r => r.value === profile.religion)?.label            ?? profile.religion       : null;
  const educationLabel   = profile.education      ? EDUCATION_OPTIONS.find(e => e.value === profile.education)?.label           ?? profile.education      : null;
  const maritalLabel     = profile.marital_status ? MARITAL_STATUS_OPTIONS.find(m => m.value === profile.marital_status)?.label ?? profile.marital_status : null;
  const wantChildLabel    = profile.want_children  ? WANT_CHILDREN_YES_NO.find(o => o.value === profile.want_children)?.label   ?? profile.want_children  : null;
  const bodyTypeLabel    = profile.body_type      ? PHYSICAL_CONDITION_OPTIONS.find(o => o.value === profile.body_type)?.label ?? profile.body_type : null;
  const occupationLabel   = profile.occupation     ? OCCUPATION_OPTIONS.find(o => o.value === profile.occupation)?.label ?? profile.occupation    : null;
  const interestedInLabel = INTERESTED_IN_OPTIONS.find(o => o.value === profile.interested_in)?.label ?? null;

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

  const LOOKING_SINGLE: Record<string, string> = { men: 'Male', women: 'Female' };
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
    ? WANT_CHILDREN_YES_NO.find((option) => option.value === currentUser.want_children)?.label ?? currentUser.want_children
    : null;
  const wantLabelRow = p.want_children
    ? WANT_CHILDREN_YES_NO.find((o) => o.value === p.want_children)?.label ?? p.want_children
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
      showToast('🔥', 'It’s a match!');
    } else {
      showToast(wasLiked ? '💔' : '❤️', wasLiked ? 'Unliked' : 'Liked!');
    }
  };

  const handleMessage = async () => {
    if (!currentUser) return;
    const convId = await getOrCreateConversation(currentUser.id, profile.id);
    if (convId) router.push(`/(chat)/${convId}`);
  };

  const handleFavourite = async () => {
    if (!currentUser) return;
    if (isFavourite) {
      await supabase
        .from('favourites')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('favourited_id', profile.id);
      setIsFavourite(false);
      showToast('⭐', 'Removed from favourites');
    } else {
      await supabase
        .from('favourites')
        .insert({ user_id: currentUser.id, favourited_id: profile.id });
      setIsFavourite(true);
      showToast('⭐', 'Added to favourites');
    }
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
    showToast('🚫', `${profile.full_name} blocked`);
    setTimeout(() => router.back(), 1300);
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
    showToast('🚩', 'Report submitted. Thank you.');
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Toast */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute', zIndex: 999,
            top: 80, alignSelf: 'center',
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: 'rgba(17,17,17,0.88)',
            paddingHorizontal: 18, paddingVertical: 11, borderRadius: 30,
            opacity: toastAnim,
            transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          }}
        >
          <Text style={{ fontSize: 18 }}>{toast.icon}</Text>
          <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{toast.msg}</Text>
        </Animated.View>
      )}
      <ScrollView showsVerticalScrollIndicator={false} bounces>
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
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.12)', 'rgba(0,0,0,0.60)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%' }}
          />

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

        {/* Info card */}
        <View style={pr.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#111' }}>
              {profile.full_name}{profile.age ? `, ${profile.age}` : ''}
            </Text>
            <View style={[
              pr.onlineBadge,
              { backgroundColor: profile.online_status === 'online' ? `${COLORS.online}18` : `${COLORS.border}` },
            ]}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: profile.online_status === 'online' ? COLORS.online : COLORS.textMuted }} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: profile.online_status === 'online' ? COLORS.online : COLORS.textSecondary }}>
                {profile.online_status === 'online' ? 'Online' : `Last seen ${formatLastSeen(profile.last_seen)}`}
              </Text>
            </View>
          </View>

          {location ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Ionicons name="location-outline" size={14} color="#111" />
              <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>{location}</Text>
            </View>
          ) : null}

          {profile.looking_for.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {profile.looking_for.map((lf) => (
                <View key={lf} style={pr.badge}>
                  <Text style={pr.badgeText}>{LOOKING_FOR_OPTIONS.find(o => o.value === lf)?.label ?? lf.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          )}

          {profile.bio ? (
            <View style={{ marginTop: 14 }}>
              <Text style={pr.sectionTitle}>About</Text>
              <Text style={{ fontSize: 15, color: '#111', lineHeight: 23 }}>{profile.bio}</Text>
            </View>
          ) : null}
        </View>

        {/* Personal — ReadOnlyRow auto-hides null fields */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>Personal</Text>
          <ReadOnlyRow icon="person-outline"      label="Gender"         value={GENDER_LABEL[profile.gender] ?? profile.gender} />
          <ReadOnlyRow icon="calendar-outline"    label="Age"            value={profile.age ? `${profile.age} years old` : null} />
          <ReadOnlyRow icon="search-outline"      label="Interested in"  value={interestedInLabel} />
          <ReadOnlyRow icon="location-outline"    label="Lives in"       value={location || null} />
          <ReadOnlyRow icon="heart-outline"       label="Marital status" value={maritalLabel} />
          <ReadOnlyRow icon="sunny-outline"       label="Religion"       value={religionLabel} />
          <ReadOnlyRow icon="globe-outline"       label="Ethnicity"      value={profile.ethnicity ?? null} />
          <ReadOnlyRow icon="chatbubbles-outline" label="Languages"      value={(profile.languages ?? []).join(', ') || null} />
        </View>

        {/* Physical */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>Physical</Text>
          <ReadOnlyRow icon="resize-outline" label="Height"    value={profile.height_cm ? `${(profile.height_cm / 100).toFixed(2)} m` : null} />
          <ReadOnlyRow icon="body-outline"   label="Body type" value={bodyTypeLabel} />
        </View>

        {/* Work & Education */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>Work & Education</Text>
          <ReadOnlyRow icon="briefcase-outline" label="Occupation" value={occupationLabel} />
          <ReadOnlyRow icon="school-outline"    label="Education"  value={educationLabel} />
        </View>

        {/* Family */}
        <View style={pr.section}>
          <Text style={pr.sectionTitle}>Family</Text>
          <ReadOnlyRow icon="people-outline" label="Children"      value={profile.has_children == null ? null : profile.has_children ? 'Has children' : 'No children'} />
          <ReadOnlyRow icon="happy-outline"  label="Wants children" value={wantChildLabel} />
        </View>

        {/* Hobbies */}
        {(profile.hobbies ?? []).length > 0 && (
          <View style={pr.section}>
            <Text style={pr.sectionTitle}>Hobbies & Interests</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {(profile.hobbies ?? []).map(h => (
                <View key={h} style={pr.badge}><Text style={pr.badgeText}>{h}</Text></View>
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
            onPress={handleFavourite}
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              borderWidth: 1.5,
              borderColor: isFavourite ? COLORS.primary : COLORS.border,
              backgroundColor: isFavourite ? `${COLORS.primary}12` : '#FFF',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={isFavourite ? 'star' : 'star-outline'} size={24} color={isFavourite ? COLORS.primary : COLORS.textSecondary} />
          </TouchableOpacity>
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

const pr = StyleSheet.create({
  section:        { backgroundColor: '#FFF', marginBottom: 8, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 },
  sectionTitle:   { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' },
  onlineBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badge:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F0F0', borderWidth: 1, borderColor: '#DDD' },
  badgeText:      { fontSize: 13, color: '#111', fontWeight: '600' },
  fieldRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fieldIcon:      { width: 32, height: 32, borderRadius: 9, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  fieldIconEmpty: { backgroundColor: '#FAFAFA' },
  fieldLabel:     { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500', marginBottom: 1 },
  fieldValue:     { fontSize: 14, color: '#111', fontWeight: '600' },
  fieldValueEmpty:{ fontSize: 14, color: '#CCC', fontWeight: '400', fontStyle: 'italic' },
});
