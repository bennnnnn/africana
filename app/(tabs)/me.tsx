import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import { COLORS, DEFAULT_AVATAR, LOOKING_FOR_OPTIONS, RELIGION_OPTIONS, EDUCATION_OPTIONS, MARITAL_STATUS_OPTIONS, WANT_CHILDREN_OPTIONS } from '@/constants';

const { width } = Dimensions.get('window');

function EditBtn({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.editBtn}>
      <Ionicons name="pencil" size={13} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

export default function MyProfileScreen() {
  const { user } = useAuthStore();
  const [likeCount, setLikeCount]   = useState<number | null>(null);
  const [viewCount, setViewCount]   = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('likes').select('*', { count: 'exact', head: true })
      .eq('to_user_id', user.id).then(({ count }) => setLikeCount(count ?? 0));
    supabase.from('profile_views').select('*', { count: 'exact', head: true })
      .eq('viewed_id', user.id).then(({ count }) => setViewCount(count ?? 0));
  }, [user?.id]);

  if (!user) return null;

  const goEdit = () => router.push('/(profile)/edit');

  const avatar = user.avatar_url || (user.profile_photos ?? [])[0]
    || `${DEFAULT_AVATAR}${encodeURIComponent((user.full_name ?? '?').charAt(0))}`;
  const location = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const today = new Date();
  const bday  = user.birthdate ? new Date(user.birthdate) : null;
  const age   = bday
    ? today.getFullYear() - bday.getFullYear()
      - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0)
    : null;
  const photoCount = (user.profile_photos ?? []).length;
  const isOnline   = user.online_status === 'online';

  const lookingForLabels = (user.looking_for ?? []).map(
    (lf) => LOOKING_FOR_OPTIONS.find((o) => o.value === lf)?.label ?? lf,
  );

  // Human-readable label helpers
  const religionLabel    = user.religion    ? (RELIGION_OPTIONS.find(o => o.value === user.religion)?.label    ?? user.religion)    : null;
  const educationLabel   = user.education   ? (EDUCATION_OPTIONS.find(o => o.value === user.education)?.label  ?? user.education)   : null;
  const maritalLabel     = user.marital_status ? (MARITAL_STATUS_OPTIONS.find(o => o.value === user.marital_status)?.label ?? user.marital_status) : null;
  const wantChildrenLabel = user.want_children ? (WANT_CHILDREN_OPTIONS.find(o => o.value === user.want_children)?.label ?? user.want_children) : null;

  // Profile completion
  const completionFields = [
    { label: 'Profile photo', done: photoCount > 0 },
    { label: 'Bio',           done: !!user.bio },
    { label: 'Religion',      done: !!user.religion },
    { label: 'Education',     done: !!user.education },
    { label: 'Occupation',    done: !!user.occupation },
    { label: 'Height',        done: !!user.height_cm },
    { label: 'Ethnicity',     done: !!user.ethnicity },
    { label: 'Languages',     done: (user.languages ?? []).length > 0 },
  ];
  const completionPct  = Math.round(completionFields.filter((f) => f.done).length / completionFields.length * 100);
  const nextMissing    = completionFields.find((f) => !f.done);

  // Detail rows — only show fields that have values
  const details: { icon: string; label: string; value: string | null }[] = [
    { icon: 'person-outline',      label: 'Gender',         value: user.gender ? (user.gender === 'male' ? 'Man' : 'Woman') : null },
    { icon: 'calendar-outline',    label: 'Age',            value: age ? `${age} years old` : null },
    { icon: 'location-outline',    label: 'Location',       value: location || null },
    { icon: 'book-outline',        label: 'Religion',       value: religionLabel },
    { icon: 'school-outline',      label: 'Education',      value: educationLabel },
    { icon: 'briefcase-outline',   label: 'Occupation',     value: user.occupation ?? null },
    { icon: 'resize-outline',      label: 'Height',         value: user.height_cm ? `${user.height_cm} cm` : null },
    { icon: 'people-outline',      label: 'Ethnicity',      value: user.ethnicity ?? null },
    { icon: 'chatbubbles-outline', label: 'Languages',      value: (user.languages ?? []).join(', ') || null },
    { icon: 'heart-outline',       label: 'Looking for',    value: lookingForLabels.join(', ') || null },
    { icon: 'person-add-outline',  label: 'Marital status', value: maritalLabel },
    { icon: 'happy-outline',       label: 'Want children',  value: wantChildrenLabel },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={() => router.push('/(settings)/main')} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* ── Hero photo ── */}
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: avatar }} style={{ width, height: width * 1.05 }} contentFit="cover" />
          <View style={s.heroGradient} />

          {/* Online badge */}
          <View style={[s.onlineBadge, { backgroundColor: isOnline ? COLORS.online : COLORS.offline }]}>
            <View style={s.onlineDot} />
            <Text style={s.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>

          {/* Camera button to update photos */}
          <TouchableOpacity style={s.cameraBtn} onPress={goEdit}>
            <Ionicons name="camera" size={18} color="#FFF" />
          </TouchableOpacity>

          {/* Name / location */}
          <View style={s.heroInfo}>
            <Text style={s.heroName}>{user.full_name}{age ? `, ${age}` : ''}</Text>
            {location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.85)" />
                <Text style={s.heroLocation}>{location}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Stats bar ── */}
        <View style={s.statsBar}>
          {[
            { label: 'Photos', value: photoCount,       icon: 'images-outline'  as const },
            { label: 'Likes',  value: likeCount ?? '…', icon: 'heart-outline'   as const },
            { label: 'Views',  value: viewCount ?? '…', icon: 'eye-outline'     as const },
          ].map((stat, i) => (
            <View key={i} style={[s.statItem, i < 2 && { borderRightWidth: 1, borderRightColor: COLORS.border }]}>
              <Ionicons name={stat.icon} size={17} color={COLORS.primary} />
              <Text style={s.statValue}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Completion nudge ── */}
        {completionPct < 100 && (
          <TouchableOpacity style={s.completion} onPress={goEdit} activeOpacity={0.85}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>
                Profile {completionPct}% complete
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.primary, fontWeight: '600' }}>Complete →</Text>
            </View>
            <View style={{ height: 6, backgroundColor: `${COLORS.primary}20`, borderRadius: 3 }}>
              <View style={{ height: 6, backgroundColor: COLORS.primary, borderRadius: 3, width: `${completionPct}%` }} />
            </View>
            {nextMissing && (
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8 }}>
                Add your <Text style={{ fontWeight: '700', color: COLORS.primary }}>{nextMissing.label}</Text> to get more matches
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* ── About Me ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>About Me</Text>
            <EditBtn onPress={goEdit} />
          </View>
          {user.bio ? (
            <Text style={s.bioText}>{user.bio}</Text>
          ) : (
            <TouchableOpacity onPress={goEdit} style={s.emptyPrompt}>
              <Ionicons name="pencil-outline" size={15} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>
                Add a bio — it helps you stand out
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Details ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Details</Text>
            <EditBtn onPress={goEdit} />
          </View>
          <View style={{ gap: 14 }}>
            {details.map((row, i) =>
              row.value ? (
                <View key={i} style={s.detailRow}>
                  <View style={s.detailIcon}>
                    <Ionicons name={row.icon} size={15} color={COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.detailLabel}>{row.label}</Text>
                    <Text style={s.detailValue}>{row.value}</Text>
                  </View>
                </View>
              ) : null
            )}
            {/* Empty state if nothing filled */}
            {details.every((d) => !d.value) && (
              <TouchableOpacity onPress={goEdit} style={s.emptyPrompt}>
                <Ionicons name="pencil-outline" size={15} color={COLORS.primary} />
                <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>Add your details</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Photos ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Photos</Text>
            <EditBtn onPress={goEdit} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(user.profile_photos ?? []).slice(0, 6).map((photo, i) => (
              <Image
                key={i}
                source={{ uri: photo }}
                style={{ width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 12 }}
                contentFit="cover"
              />
            ))}
            {/* Add photo tile */}
            <TouchableOpacity
              onPress={goEdit}
              style={[
                { width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 12 },
                s.addPhotoTile,
              ]}
            >
              <Ionicons name="add" size={28} color={COLORS.primary} />
              <Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>Add photo</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.savanna,
    alignItems: 'center', justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: '50%', backgroundColor: 'rgba(0,0,0,0.38)',
  },
  onlineBadge: {
    position: 'absolute', top: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, opacity: 0.92,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#FFF' },
  onlineText: { fontSize: 12, color: '#FFF', fontWeight: '600' },
  cameraBtn: {
    position: 'absolute', bottom: 60, right: 14,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  heroInfo: { position: 'absolute', bottom: 16, left: 16, right: 60 },
  heroName: {
    fontSize: 26, fontWeight: '800', color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  heroLocation: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  statsBar: {
    flexDirection: 'row', backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statValue: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  statLabel: { fontSize: 11, color: COLORS.textSecondary },
  completion: {
    margin: 12, marginBottom: 8, padding: 16, borderRadius: 16,
    backgroundColor: `${COLORS.primary}10`,
    borderWidth: 1.5, borderColor: `${COLORS.primary}30`,
  },
  section: {
    backgroundColor: '#FFF', marginBottom: 8, padding: 18,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  editBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  bioText: { fontSize: 15, color: COLORS.text, lineHeight: 23 },
  emptyPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 14,
    borderRadius: 10, borderWidth: 1.5,
    borderStyle: 'dashed', borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}08`,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: `${COLORS.primary}12`,
    alignItems: 'center', justifyContent: 'center',
  },
  detailLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: '600', textTransform: 'capitalize', marginTop: 1 },
  addPhotoTile: {
    backgroundColor: `${COLORS.primary}08`,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
