import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  RADIUS,
  FONT,
  MAX_PROFILE_PHOTOS,
  GENDER_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from '@/constants';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { HeroPlaceholder } from '@/components/ui/HeroPlaceholder';
import { FieldRow } from '@/components/me/MyProfileEditPrimitives';
import { MyProfileEditModals } from '@/components/me/MyProfileEditModals';
import { useMeProfileController } from '@/hooks/use-me-profile-controller';
import { sectionForMissingKey } from '@/lib/me-profile-sections';

const { width } = Dimensions.get('window');
// Self-profile hero height. Shorter than a typical portrait dating photo so
// the user can scan more of their profile (quick facts, completion chips)
// without scrolling, while staying tall enough that portrait uploads don't
// lose the face to a center crop.
const HERO_HEIGHT = width * 0.9;

export default function MyProfileScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const sectionY = useRef<Record<string, number>>({});

  const ctrl = useMeProfileController();
  const { user, display } = ctrl;

  if (!user || !display) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="person-outline" size={32} color={COLORS.primary} />
        <Text style={{ marginTop: 12, fontSize: 14, color: COLORS.textSecondary }}>
          Loading profile…
        </Text>
      </SafeAreaView>
    );
  }

  const {
    photos,
    location,
    age,
    isOnline,
    religionLabel,
    educationLabel,
    maritalLabel,
    wantChildrenLabel,
    bodyTypeLabel,
    occupationLabel,
    interestedInLabel,
    locationDisplay,
    originDisplay,
    livesInAfrica,
    needsOriginForData,
    completionPct,
    nextMissing,
  } = display;

  const {
    heroPhotoScrollRef,
    heroPhotos,
    heroPage,
    setHeroPage,
    saving,
    editing,
    editText,
    setEditText,
    editSelect,
    setEditSelect,
    editMulti,
    setEditMulti,
    editBool,
    setEditBool,
    editHeight,
    setEditHeight,
    editWeight,
    setEditWeight,
    editDate,
    setEditDate,
    editLocation,
    setEditLocation,
    editOriginLocation,
    setEditOriginLocation,
    photoUploading,
    listSearch,
    setListSearch,
    close,
    save,
    openText,
    openSelect,
    openMulti,
    openBool,
    openDate,
    openLocation,
    openOriginLocation,
    confirmRemovePhoto,
    pickAndUploadPhoto,
    openEthnicity,
    openLanguages,
    openHeight,
    openWeight,
    cultureEthnicityOpts,
    cultureLanguageOpts,
    cultureLoading,
  } = ctrl;

  const scrollToSection = (id: string) => {
    const y = sectionY.current[id];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
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
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <TouchableOpacity
            onPress={() => {
              if (user?.id) router.push({ pathname: '/(profile)/[id]', params: { id: user.id } });
            }}
            style={s.iconBtn}
          >
            <Ionicons name="eye-outline" size={20} color={COLORS.textStrong} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/(settings)/main')} style={s.iconBtn}>
            <Ionicons name="settings-outline" size={20} color={COLORS.textStrong} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        bounces
        alwaysBounceVertical
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {/* Shadowban / hidden-profile notice */}
        {user?.show_in_discover === false && (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 12,
              backgroundColor: '#FEF3C7',
              borderRadius: RADIUS.lg,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: '#FCD34D',
            }}
          >
            <Ionicons name="eye-off-outline" size={20} color={COLORS.earth} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FONT.sm, fontWeight: FONT.bold, color: COLORS.textStrong }}>
                Your profile is hidden
              </Text>
              <Text style={{ fontSize: FONT.xs, color: COLORS.textSecondary, marginTop: 2 }}>
                You won&apos;t appear in Discover or Online. If this was unexpected, contact support — we&apos;ll review it.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => Linking.openURL('mailto:support@africana.app')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="mail-outline" size={20} color={COLORS.earth} />
            </TouchableOpacity>
          </View>
        )}

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
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.28)']}
            pointerEvents="none"
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%' }}
          />
          {/* Swipe dots — only when more than one photo */}
          {heroPhotos.length > 1 && (
            <View style={s.dotRow} pointerEvents="none">
              {heroPhotos.map((_, i) => (
                <View key={i} style={[s.dot, i === heroPage && s.dotActive]} />
              ))}
            </View>
          )}
          <View
            style={[
              s.onlineBadge,
              { backgroundColor: isOnline ? COLORS.online : 'rgba(0,0,0,0.45)' },
            ]}
          >
            <View style={s.onlineDot} />
            <Text style={s.onlineText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
          {photos.length < MAX_PROFILE_PHOTOS ? (
            <TouchableOpacity
              style={s.cameraBtn}
              onPress={pickAndUploadPhoto}
              disabled={photoUploading}
            >
              <Ionicons
                name={photoUploading ? 'hourglass-outline' : 'camera'}
                size={18}
                color="#FFF"
              />
            </TouchableOpacity>
          ) : null}
          <View style={s.heroInfo}>
            <Text style={s.heroName}>
              {user.full_name}
              {age ? `, ${age}` : ''}
            </Text>
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
            <Text
              style={{
                fontSize: 12,
                fontWeight: FONT.medium,
                color: COLORS.textSecondary,
                textAlign: 'center',
                paddingTop: 10,
                paddingBottom: 4,
              }}
            >
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
                    <Image source={{ uri: photo }} style={s.stripImg} contentFit="cover" contentPosition="center" />
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
              <TouchableOpacity
                onPress={() => openText('bio', user.bio)}
                activeOpacity={0.7}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}
              >
                <Text style={s.bioText}>{user.bio}</Text>
                <Ionicons
                  name="pencil"
                  size={15}
                  color={COLORS.textStrong}
                  style={{ marginTop: 3 }}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => openText('bio', '')} style={s.emptyPrompt}>
                <Ionicons name="add-circle-outline" size={16} color={COLORS.emptyField} />
                <Text style={{ color: COLORS.emptyField, fontSize: 14, fontWeight: '600' }}>
                  Add a bio — it helps you stand out
                </Text>
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
              Add your <Text style={{ fontWeight: FONT.extrabold }}>{nextMissing.label}</Text> to
              get more matches
            </Text>
            <Ionicons name="chevron-forward" size={14} color={COLORS.emptyField} />
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
            <FieldRow
              icon="person-outline"
              label="Gender"
              value={
                user.gender
                  ? (GENDER_OPTIONS.find((o) => o.value === user.gender)?.label ?? user.gender)
                  : null
              }
              onEdit={() => openSelect('gender', user.gender)}
            />
            <FieldRow
              icon="calendar-outline"
              label="Date of birth"
              value={user.birthdate ?? null}
              onEdit={openDate}
            />
            <FieldRow
              icon="search-outline"
              label="Interested in"
              value={interestedInLabel}
              onEdit={() => openSelect('interested_in', user.interested_in)}
            />
            <FieldRow
              icon="location-outline"
              label="Location"
              value={locationDisplay || null}
              onEdit={openLocation}
            />
            {!livesInAfrica && (
              <FieldRow
                icon="flag-outline"
                label="Origin"
                value={originDisplay || null}
                onEdit={openOriginLocation}
              />
            )}
            <FieldRow
              icon="globe-outline"
              label="Ethnicity"
              value={user.ethnicity ?? null}
              onEdit={openEthnicity}
            />
            <FieldRow
              icon="chatbubbles-outline"
              label="Languages"
              value={(user.languages ?? []).join(', ') || null}
              onEdit={openLanguages}
            />
            <FieldRow
              icon="sunny-outline"
              label="Religion"
              value={religionLabel}
              onEdit={() => openSelect('religion', user.religion)}
            />
          </View>
        </View>

        {/* Looking for — intent first, matches the way people read profiles */}
        <View
          onLayout={(e) => {
            sectionY.current.looking = e.nativeEvent.layout.y;
          }}
        >
          <View style={s.section}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={s.sectionTitle}>Looking for</Text>
              <TouchableOpacity
                onPress={() => openMulti('looking_for', user.looking_for ?? [])}
                style={s.sectionEditBtn}
              >
                <Ionicons name="pencil" size={13} color="#111" />
              </TouchableOpacity>
            </View>
            {(user.looking_for ?? []).length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
                {(user.looking_for ?? []).map((lf) => (
                  <View key={lf} style={s.badge}>
                    <Text style={s.badgeText}>
                      {LOOKING_FOR_OPTIONS.find((o) => o.value === lf)?.label ?? lf}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <TouchableOpacity onPress={() => openMulti('looking_for', [])} style={s.emptyPrompt}>
                <Ionicons name="add-circle-outline" size={16} color={COLORS.emptyField} />
                <Text style={{ color: COLORS.emptyField, fontSize: 14, fontWeight: '600' }}>
                  Add what you{"'"}re looking for
                </Text>
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
            <FieldRow
              icon="resize-outline"
              label="Height"
              value={user.height_cm ? `${(user.height_cm / 100).toFixed(2)} m` : null}
              onEdit={openHeight}
            />
            <FieldRow
              icon="body-outline"
              label="Body type"
              value={bodyTypeLabel}
              onEdit={() => openSelect('body_type', user.body_type)}
            />
            <FieldRow
              icon="barbell-outline"
              label="Weight (optional)"
              value={user.weight_kg ? `${user.weight_kg} kg` : null}
              onEdit={openWeight}
            />
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
            <FieldRow
              icon="heart-outline"
              label="Marital status"
              value={maritalLabel}
              onEdit={() => openSelect('marital_status', user.marital_status)}
            />
            <FieldRow
              icon="people-outline"
              label="Has children"
              value={user.has_children == null ? null : user.has_children ? 'Yes' : 'No'}
              onEdit={() => openBool('has_children', user.has_children)}
            />
            <FieldRow
              icon="happy-outline"
              label="Wants children"
              value={wantChildrenLabel}
              onEdit={() => openSelect('want_children', user.want_children)}
            />
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
            <FieldRow
              icon="briefcase-outline"
              label="Occupation"
              value={occupationLabel}
              onEdit={() => {
                openSelect('occupation', user.occupation);
                setListSearch('');
              }}
            />
            <FieldRow
              icon="school-outline"
              label="Education"
              value={educationLabel}
              onEdit={() => openSelect('education', user.education)}
            />
          </View>
        </View>

        {/* Hobbies */}
        <View
          onLayout={(e) => {
            sectionY.current.hobbies = e.nativeEvent.layout.y;
          }}
        >
          <View style={s.section}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={s.sectionTitle}>Hobbies & Interests</Text>
              <TouchableOpacity
                onPress={() => openMulti('hobbies', user.hobbies ?? [])}
                style={s.sectionEditBtn}
              >
                <Ionicons name="pencil" size={13} color="#111" />
              </TouchableOpacity>
            </View>
            {(user.hobbies ?? []).length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
                {(user.hobbies ?? []).map((h) => (
                  <View key={h} style={s.badge}>
                    <Text style={s.badgeText}>{h}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <TouchableOpacity onPress={() => openMulti('hobbies', [])} style={s.emptyPrompt}>
                <Ionicons name="add-circle-outline" size={16} color={COLORS.emptyField} />
                <Text style={{ color: COLORS.emptyField, fontSize: 14, fontWeight: '600' }}>
                  Add your hobbies & interests
                </Text>
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
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
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
                      contentPosition="center"
                    />
                  </Pressable>
                );
              })}
              {photos.length < MAX_PROFILE_PHOTOS ? (
                <TouchableOpacity
                  onPress={pickAndUploadPhoto}
                  disabled={photoUploading}
                  style={[
                    { width: (width - 60) / 3, height: (width - 60) / 3, borderRadius: 12 },
                    s.addPhotoTile,
                  ]}
                >
                  {photoUploading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="add" size={28} color={COLORS.emptyField} />
                      <Text
                        style={{
                          fontSize: 11,
                          color: COLORS.emptyField,
                          fontWeight: '600',
                          marginTop: 2,
                        }}
                      >
                        Add photo
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
            {photos.length > 0 && (
              <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>
                Long press a photo to remove it
              </Text>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <MyProfileEditModals
        user={user}
        editing={editing}
        saving={saving}
        close={close}
        save={save}
        editText={editText}
        setEditText={setEditText}
        editSelect={editSelect}
        setEditSelect={setEditSelect}
        editMulti={editMulti}
        setEditMulti={setEditMulti}
        editBool={editBool}
        setEditBool={setEditBool}
        editHeight={editHeight}
        setEditHeight={setEditHeight}
        editWeight={editWeight}
        setEditWeight={setEditWeight}
        editDate={editDate}
        setEditDate={setEditDate}
        editLocation={editLocation}
        setEditLocation={setEditLocation}
        editOriginLocation={editOriginLocation}
        setEditOriginLocation={setEditOriginLocation}
        listSearch={listSearch}
        setListSearch={setListSearch}
        needsOriginForData={needsOriginForData}
        openOriginLocation={openOriginLocation}
        cultureEthnicityOpts={cultureEthnicityOpts}
        cultureLanguageOpts={cultureLanguageOpts}
        cultureLoading={cultureLoading}
      />

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.emptyFieldSurface,
    borderWidth: 1,
    borderColor: COLORS.emptyFieldBorder,
  },
  completionPillTxt: {
    fontSize: 11,
    fontWeight: FONT.extrabold,
    color: COLORS.emptyField,
    letterSpacing: 0.2,
  },
  onlineBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.xl,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.white },
  onlineText: { fontSize: 12, color: COLORS.white, fontWeight: FONT.semibold },
  cameraBtn: {
    position: 'absolute',
    bottom: 100,
    right: 14,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  dotRow: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.white },
  heroInfo: { position: 'absolute', bottom: 16, left: 16, right: 60 },
  heroName: {
    fontSize: 30,
    fontFamily: FONT.displayFamily,
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    letterSpacing: 0.3,
  },
  heroLocation: { fontSize: FONT.sm, color: 'rgba(255,255,255,0.85)' },
  completionInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.emptyFieldSurface,
    borderWidth: 1,
    borderColor: COLORS.emptyFieldBorder,
  },
  completionInlineTxt: { flex: 1, fontSize: 12.5, color: COLORS.text, lineHeight: 17 },
  completionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.emptyField },
  section: {
    backgroundColor: COLORS.white,
    marginBottom: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: FONT.xs,
    fontWeight: FONT.extrabold,
    color: COLORS.earth,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionEditBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.savanna,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioText: { flex: 1, fontSize: FONT.md, color: COLORS.textStrong, lineHeight: 23 },
  emptyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.emptyFieldBorder,
    backgroundColor: COLORS.emptyFieldSurface,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.savanna,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badgeText: { fontSize: FONT.sm, color: COLORS.textStrong, fontWeight: FONT.semibold },
  addPhotoTile: {
    backgroundColor: COLORS.emptyFieldSurface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.emptyFieldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripThumb: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stripThumbActive: { borderColor: COLORS.primary },
  stripImg: { width: '100%', height: '100%' },
  stripCheck: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
