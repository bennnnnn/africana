import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, Pressable, ActivityIndicator,
  Dimensions, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { uploadToAvatarsBucket } from '@/lib/storage-image-upload';
import { useAuthStore } from '@/store/auth.store';
import {
  COLORS, RADIUS, FONT, DEFAULT_AVATAR, MAX_PROFILE_PHOTOS,
  GENDER_OPTIONS, INTERESTED_IN_OPTIONS,
  LOOKING_FOR_OPTIONS, RELIGION_OPTIONS, EDUCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS, WANT_CHILDREN_YES_NO, PHYSICAL_CONDITION_OPTIONS,
  OCCUPATION_OPTIONS, HAS_CHILDREN_OPTIONS,
} from '@/constants';
import { SliderPicker } from '@/components/ui/SliderPicker';
import { DatePicker } from '@/components/ui/DatePicker';
import { LocationPicker, LocationValue } from '@/components/ui/LocationPicker';
import * as ImagePicker from 'expo-image-picker';
import { getEthnicityOptions, getLanguageOptions } from '@/lib/cultural-data';
import { getCountryByName, AFRICAN_COUNTRY_CODES } from '@/lib/country-data';
import { getProfileStrength } from '@/lib/profile-completion';
import { oppositeInterestedIn } from '@/lib/gender-match';
import type { Gender } from '@/types';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { HeroPlaceholder } from '@/components/ui/HeroPlaceholder';
import { appDialog } from '@/lib/app-dialog';
import { validateFacesInPhotos, faceRejectionMessage } from '@/lib/face-detection';

const { width } = Dimensions.get('window');
// Self-profile hero height. Shorter than a typical portrait dating photo so
// the user can scan more of their profile (quick facts, completion chips)
// without scrolling, while staying tall enough that portrait uploads don't
// lose the face to a center crop.
const HERO_HEIGHT = width * 0.9;

const HOBBY_OPTIONS = [
  'Music', 'Reading', 'Travel', 'Cooking', 'Football', 'Dancing',
  'Fashion', 'Photography', 'Fitness', 'Movies', 'Nature', 'Art',
  'Gaming', 'Yoga', 'Swimming', 'Hiking', 'Cycling', 'Gardening',
  'Meditation', 'Writing', 'Business', 'Theology', 'Volunteering',
  'Poetry', 'History', 'Technology', 'Languages', 'Entrepreneurship',
];

