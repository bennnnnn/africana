import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, Pressable, Alert, ActivityIndicator,
  Dimensions, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth.store';
import {
  COLORS, RADIUS, FONT, DEFAULT_AVATAR,
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

const { width } = Dimensions.get('window');

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
function FieldRow({ icon, label, value, onEdit }: {
  icon: keyof typeof Ionicons.glyphMap; label: string;
  value: string | null | undefined; onEdit: () => void;
}) {
  const filled = !!value;
  return (
    <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={s.fieldRow}>
      <View style={[s.fieldIcon, !filled && s.fieldIconEmpty]}>
        <Ionicons name={icon} size={15} color={filled ? COLORS.textStrong : COLORS.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={[s.fieldValue, !filled && s.fieldValueEmpty]}>
          {filled ? value : `Add ${label.toLowerCase()}`}
        </Text>
      </View>
      <Ionicons name={filled ? 'pencil' : 'add-circle-outline'} size={16} color={filled ? COLORS.textStrong : COLORS.textMuted} />
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MyProfileScreen() {
  const { user, updateProfile } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // Generic edit state
  const [editText, setEditText]     = useState('');
  const [editSelect, setEditSelect] = useState<string | null>(null);
  const [editMulti, setEditMulti]   = useState<string[]>([]);
  const [editBool, setEditBool]     = useState<boolean | null>(null);
  const [editHeight, setEditHeight] = useState(170);
  const [editDate, setEditDate]               = useState<Date | null>(null);
  const [editLocation, setEditLocation]       = useState<Partial<LocationValue>>({});
  const [editOriginLocation, setEditOriginLocation] = useState<Partial<LocationValue>>({});
  const [photoUploading, setPhotoUploading] = useState(false);

  // Cultural data for ethnicity + languages
  const [cultureEthnicityOpts, setCultureEthnicityOpts] = useState<string[]>([]);
  const [cultureLanguageOpts, setCultureLanguageOpts]   = useState<{ suggested: string[]; all: string[] }>({ suggested: [], all: [] });
  const [cultureLoading, setCultureLoading] = useState(false);

  // Search within long lists
  const [listSearch, setListSearch] = useState('');

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
      // Diaspora — try African origin country first
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
    catch (e: any) { Alert.alert('Error', e?.message ?? 'Could not save.'); }
    finally { setSaving(false); }
  };

  const openText   = (k: string, v: string | null)   => { setEditing(k); setEditText(v ?? ''); setListSearch(''); };
  const openSelect = (k: string, v: string | null)   => { setEditing(k); setEditSelect(v); setListSearch(''); };
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

  const pickAndUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [3, 4], quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoUploading(true);
    try {
      const uri = result.assets[0].uri;
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const res = await fetch(uri);
      const blob = await res.blob();
      const { error: uploadErr } = await supabase.storage
        .from('avatars').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const newUrl = data.publicUrl;
      const currentPhotos = user.profile_photos ?? [];
      await updateProfile({
        profile_photos: [...currentPhotos, newUrl],
        avatar_url: currentPhotos.length === 0 ? newUrl : user.avatar_url,
      });
    } catch {
      Alert.alert('Upload failed', 'Could not upload photo. Please try again.');
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
  const avatar   = user.avatar_url || (user.profile_photos ?? [])[0]
    || `${DEFAULT_AVATAR}${encodeURIComponent((user.full_name ?? '?').charAt(0))}`;
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
  const bodyTypeLabel     = user.body_type      ? (PHYSICAL_CONDITION_OPTIONS as any[]).find(o => o.value === user.body_type)?.label ?? user.body_type : null;
  const occupationLabel   = user.occupation     ? (OCCUPATION_OPTIONS as any[]).find(o => o.value === user.occupation)?.label ?? user.occupation  : null;
  const interestedInLabel  = INTERESTED_IN_OPTIONS.find(o => o.value === user.interested_in)?.label ?? null;
  const locationDisplay    = [user.city, user.state, user.country].filter(Boolean).join(', ');
  const originDisplay      = [user.origin_city, user.origin_state, user.origin_country].filter(Boolean).join(', ');

  // Detect if diaspora user has no African origin set (needed for ethnicity/language data)
  const livesInAfrica      = user.country ? AFRICAN_COUNTRY_CODES.has(getCountryByName(user.country)?.code ?? '') : false;
  const hasAfricanOrigin   = !!user.origin_country && AFRICAN_COUNTRY_CODES.has(getCountryByName(user.origin_country)?.code ?? '');
  const needsOriginForData = !livesInAfrica && !hasAfricanOrigin;

  const completionFields = [
    { label: 'Profile photo', done: photos.length > 0 },
    { label: 'Bio',           done: !!user.bio },
    { label: 'Religion',      done: !!user.religion },
    { label: 'Education',     done: !!user.education },
    { label: 'Occupation',    done: !!user.occupation },
    { label: 'Height',        done: !!user.height_cm },
    { label: 'Ethnicity',     done: !!user.ethnicity },
    { label: 'Languages',     done: (user.languages ?? []).length > 0 },
    { label: 'Hobbies',       done: (user.hobbies ?? []).length > 0 },
  ];
  const completionPct = Math.round(completionFields.filter(f => f.done).length / completionFields.length * 100);
  const nextMissing   = completionFields.find(f => !f.done);

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
      <ScrollView showsVerticalScrollIndicator={false} bounces alwaysBounceVertical>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={() => router.push('/(settings)/main')} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={20} color="#111" />
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: avatar }} style={{ width, height: width * 1.1 }} contentFit="cover" />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.65)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '65%' }} />
          <View style={[s.onlineBadge, { backgroundColor: isOnline ? COLORS.online : 'rgba(0,0,0,0.45)' }]}>
            <View style={s.onlineDot} /><Text style={s.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          <TouchableOpacity style={s.cameraBtn} onPress={pickAndUploadPhoto} disabled={photoUploading}>
            <Ionicons name={photoUploading ? 'hourglass-outline' : 'camera'} size={18} color="#FFF" />
          </TouchableOpacity>
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

        {/* Photo strip — shown when user has multiple photos; tap to set as profile picture */}
        {photos.length > 1 && (
          <View style={s.photoStrip}>
            {photos.map((photo, i) => {
              const isMain = photo === user.avatar_url || (i === 0 && !user.avatar_url);
              return (
                <TouchableOpacity
                  key={i}
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
          </View>
        )}

        {/* Completion */}
        {completionPct < 100 && (
          <View style={s.completion}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: COLORS.primary }}>Profile {completionPct}% complete</Text>
            </View>
            <View style={{ height: 6, backgroundColor: `${COLORS.primary}20`, borderRadius: 3 }}>
              <View style={{ height: 6, backgroundColor: COLORS.primary, borderRadius: 3, width: `${completionPct}%` }} />
            </View>
            {nextMissing && (
              <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 8 }}>
                Add your <Text style={{ fontWeight: '700', color: COLORS.primary }}>{nextMissing.label}</Text> to get more matches
              </Text>
            )}
          </View>
        )}

        {/* About Me */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>About Me</Text>
          {user.bio ? (
            <TouchableOpacity onPress={() => openText('bio', user.bio)} activeOpacity={0.7}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={s.bioText}>{user.bio}</Text>
              <Ionicons name="pencil" size={15} color="#111" style={{ marginTop: 3 }} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => openText('bio', '')} style={s.emptyPrompt}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.primary} />
              <Text style={{ color: COLORS.primary, fontSize: 14, fontWeight: '600' }}>Add a bio — it helps you stand out</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Personal */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Personal</Text>
          <FieldRow icon="person-outline"      label="Gender"         value={user.gender ? (GENDER_OPTIONS.find(o => o.value === user.gender)?.label ?? user.gender) : null} onEdit={() => openSelect('gender', user.gender)} />
          <FieldRow icon="calendar-outline"    label="Date of birth"  value={user.birthdate ?? null} onEdit={openDate} />
          <FieldRow icon="search-outline"      label="Interested in"  value={interestedInLabel} onEdit={() => openSelect('interested_in', user.interested_in)} />
          <FieldRow icon="location-outline" label="Location" value={locationDisplay || null} onEdit={openLocation} />
          {!livesInAfrica && (
            <FieldRow icon="flag-outline" label="African origin" value={originDisplay || null} onEdit={openOriginLocation} />
          )}
          <FieldRow icon="sunny-outline"       label="Religion"       value={religionLabel} onEdit={() => openSelect('religion', user.religion)} />
          <FieldRow icon="globe-outline"       label="Ethnicity"      value={user.ethnicity ?? null} onEdit={openEthnicity} />
          <FieldRow icon="chatbubbles-outline" label="Languages"      value={(user.languages ?? []).join(', ') || null} onEdit={openLanguages} />
        </View>

        {/* Physical */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Physical</Text>
          <FieldRow icon="resize-outline" label="Height" value={user.height_cm ? `${(user.height_cm / 100).toFixed(2)} m` : null}
            onEdit={() => { setEditing('height'); setEditHeight(user.height_cm ?? 170); }} />
          <FieldRow icon="body-outline"   label="Body type" value={bodyTypeLabel} onEdit={() => openSelect('body_type', user.body_type)} />
          <FieldRow icon="barbell-outline" label="Weight"    value={user.weight_kg ? `${user.weight_kg} kg` : null} onEdit={() => { setEditing('weight_kg'); setEditHeight(user.weight_kg ?? 70); }} />
        </View>

        {/* Work & Education */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Work & Education</Text>
          <FieldRow icon="briefcase-outline" label="Occupation" value={occupationLabel} onEdit={() => { openSelect('occupation', user.occupation); setListSearch(''); }} />
          <FieldRow icon="school-outline"    label="Education"  value={educationLabel}  onEdit={() => openSelect('education', user.education)} />
        </View>

        {/* Family */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Family</Text>
          <FieldRow icon="heart-outline"  label="Marital status" value={maritalLabel} onEdit={() => openSelect('marital_status', user.marital_status)} />
          <FieldRow icon="people-outline" label="Children"      value={user.has_children == null ? null : user.has_children ? 'Has children' : 'No children'} onEdit={() => openBool('has_children', user.has_children)} />
          <FieldRow icon="happy-outline"  label="Wants children" value={wantChildrenLabel} onEdit={() => openSelect('want_children', user.want_children)} />
        </View>

        {/* Looking for */}
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

        {/* Hobbies */}
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

        {/* Photos */}
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.sectionTitle}>Photos</Text>
            <TouchableOpacity onPress={pickAndUploadPhoto} style={s.sectionEditBtn}>
              <Ionicons name="add" size={13} color="#111" />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 8 }}>
            {photos.slice(0, 6).map((photo, i) => (
              <Image key={i} source={{ uri: photo }}
                style={{ width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 12 }} contentFit="cover" />
            ))}
            <TouchableOpacity onPress={pickAndUploadPhoto} disabled={photoUploading}
              style={[{ width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 12 }, s.addPhotoTile]}>
              {photoUploading
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <><Ionicons name="add" size={28} color={COLORS.primary} /><Text style={{ fontSize: 11, color: COLORS.primary, fontWeight: '600', marginTop: 2 }}>Add photo</Text></>}
            </TouchableOpacity>
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

      {/* ════ AFRICAN ORIGIN ════ */}
      <EditModal visible={editing === 'origin_location'} title="African Origin" onClose={close} saving={saving}
        onSave={() => save({
          origin_country: editOriginLocation.country?.trim() || null,
          origin_state:   editOriginLocation.subdivision?.trim() || null,
          origin_city:    editOriginLocation.city?.trim() || null,
        })}>
        <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 20 }}>
          Setting your African origin enables ethnicity and language options specific to your country.
        </Text>
        <LocationPicker value={editOriginLocation} onChange={setEditOriginLocation} />
      </EditModal>

      {/* ════ BIRTHDATE ════ */}
      <EditModal visible={editing === 'birthdate'} title="Date of Birth" onClose={close} saving={saving}
        onSave={() => save({ birthdate: editDate ? editDate.toISOString().split('T')[0] : null })}>
        <DatePicker label="Date of Birth" value={editDate} onChange={setEditDate} placeholder="Tap to select" />
      </EditModal>

      {/* ════ INTERESTED IN ════ */}
      <EditModal visible={editing === 'interested_in'} title="Interested in" onClose={close} saving={saving}
        onSave={() => save({ interested_in: editSelect })}>
        {renderSelectList(INTERESTED_IN_OPTIONS, editSelect, setEditSelect)}
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
        onSave={() => save({ weight_kg: editHeight })}>
        <SliderPicker
          label="Weight"
          value={editHeight}
          min={35} max={180} unit="kg"
          onChange={setEditHeight}
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
            style={{ borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08`, padding: 18, alignItems: 'center', gap: 10 }}>
            <Ionicons name="flag-outline" size={28} color={COLORS.primary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'center' }}>Set your African origin first</Text>
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
            style={{ borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08`, padding: 18, alignItems: 'center', gap: 10 }}>
            <Ionicons name="flag-outline" size={28} color={COLORS.primary} />
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLORS.primary, textAlign: 'center' }}>Set your African origin first</Text>
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
        onSave={() => save({ gender: editSelect })}>
        {renderSelectList(GENDER_OPTIONS, editSelect, setEditSelect)}
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
      <EditModal visible={editing === 'has_children'} title="Do you have children?" onClose={close} saving={saving}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 22, fontWeight: FONT.extrabold, color: COLORS.textStrong },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  onlineBadge: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.xl },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.white },
  onlineText: { fontSize: 12, color: COLORS.white, fontWeight: FONT.semibold },
  cameraBtn: { position: 'absolute', bottom: 60, right: 14, width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  heroInfo: { position: 'absolute', bottom: 16, left: 16, right: 60 },
  heroName: { fontSize: 26, fontWeight: FONT.extrabold, color: COLORS.white, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroLocation: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.85)' },
  statsBar: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, marginBottom: 8 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 14, gap: 3 },
  statValue: { fontSize: FONT.lg, fontWeight: FONT.bold, color: COLORS.textStrong },
  statLabel: { fontSize: FONT.xs, color: COLORS.textSecondary },
  completion: { margin: 12, marginBottom: 8, padding: 16, borderRadius: RADIUS.lg, backgroundColor: `${COLORS.primary}10`, borderWidth: 1.5, borderColor: `${COLORS.primary}30` },
  section: { backgroundColor: COLORS.white, marginBottom: 8, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: FONT.md, fontWeight: FONT.extrabold, color: COLORS.textStrong, letterSpacing: 0.2, marginBottom: 10 },
  sectionEditBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  bioText: { flex: 1, fontSize: FONT.md, color: COLORS.textStrong, lineHeight: 23 },
  emptyPrompt: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, backgroundColor: `${COLORS.primary}08`, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  fieldIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: COLORS.savanna, alignItems: 'center', justifyContent: 'center' },
  fieldIconEmpty: { backgroundColor: COLORS.surface },
  fieldLabel: { fontSize: FONT.xs, color: COLORS.textSecondary, fontWeight: FONT.medium, marginBottom: 1 },
  fieldValue: { fontSize: 14, color: COLORS.textStrong, fontWeight: FONT.semibold },
  fieldValueEmpty: { color: COLORS.textMuted, fontWeight: FONT.regular, fontStyle: 'italic' },
  badge: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.xl, backgroundColor: COLORS.savanna, borderWidth: 1, borderColor: COLORS.border },
  badgeText: { fontSize: FONT.sm, color: COLORS.textStrong, fontWeight: FONT.semibold },
  addPhotoTile: { backgroundColor: `${COLORS.primary}08`, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  photoStrip:     { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
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
  optionOn: { borderColor: COLORS.success, backgroundColor: `${COLORS.success}12` },
  optionTxt: { fontSize: FONT.md, color: COLORS.textStrong, fontWeight: FONT.medium },
  optionTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  bigChip: { flex: 1, paddingVertical: 16, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white, alignItems: 'center' },
  bigChipOn: { borderColor: COLORS.success, backgroundColor: `${COLORS.success}12` },
  bigChipTxt: { fontSize: FONT.md, color: COLORS.textSecondary, fontWeight: FONT.medium },
  bigChipTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.white },
  chipOn: { borderColor: COLORS.success, backgroundColor: `${COLORS.success}12` },
  chipTxt: { fontSize: 14, color: COLORS.textSecondary, fontWeight: FONT.medium },
  chipTxtOn: { color: COLORS.success, fontWeight: FONT.bold },
  groupLabel: { fontSize: FONT.sm, fontWeight: FONT.bold, color: COLORS.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
});