// ── Edit modal shell ──────────────────────────────────────────────────────────
function EditModal({ visible, title, onClose, onSave, saving, children }: {
  visible: boolean; title: string; onClose: () => void;
  onSave: () => void; saving?: boolean; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.white }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={em.header}>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={COLORS.textStrong} /></TouchableOpacity>
            <Text style={em.title}>{title}</Text>
            <TouchableOpacity onPress={onSave} disabled={saving} style={em.saveBtn}>
              <Text style={em.saveTxt}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
function FieldRow({ icon, label, value, onEdit, readOnly }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  value: string | null | undefined; onEdit: () => void;
  readOnly?: boolean;
}) {
  const filled = !!value;
  const inner = (
    <>
      <View style={[s.fieldIcon, !filled && !readOnly && s.fieldIconEmpty]}>
        <Ionicons name={icon} size={15} color={filled || readOnly ? COLORS.textStrong : COLORS.emptyField} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={[s.fieldValue, !filled && !readOnly && s.fieldValueEmpty]}>
          {filled ? value : readOnly ? '—' : `Add ${label.toLowerCase()}`}
        </Text>
      </View>
      {readOnly ? (
        <Ionicons name="lock-closed-outline" size={14} color={COLORS.textMuted} />
      ) : (
        <Ionicons name={filled ? 'pencil' : 'add-circle-outline'} size={16} color={filled ? COLORS.textStrong : COLORS.emptyField} />
      )}
    </>
  );
  if (readOnly) {
    return <View style={[s.fieldRow, { opacity: 0.92 }]}>{inner}</View>;
  }
  return (
    <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={s.fieldRow}>
      {inner}
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MyProfileScreen() {
  const { user, updateProfile, fetchProfile } = useAuthStore();
  const scrollRef = useRef<ScrollView>(null);
  const heroPhotoScrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // Generic edit state
  const [editText, setEditText]     = useState('');
  const [editSelect, setEditSelect] = useState<string | null>(null);
  const [editMulti, setEditMulti]   = useState<string[]>([]);
  const [editBool, setEditBool]     = useState<boolean | null>(null);
  const [editHeight, setEditHeight] = useState(170);
  const [editWeight, setEditWeight] = useState(70);
  const [editDate, setEditDate]               = useState<Date | null>(null);
  const [editLocation, setEditLocation]       = useState<Partial<LocationValue>>({});
  const [editOriginLocation, setEditOriginLocation] = useState<Partial<LocationValue>>({});
  const [photoUploading, setPhotoUploading] = useState(false);
  const [heroPage, setHeroPage] = useState(0);

  // Cultural data for ethnicity + languages
  const [cultureEthnicityOpts, setCultureEthnicityOpts] = useState<string[]>([]);
  const [cultureLanguageOpts, setCultureLanguageOpts]   = useState<{ suggested: string[]; all: string[] }>({ suggested: [], all: [] });
  const [cultureLoading, setCultureLoading] = useState(false);

  // Search within long lists
  const [listSearch, setListSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void fetchProfile(user.id);
    }, [fetchProfile, user?.id]),
  );

  const avatarForHero = useMemo(() => {
    if (!user) return '';
    return (
      user.avatar_url ||
      (user.profile_photos ?? [])[0] ||
      `${DEFAULT_AVATAR}${encodeURIComponent((user.full_name ?? '?').charAt(0))}`
    );
  }, [user]);

  const heroPhotos = useMemo(() => {
    if (!user) return [] as string[];
    const list = (user.profile_photos ?? [])
      .filter((u) => typeof u === 'string' && u.trim().length > 0)
      .slice(0, MAX_PROFILE_PHOTOS);
    if (list.length > 0) return list;
    return avatarForHero ? [avatarForHero] : [];
  }, [user, avatarForHero]);

  const mainPhotoIndex = useMemo(() => {
    if (!user) return 0;
    const list = user.profile_photos ?? [];
    if (list.length === 0) return 0;
    if (user.avatar_url) {
      const i = list.indexOf(user.avatar_url);
      if (i >= 0) return i;
    }
    return 0;
  }, [user]);

  useEffect(() => {
    if (!user || heroPhotos.length === 0 || width <= 0) return;
    const idx = Math.min(mainPhotoIndex, heroPhotos.length - 1);
    setHeroPage(idx);
    requestAnimationFrame(() => {
      heroPhotoScrollRef.current?.scrollTo({ x: idx * width, y: 0, animated: false });
    });
  }, [user?.id, mainPhotoIndex, heroPhotos.length]);

  if (!user) return (
    <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="person-outline" size={32} color={COLORS.primary} />
      <Text style={{ marginTop: 12, fontSize: 14, color: COLORS.textSecondary }}>Loading profile…</Text>
    </SafeAreaView>
  );

  // ── Cultural data loader (mirrors onboarding logic) ────────────────────────
  const loadCultureData = async () => {
    const livingCountryData = getCountryByName(user.country ?? '');
    const livesInAfrica = livingCountryData ? AFRICAN_COUNTRY_CODES.has(livingCountryData.code) : false;

    let countryCode: string | undefined;
    let subdivision: string;
    let city: string;

    if (livesInAfrica) {
      countryCode = livingCountryData?.code;
      subdivision  = user.state  ?? '';
      city         = user.city   ?? '';
    } else {
      // Diaspora — try origin country first
      const originData = getCountryByName((user as any).origin_country ?? '');
      if (originData && AFRICAN_COUNTRY_CODES.has(originData.code)) {
        countryCode = originData.code;
        subdivision  = (user as any).origin_state ?? '';
        city         = (user as any).origin_city  ?? '';
      } else {
        countryCode = livingCountryData?.code;
        subdivision  = user.state ?? '';
        city         = user.city  ?? '';
      }
    }
    if (!countryCode) return;

    setCultureLoading(true);
    try {
      const [ethOpts, langOpts] = await Promise.all([
        getEthnicityOptions(countryCode, subdivision, city),
        getLanguageOptions(countryCode, user.ethnicity ?? null, subdivision, city),
      ]);
      setCultureEthnicityOpts(ethOpts?.all ?? []);
      setCultureLanguageOpts({ suggested: langOpts?.suggested ?? [], all: langOpts?.all ?? [] });
    } catch {}
    setCultureLoading(false);
  };

  // ── Open helpers ───────────────────────────────────────────────────────────
  const close = () => { setEditing(null); setListSearch(''); };

  const save = async (updates: Record<string, any>) => {
    setSaving(true);
    try { await updateProfile(updates); close(); }
    catch (e: any) {
      appDialog({ title: 'Could not save', message: e?.message ?? 'Please try again.', icon: 'alert-circle-outline' });
    }
    finally { setSaving(false); }
  };

  const openText   = (k: string, v: string | null)   => { setEditing(k); setEditText(v ?? ''); setListSearch(''); };
  const openSelect = (k: string, v: string | null | undefined)   => { setEditing(k); setEditSelect(v ?? null); setListSearch(''); };
  const openMulti  = (k: string, v: string[])        => { setEditing(k); setEditMulti([...v]); };
  const openBool   = (k: string, v: boolean | null)  => { setEditing(k); setEditBool(v); };

  const openDate = () => {
    setEditing('birthdate');
    setEditDate(user.birthdate ? new Date(user.birthdate) : null);
  };

  const openLocation = () => {
    const countryData = getCountryByName(user.country ?? '');
    setEditing('location');
    setEditLocation({
      country: user.country ?? '',
      countryCode: countryData?.code ?? '',
      subdivision: user.state ?? '',
      city: user.city ?? '',
    });
  };

  const openOriginLocation = () => {
    const countryData = getCountryByName(user.origin_country ?? '');
    setEditing('origin_location');
    setEditOriginLocation({
      country: user.origin_country ?? '',
      countryCode: countryData?.code ?? '',
      subdivision: user.origin_state ?? '',
      city: user.origin_city ?? '',
    });
  };

  const confirmRemovePhoto = (photoUrl: string) => {
    appDialog({
      title: 'Remove photo',
      message: 'Remove this photo from your profile?',
      icon: 'trash-outline',
      actions: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const current = user.profile_photos ?? [];
            const updated = current.filter((p) => p !== photoUrl);
            try {
              await updateProfile({
                profile_photos: updated,
                avatar_url: updated[0] ?? null,
              });
            } catch (e: unknown) {
              appDialog({
                title: 'Could not remove photo',
                message: e instanceof Error ? e.message : 'Try again.',
                icon: 'alert-circle-outline',
              });
            }
          },
        },
      ],
    });
  };

  const pickAndUploadPhoto = async () => {
    const currentPhotos = user.profile_photos ?? [];
    const remaining = MAX_PROFILE_PHOTOS - currentPhotos.length;
    if (remaining <= 0) {
      appDialog({
        title: 'Photo limit',
        message: `You can have up to ${MAX_PROFILE_PHOTOS} photos. Long press a photo below to remove one.`,
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (result.canceled || result.assets.length === 0) return;
    setPhotoUploading(true);
    try {
      const picked = result.assets.slice(0, remaining);
      const { approved, rejected } = await validateFacesInPhotos(picked.map((a) => a.uri));
      if (rejected.length > 0) {
        const { title, message } = faceRejectionMessage(rejected.length, approved.length);
        appDialog({ title, message, icon: 'happy-outline' });
      }
      const toUpload = picked.filter((a) => approved.includes(a.uri));
      if (toUpload.length === 0) {
        setPhotoUploading(false);
        return;
      }

      const uploaded: string[] = [];
      for (const asset of toUpload) {
        const out = await uploadToAvatarsBucket(user.id, asset.uri, asset.mimeType);
        if (!('error' in out)) uploaded.push(out.publicUrl);
      }
      if (uploaded.length === 0) throw new Error('Could not upload photos.');
      const updatedPhotos = [...currentPhotos, ...uploaded];
      await updateProfile({
        profile_photos: updatedPhotos,
        avatar_url: currentPhotos.length === 0 ? updatedPhotos[0] : user.avatar_url,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Please try again.';
      appDialog({ title: 'Upload failed', message: msg, icon: 'cloud-offline-outline' });
    } finally {
      setPhotoUploading(false);
    }
  };

  const openEthnicity = async () => {
    setEditing('ethnicity'); setEditText(user.ethnicity ?? ''); setListSearch('');
    await loadCultureData();
  };
  const openLanguages = async () => {
    setEditing('languages'); setEditMulti([...(user.languages ?? [])]); setListSearch('');
    await loadCultureData();
  };

  // ── Display values ─────────────────────────────────────────────────────────
  const avatar = avatarForHero;
  const photos   = user.profile_photos ?? [];
  const location = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const today    = new Date();
  const bday     = user.birthdate ? new Date(user.birthdate) : null;
  const age      = bday ? today.getFullYear() - bday.getFullYear()
    - (today < new Date(today.getFullYear(), bday.getMonth(), bday.getDate()) ? 1 : 0) : null;
  const isOnline = user.online_status === 'online';

  const religionLabel     = user.religion       ? RELIGION_OPTIONS.find(o => o.value === user.religion)?.label            ?? user.religion       : null;
  const educationLabel    = user.education      ? EDUCATION_OPTIONS.find(o => o.value === user.education)?.label           ?? user.education      : null;
  const maritalLabel      = user.marital_status ? MARITAL_STATUS_OPTIONS.find(o => o.value === user.marital_status)?.label ?? user.marital_status : null;
  const wantChildrenLabel = user.want_children  ? WANT_CHILDREN_YES_NO.find(o => o.value === user.want_children)?.label   ?? user.want_children  : null;
  const bodyTypeLabel     = user.body_type      ? PHYSICAL_CONDITION_OPTIONS.find(o => o.value === user.body_type)?.label ?? user.body_type : null;
  const occupationLabel   = user.occupation     ? OCCUPATION_OPTIONS.find(o => o.value === user.occupation)?.label ?? user.occupation  : null;
  const interestedInLabel =
    user.gender === 'male' || user.gender === 'female'
      ? INTERESTED_IN_OPTIONS.find((o) => o.value === user.interested_in)?.label ?? null
      : null;
  const locationDisplay    = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const originDisplay      = [user.origin_city, user.origin_state, user.origin_country].filter(Boolean).join(', ');

  // Detect if diaspora user has no origin set (needed for ethnicity/language data)
  const livesInAfrica      = user.country ? AFRICAN_COUNTRY_CODES.has(getCountryByName(user.country)?.code ?? '') : false;
  const hasAfricanOrigin   = !!user.origin_country && AFRICAN_COUNTRY_CODES.has(getCountryByName(user.origin_country)?.code ?? '');
  const needsOriginForData = !livesInAfrica && !hasAfricanOrigin;

  const strength = getProfileStrength(user);
  const completionPct = strength.percent;
  const nextMissing = strength.nextMissing;

  const scrollToSection = (id: string) => {
    const y = sectionY.current[id];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
  };

  /** Map a `getProfileStrength` item key onto the on-screen section anchor. */
  const sectionForMissingKey = (key: string | undefined): string => {
    switch (key) {
      case 'photo': return 'photos';
      case 'bio': return 'about';
      case 'religion':
      case 'ethnicity':
      case 'languages': return 'personal';
      case 'education':
      case 'occupation': return 'work';
      case 'height': return 'physical';
      case 'hobbies': return 'hobbies';
      default: return 'about';
    }
  };

  // ── Reusable select list renderer ─────────────────────────────────────────
  const renderSelectList = (
    options: { value: string; label: string; emoji?: string }[],
    current: string | null,
    onPick: (v: string | null) => void,
    withSearch = false,
  ) => {
    const filtered = withSearch && listSearch.trim()
      ? options.filter(o => o.label.toLowerCase().includes(listSearch.toLowerCase()))
      : options;
    return (
      <View>
        {withSearch && (
          <View style={em.searchRow}>
            <Ionicons name="search-outline" size={16} color="#999" />
            <TextInput value={listSearch} onChangeText={setListSearch}
              placeholder="Search..." placeholderTextColor="#BBB"
              style={{ flex: 1, fontSize: 14, color: '#111', marginLeft: 8 }} autoCorrect={false} />
          </View>
        )}
        <View style={{ gap: 8 }}>
          {filtered.map(opt => {
            const on = current === opt.value;
            return (
              <Pressable key={opt.value} onPress={() => onPick(on ? null : opt.value)}
                style={[em.option, on && em.optionOn]}>
                {opt.emoji ? <Text style={{ fontSize: 18, marginRight: 10 }}>{opt.emoji}</Text> : null}
                <Text style={[em.optionTxt, on && em.optionTxtOn]}>{opt.label}</Text>
                {on && <Ionicons name="checkmark-circle" size={18} color={COLORS.success} style={{ marginLeft: 'auto' }} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      {/* Header — fixed, does not scroll */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <ScreenTitle>My Profile</ScreenTitle>
          {completionPct < 100 && (
            <TouchableOpacity
              onPress={() => scrollToSection(sectionForMissingKey(nextMissing?.key))}
              style={s.completionPill}
              activeOpacity={0.75}
            >
              <Text style={s.completionPillTxt}>{completionPct}%</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/(settings)/main')} style={s.iconBtn}>
          <Ionicons name="settings-outline" size={20} color={COLORS.textStrong} />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >

        {/* Hero — swipe horizontally (ScrollView avoids FlatList-inside-ScrollView crash) */}
        {/* Neutral warm bg (not pure black) prevents the "dark flash" while the first
            image is still decoding on navigation. */}
        <View style={{ position: 'relative', backgroundColor: COLORS.savanna }}>
          {heroPhotos.length > 0 ? (
            <ScrollView
              ref={heroPhotoScrollRef}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={200}
              onScroll={(e) => {
                const p = Math.round(e.nativeEvent.contentOffset.x / width);
                setHeroPage(p);
              }}
              style={{ width, height: HERO_HEIGHT }}
            >
              {heroPhotos.map((uri, i) => (
                <Image
                  key={`${uri}-${i}`}
                  source={{ uri }}
                  style={{ width, height: HERO_HEIGHT }}
                  contentFit="cover"
                  contentPosition="center"
                  transition={220}
                  cachePolicy="memory-disk"
                  recyclingKey={uri}
                />
              ))}
            </ScrollView>
          ) : (
            <HeroPlaceholder
              name={user.full_name}
              width={width}
              height={HERO_HEIGHT}
              hint="Tap the camera to add a photo"
              showCamera
            />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.28)']}
            pointerEvents="none"
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%' }} />
          {/* Swipe dots — only when more than one photo */}
          {heroPhotos.length > 1 && (
            <View style={s.dotRow} pointerEvents="none">
              {heroPhotos.map((_, i) => (
                <View key={i} style={[s.dot, i === heroPage && s.dotActive]} />
              ))}
            </View>
          )}
          <View style={[s.onlineBadge, { backgroundColor: isOnline ? COLORS.online : 'rgba(0,0,0,0.45)' }]}>
            <View style={s.onlineDot} /><Text style={s.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          {photos.length < MAX_PROFILE_PHOTOS ? (
            <TouchableOpacity style={s.cameraBtn} onPress={pickAndUploadPhoto} disabled={photoUploading}>
              <Ionicons name={photoUploading ? 'hourglass-outline' : 'camera'} size={18} color="#FFF" />
            </TouchableOpacity>
          ) : null}
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

        {/* Photo strip — tap a thumbnail to set it as main; horizontal scroll when many photos */}
        {photos.length > 1 && (
          <View>
            <Text style={{ fontSize: 12, fontWeight: FONT.medium, color: COLORS.textSecondary, textAlign: 'center', paddingTop: 10, paddingBottom: 4 }}>
              Tap a photo to set it as your main picture
            </Text>
            <ScrollView
              horizontal
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator
              style={{
                backgroundColor: COLORS.white,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.border,
              }}
              contentContainerStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              {photos.map((photo, i) => {
                const isMain = photo === user.avatar_url || (i === 0 && !user.avatar_url);
                return (
                  <TouchableOpacity
                    key={`${photo}-${i}`}
                    onPress={() => save({ avatar_url: photo })}
                    style={[s.stripThumb, isMain && s.stripThumbActive]}
                    activeOpacity={0.8}
                  >
                    <Image source={{ uri: photo }} style={s.stripImg} contentFit="cover" />
                    {isMain && (
                      <View style={s.stripCheck}>
                        <Ionicons name="checkmark" size={10} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* About Me — directly under the hero, like a profile-eye-view */}
        <View
          onLayout={(e) => {
            sectionY.current.about = e.nativeEvent.layout.y;
          }}
        >
        <View style={[s.section, { paddingTop: 18 }]}>
          {user.bio ? (
            <TouchableOpacity onPress={() => openText('bio', user.bio)} activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={s.bioText}>{user.bio}</Text>
              <Ionicons name="pencil" size={15} color={COLORS.textStrong} style={{ marginTop: 3 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => openText('bio', '')} style={s.emptyPrompt}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>Add a bio — it helps you stand out</Text>
            </TouchableOpacity>
          )}
        </View>
        </View>

        {/* Inline completion nudge — only when there's a missing field */}
        {completionPct < 100 && nextMissing && (
          <TouchableOpacity
            onPress={() => scrollToSection(sectionForMissingKey(nextMissing.key))}
            style={s.completionInline}
            activeOpacity={0.85}
          >
            <View style={s.completionDot} />
            <Text style={s.completionInlineTxt}>
              Add your <Text style={{ fontWeight: FONT.extrabold }}>{nextMissing.label}</Text> to get more matches
            </Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Personal — identity basics: who you are, where you're from */}
        <View
          onLayout={(e) => {
            sectionY.current.personal = e.nativeEvent.layout.y;
          }}
        >
        <View style={s.section}>
          <Text style={s.sectionTitle}>Personal</Text>
          <FieldRow icon="person-outline"      label="Gender"         value={user.gender ? (GENDER_OPTIONS.find(o => o.value === user.gender)?.label ?? user.gender) : null} onEdit={() => openSelect('gender', user.gender)} />
          <FieldRow icon="calendar-outline"    label="Date of birth"  value={user.birthdate ?? null} onEdit={openDate} />
          <FieldRow icon="search-outline"      label="Interested in"  value={interestedInLabel} onEdit={() => openSelect('interested_in', user.interested_in)} />
          <FieldRow icon="location-outline"    label="Location"       value={locationDisplay || null} onEdit={openLocation} />
          {!livesInAfrica && (
            <FieldRow icon="flag-outline"      label="Origin"         value={originDisplay || null} onEdit={openOriginLocation} />
          )}
          <FieldRow icon="globe-outline"       label="Ethnicity"      value={user.ethnicity ?? null} onEdit={openEthnicity} />
          <FieldRow icon="chatbubbles-outline" label="Languages"      value={(user.languages ?? []).join(', ') || null} onEdit={openLanguages} />
          <FieldRow icon="sunny-outline"       label="Religion"       value={religionLabel} onEdit={() => openSelect('religion', user.religion)} />
        </View>
        </View>

        {/* Looking for — intent first, matches the way people read profiles */}
        <View
          onLayout={(e) => {
            sectionY.current.looking = e.nativeEvent.layout.y;
          }}
        >
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Looking for</Text>
            <TouchableOpacity onPress={() => openMulti('looking_for', user.looking_for ?? [])} style={s.sectionEditBtn}>
              <Ionicons name="pencil" size={13} color="#111" />
            </TouchableOpacity>
          </View>
          {(user.looking_for ?? []).length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
              {(user.looking_for ?? []).map(lf => (
                <View key={lf} style={s.badge}><Text style={s.badgeText}>{LOOKING_FOR_OPTIONS.find(o => o.value === lf)?.label ?? lf}</Text></View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={() => openMulti('looking_for', [])} style={s.emptyPrompt}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>Add what you're looking for</Text>
            </TouchableOpacity>
          )}
        </View>
        </View>

        {/* Physical — appearance specs */}
        <View
          onLayout={(e) => {
            sectionY.current.physical = e.nativeEvent.layout.y;
          }}
        >
        <View style={s.section}>
          <Text style={s.sectionTitle}>Physical</Text>
          <FieldRow icon="resize-outline"  label="Height"    value={user.height_cm ? `${(user.height_cm / 100).toFixed(2)} m` : null}
            onEdit={() => { setEditing('height'); setEditHeight(user.height_cm ?? 170); }} />
          <FieldRow icon="body-outline"    label="Body type" value={bodyTypeLabel} onEdit={() => openSelect('body_type', user.body_type)} />
          <FieldRow icon="barbell-outline" label="Weight"    value={user.weight_kg ? `${user.weight_kg} kg` : null} onEdit={() => { setEditing('weight_kg'); setEditWeight(user.weight_kg ?? 70); }} />
        </View>
        </View>

        {/* Family — life stage & future */}
        <View
          onLayout={(e) => {
            sectionY.current.family = e.nativeEvent.layout.y;
          }}
        >
        <View style={s.section}>
          <Text style={s.sectionTitle}>Family</Text>
          <FieldRow icon="heart-outline"  label="Marital status" value={maritalLabel} onEdit={() => openSelect('marital_status', user.marital_status)} />
          <FieldRow icon="people-outline" label="Has children"   value={user.has_children == null ? null : user.has_children ? 'Yes' : 'No'} onEdit={() => openBool('has_children', user.has_children)} />
          <FieldRow icon="happy-outline"  label="Wants children" value={wantChildrenLabel} onEdit={() => openSelect('want_children', user.want_children)} />
        </View>
        </View>

        {/* Work & Education */}
        <View
          onLayout={(e) => {
            sectionY.current.work = e.nativeEvent.layout.y;
          }}
        >
        <View style={s.section}>
          <Text style={s.sectionTitle}>Work & Education</Text>
          <FieldRow icon="briefcase-outline" label="Occupation" value={occupationLabel} onEdit={() => { openSelect('occupation', user.occupation); setListSearch(''); }} />
          <FieldRow icon="school-outline"    label="Education"  value={educationLabel}  onEdit={() => openSelect('education', user.education)} />
        </View>
        </View>

        {/* Hobbies */}
        <View
          onLayout={(e) => {
            sectionY.current.hobbies = e.nativeEvent.layout.y;
          }}
        >
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Hobbies & Interests</Text>
            <TouchableOpacity onPress={() => openMulti('hobbies', user.hobbies ?? [])} style={s.sectionEditBtn}>
              <Ionicons name="pencil" size={13} color="#111" />
            </TouchableOpacity>
          </View>
          {(user.hobbies ?? []).length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
              {(user.hobbies ?? []).map(h => (
                <View key={h} style={s.badge}><Text style={s.badgeText}>{h}</Text></View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={() => openMulti('hobbies', [])} style={s.emptyPrompt}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>Add your hobbies & interests</Text>
            </TouchableOpacity>
          )}
        </View>
        </View>

        {/* Photos */}
        <View
          onLayout={(e) => {
            sectionY.current.photos = e.nativeEvent.layout.y;
          }}
        >
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Photos</Text>
            {photos.length < MAX_PROFILE_PHOTOS ? (
              <TouchableOpacity onPress={pickAndUploadPhoto} style={s.sectionEditBtn}>
                <Ionicons name="add" size={13} color="#111" />
              </TouchableOpacity>
            ) : (
              <View style={s.sectionEditBtn} />
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
            {photos.slice(0, MAX_PROFILE_PHOTOS).map((photo, i) => {
              const tile = (width - 60) / 3;
              return (
                <Pressable
                  key={`${photo}-${i}`}
                  onLongPress={() => confirmRemovePhoto(photo)}
                  delayLongPress={450}
                  style={{ width: tile, height: tile, borderRadius: 12, overflow: 'hidden' }}
                >
                  <Image
                    source={{ uri: photo }}
                    style={{ width: tile, height: tile, borderRadius: 12 }}
                    contentFit="cover"
                  />
                </Pressable>
              );
            })}
            {photos.length < MAX_PROFILE_PHOTOS ? (
              <TouchableOpacity onPress={pickAndUploadPhoto} disabled={photoUploading}
                style={[{ width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 12 }, s.addPhotoTile]}>
                {photoUploading
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <><Ionicons name="add" size={28} color={COLORS.primary} /><Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>Add photo</Text></>}
              </TouchableOpacity>
            ) : null}
          </View>
          {photos.length > 0 && (
            <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>Long press a photo to remove it</Text>
          )}
        </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ════ BIO ════ */}
      <EditModal visible={editing === 'bio'} title="About Me" onClose={close} saving={saving}
        onSave={() => save({ bio: editText.trim() || null })}>
        <TextInput value={editText} onChangeText={setEditText} multiline numberOfLines={6} maxLength={300}
          placeholder="Tell others a little about yourself..." placeholderTextColor={COLORS.textMuted}
          style={em.textArea} autoFocus />
        <Text style={{ fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 6 }}>{editText.length}/300</Text>
      </EditModal>

      {/* ════ LOCATION ════ */}
      <EditModal visible={editing === 'location'} title="Where do you live?" onClose={close} saving={saving}
        onSave={() => save({
          country: editLocation.country ?? user.country,
          state:   editLocation.subdivision?.trim() || null,
          city:    editLocation.city?.trim() || null,
        })}>
        <LocationPicker value={editLocation} onChange={setEditLocation} />
      </EditModal>

      {/* ════ ORIGIN ════ */}
      <EditModal visible={editing === 'origin_location'} title="Origin" onClose={close} saving={saving}
        onSave={() => save({
          origin_country: editOriginLocation.country?.trim() || null,
          origin_state:   editOriginLocation.subdivision?.trim() || null,
          origin_city:    editOriginLocation.city?.trim() || null,
        })}>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 20 }}>
          Setting your origin enables ethnicity and language options specific to your country.
        </Text>
        <LocationPicker value={editOriginLocation} onChange={setEditOriginLocation} />
      </EditModal>

      {/* ════ BIRTHDATE ════ */}
      <EditModal visible={editing === 'birthdate'} title="Date of Birth" onClose={close} saving={saving}
        onSave={() => save({ birthdate: editDate ? editDate.toISOString().split('T')[0] : null })}>
        <DatePicker label="Date of Birth" value={editDate} onChange={setEditDate} placeholder="Tap to select" />
      </EditModal>

      {/* ════ HEIGHT — same slider as onboarding ════ */}
      <EditModal visible={editing === 'height'} title="Height" onClose={close} saving={saving}
        onSave={() => save({ height_cm: editHeight })}>
        <SliderPicker
          label="Height"
          value={editHeight}
          min={120} max={220} unit=""
          formatValue={(v) => `${(v / 100).toFixed(2)} m`}
          onChange={setEditHeight}
        />
      </EditModal>

      {/* ════ WEIGHT ════ */}
      <EditModal visible={editing === 'weight_kg'} title="Weight" onClose={close} saving={saving}
        onSave={() => save({ weight_kg: editWeight })}>
        <SliderPicker
          label="Weight"
          value={editWeight}
          min={35} max={180} unit="kg"
          onChange={setEditWeight}
        />
      </EditModal>

      {/* ════ ETHNICITY — cultural data list matching onboarding ════ */}
      <EditModal visible={editing === 'ethnicity'} title="Ethnicity" onClose={close} saving={saving}
        onSave={() => save({ ethnicity: editText.trim() || null })}>
        {cultureLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : cultureEthnicityOpts.length > 0 ? (
          renderSelectList(
            cultureEthnicityOpts.map(e => ({ value: e, label: e })),
            editText || null,
            (v) => setEditText(v ?? ''),
            true,
          )
        ) : needsOriginForData ? (
          <TouchableOpacity
            onPress={() => { close(); setTimeout(openOriginLocation, 300); }}
            style={{ borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primaryBorder, backgroundColor: COLORS.primarySurface, padding: 18, alignItems: 'center', gap: 10 }}>
            <Ionicons name="flag-outline" size={28} color={COLORS.primary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'center' }}>Set your origin first</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}>
              Tap to set your origin country and unlock ethnicity options for your heritage.
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            <TextInput value={editText} onChangeText={setEditText} autoFocus
              placeholder="e.g. Yoruba, Amhara, Zulu, Habesha…"
              placeholderTextColor={COLORS.textMuted} style={em.input} />
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>
              Type your ethnicity if it's not in the list
            </Text>
          </View>
        )}
      </EditModal>

      {/* ════ LANGUAGES — cultural chip list matching onboarding ════ */}
      <EditModal visible={editing === 'languages'} title="Languages" onClose={close} saving={saving}
        onSave={() => save({ languages: editMulti })}>
        {cultureLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : cultureLanguageOpts.suggested.length > 0 || cultureLanguageOpts.all.length > 0 ? (
          <View>
            {cultureLanguageOpts.suggested.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={em.groupLabel}>Suggested languages</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {cultureLanguageOpts.suggested.map(lang => {
                    const on = editMulti.includes(lang);
                    return (
                      <Pressable key={lang}
                        onPress={() => setEditMulti(p => on ? p.filter(v => v !== lang) : [...p, lang])}
                        style={[em.chip, on && em.chipOn]}>
                        <Text style={[em.chipTxt, on && em.chipTxtOn]}>{lang}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
            {cultureLanguageOpts.all.filter(l => !cultureLanguageOpts.suggested.includes(l)).length > 0 && (
              <View>
                <Text style={em.groupLabel}>More languages</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {cultureLanguageOpts.all.filter(l => !cultureLanguageOpts.suggested.includes(l)).map(lang => {
                    const on = editMulti.includes(lang);
                    return (
                      <Pressable key={lang}
                        onPress={() => setEditMulti(p => on ? p.filter(v => v !== lang) : [...p, lang])}
                        style={[em.chip, on && em.chipOn]}>
                        <Text style={[em.chipTxt, on && em.chipTxtOn]}>{lang}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        ) : needsOriginForData ? (
          <TouchableOpacity
            onPress={() => { close(); setTimeout(openOriginLocation, 300); }}
            style={{ borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primaryBorder, backgroundColor: COLORS.primarySurface, padding: 18, alignItems: 'center', gap: 10 }}>
            <Ionicons name="flag-outline" size={28} color={COLORS.primary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'center' }}>Set your origin first</Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 18 }}>
              Tap to set your origin country and unlock language options for your heritage.
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            <TextInput value={editMulti.join(', ')}
              onChangeText={t => setEditMulti(t.split(',').map(l => l.trim()).filter(Boolean))}
              autoFocus placeholder="e.g. English, Amharic, French"
              placeholderTextColor={COLORS.textMuted} style={em.input} />
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>Separate with commas</Text>
          </View>
        )}
      </EditModal>

      {/* ════ OCCUPATION — from OCCUPATION_OPTIONS like onboarding ════ */}
      <EditModal visible={editing === 'occupation'} title="Occupation" onClose={close} saving={saving}
        onSave={() => save({ occupation: editSelect })}>
        {renderSelectList(OCCUPATION_OPTIONS as any, editSelect, setEditSelect, true)}
      </EditModal>

      {/* ════ GENDER ════ */}
      <EditModal visible={editing === 'gender'} title="I am a" onClose={close} saving={saving}
        onSave={() =>
          save({
            gender: editSelect,
            ...(editSelect === 'male' || editSelect === 'female'
              ? { interested_in: oppositeInterestedIn(editSelect as Gender) }
              : {}),
          })
        }>
        {renderSelectList(GENDER_OPTIONS, editSelect, setEditSelect)}
      </EditModal>

      {/* ════ INTERESTED IN ════ */}
      <EditModal visible={editing === 'interested_in'} title="Interested in" onClose={close} saving={saving}
        onSave={() => save({ interested_in: editSelect })}>
        {renderSelectList(INTERESTED_IN_OPTIONS, editSelect, setEditSelect)}
      </EditModal>

      {/* ════ RELIGION ════ */}
      <EditModal visible={editing === 'religion'} title="Religion" onClose={close} saving={saving}
        onSave={() => save({ religion: editSelect })}>
        {renderSelectList(RELIGION_OPTIONS, editSelect, setEditSelect)}
      </EditModal>

      {/* ════ EDUCATION ════ */}
      <EditModal visible={editing === 'education'} title="Highest Education" onClose={close} saving={saving}
        onSave={() => save({ education: editSelect })}>
        {renderSelectList(EDUCATION_OPTIONS as any, editSelect, setEditSelect)}
      </EditModal>

      {/* ════ MARITAL STATUS ════ */}
      <EditModal visible={editing === 'marital_status'} title="Marital Status" onClose={close} saving={saving}
        onSave={() => save({ marital_status: editSelect })}>
        {renderSelectList(MARITAL_STATUS_OPTIONS, editSelect, setEditSelect)}
      </EditModal>

      {/* ════ BODY TYPE ════ */}
      <EditModal visible={editing === 'body_type'} title="Body Type" onClose={close} saving={saving}
        onSave={() => save({ body_type: editSelect })}>
        {renderSelectList(PHYSICAL_CONDITION_OPTIONS as any, editSelect, setEditSelect)}
      </EditModal>

      {/* ════ WANT CHILDREN ════ */}
      <EditModal visible={editing === 'want_children'} title="Want Children?" onClose={close} saving={saving}
        onSave={() => save({ want_children: editSelect })}>
        {renderSelectList(WANT_CHILDREN_YES_NO, editSelect, setEditSelect)}
      </EditModal>

      {/* ════ HAS CHILDREN ════ */}
      <EditModal visible={editing === 'has_children'} title="Has children" onClose={close} saving={saving}
        onSave={() => save({ has_children: editBool })}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {HAS_CHILDREN_OPTIONS.map(opt => {
            const on = editBool === (opt.value === 'true');
            return (
              <Pressable key={opt.value} onPress={() => setEditBool(opt.value === 'true')}
                style={[em.bigChip, on && em.bigChipOn]}>
                <Text style={[em.bigChipTxt, on && em.bigChipTxtOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </EditModal>

      {/* ════ LOOKING FOR ════ */}
      <EditModal visible={editing === 'looking_for'} title="Looking For" onClose={close} saving={saving}
        onSave={() => save({ looking_for: editMulti })}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {LOOKING_FOR_OPTIONS.map(opt => {
            const on = editMulti.includes(opt.value);
            return (
              <Pressable key={opt.value}
                onPress={() => setEditMulti(p => on ? p.filter(v => v !== opt.value) : [...p, opt.value])}
                style={[em.chip, on && em.chipOn]}>
                <Text style={[em.chipTxt, on && em.chipTxtOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </EditModal>

      {/* ════ HOBBIES ════ */}
      <EditModal visible={editing === 'hobbies'} title="Hobbies & Interests" onClose={close} saving={saving}
        onSave={() => save({ hobbies: editMulti })}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {HOBBY_OPTIONS.map(h => {
            const on = editMulti.includes(h);
            return (
              <Pressable key={h}
                onPress={() => setEditMulti(p => on ? p.filter(v => v !== h) : [...p, h])}
                style={[em.chip, on && em.chipOn]}>
                <Text style={[em.chipTxt, on && em.chipTxtOn]}>{h}</Text>
              </Pressable>
            );
          })}
        </View>
      </EditModal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  completionPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, backgroundColor: COLORS.primarySurface, borderWidth: 1, borderColor: COLORS.primaryBorder },
  completionPillTxt: { fontSize: 11, fontWeight: FONT.extrabold, color: COLORS.primary, letterSpacing: 0.2 },
  onlineBadge: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.xl },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.white },
  onlineText: { fontSize: 12, color: COLORS.white, fontWeight: FONT.semibold },
  cameraBtn: { position: 'absolute', bottom: 100, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  dotRow: { position: 'absolute', bottom: 80, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.white },
  heroInfo: { position: 'absolute', bottom: 16, left: 16, right: 60 },
  heroName: { fontSize: 30, fontFamily: FONT.displayFamily, color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6, letterSpacing: 0.3 },
  heroLocation: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.85)' },
  completionInline: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primarySurface, borderWidth: 1, borderColor: COLORS.primaryBorder },
  completionInlineTxt: { flex: 1, fontSize: 12.5, color: COLORS.text, lineHeight: 17 },
  completionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  section: { backgroundColor: COLORS.white, marginBottom: 8, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: FONT.xs, fontWeight: FONT.extrabold, color: COLORS.earth, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  sectionEditBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  bioText: { flex: 1, fontSize: FONT.md, color: COLORS.textStrong, lineHeight: 23 },
  emptyPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primaryBorder, backgroundColor: COLORS.primarySurface, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fieldIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  fieldIconEmpty: {
    backgroundColor: COLORS.emptyFieldSurface,
    borderWidth: 1,
    borderColor: COLORS.emptyFieldBorder,
  },
  fieldLabel: { fontSize: FONT.xs, color: COLORS.textSecondary, fontWeight: FONT.medium, marginBottom: 1 },
  fieldValue: { fontSize: 14, color: COLORS.textStrong, fontWeight: FONT.semibold },
  fieldValueEmpty: { color: COLORS.emptyField, fontWeight: FONT.semibold, fontStyle: 'italic' },
  badge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.xl, backgroundColor: COLORS.savanna, borderWidth: 1, borderColor: COLORS.border },
  badgeText: { fontSize: FONT.sm, color: COLORS.textStrong, fontWeight: FONT.semibold },
  addPhotoTile: { backgroundColor: COLORS.primarySurface, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.primaryBorder, alignItems: 'center', justifyContent: 'center' },
  stripThumb:     { width: 56, height: 56, borderRadius: RADIUS.md, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  stripThumbActive:{ borderColor: COLORS.primary },
  stripImg:       { width: '100%', height: '100%' },
  stripCheck:     { position: 'absolute', bottom: 3, right: 3, width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
});

const em = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: FONT.lg, fontWeight: FONT.bold, color: COLORS.textStrong },
  saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.xl },
  saveTxt: { color: COLORS.white, fontWeight: FONT.bold, fontSize: 14 },
  input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: FONT.md, color: COLORS.textStrong, backgroundColor: COLORS.white },
  textArea: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontSize: FONT.md, color: COLORS.textStrong, backgroundColor: COLORS.white, minHeight: 140, textAlignVertical: 'top' },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.white, marginBottom: 14 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  optionOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  optionTxt: { fontSize: FONT.md, color: COLORS.textStrong, fontWeight: FONT.medium },
  optionTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  bigChip: { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center' },
  bigChipOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  bigChipTxt: { fontSize: FONT.md, color: COLORS.textSecondary, fontWeight: FONT.medium },
  bigChipTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipOn: { borderColor: COLORS.success, backgroundColor: COLORS.successSurface },
  chipTxt: { fontSize: 14, color: COLORS.textSecondary, fontWeight: FONT.medium },
  chipTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  groupLabel: { fontSize: FONT.sm, fontWeight: FONT.bold, color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
});
