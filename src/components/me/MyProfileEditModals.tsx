import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  COLORS,
  GENDER_OPTIONS,
  INTERESTED_IN_OPTIONS,
  LOOKING_FOR_OPTIONS,
  RELIGION_OPTIONS,
  EDUCATION_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  WANT_CHILDREN_YES_NO,
  PHYSICAL_CONDITION_OPTIONS,
  OCCUPATION_OPTIONS,
  HAS_CHILDREN_OPTIONS,
} from '@/constants';
import { SliderPicker } from '@/components/ui/SliderPicker';
import { DatePicker } from '@/components/ui/DatePicker';
import { LocationPicker, type LocationValue } from '@/components/ui/LocationPicker';
import { oppositeInterestedIn } from '@/lib/gender-match';
import type { Gender, User } from '@/types';
import { EditModal, HOBBY_OPTIONS, em } from '@/components/me/MyProfileEditPrimitives';
import { MeProfileSelectList } from '@/components/me/MeProfileSelectList';

type CultureLanguageOpts = {
  suggested: string[];
  all: string[];
};

export type MyProfileEditModalsProps = {
  user: User;
  editing: string | null;
  saving: boolean;
  close: () => void;
  save: (updates: Record<string, unknown>) => Promise<void>;
  editText: string;
  setEditText: (v: string) => void;
  editSelect: string | null;
  setEditSelect: (v: string | null) => void;
  editMulti: string[];
  setEditMulti: React.Dispatch<React.SetStateAction<string[]>>;
  editBool: boolean | null;
  setEditBool: (v: boolean | null) => void;
  editHeight: number;
  setEditHeight: (v: number) => void;
  editWeight: number;
  setEditWeight: (v: number) => void;
  editDate: Date | null;
  setEditDate: (v: Date | null) => void;
  editLocation: Partial<LocationValue>;
  setEditLocation: (v: Partial<LocationValue>) => void;
  editOriginLocation: Partial<LocationValue>;
  setEditOriginLocation: (v: Partial<LocationValue>) => void;
  listSearch: string;
  setListSearch: (v: string) => void;
  needsOriginForData: boolean;
  openOriginLocation: () => void;
  cultureEthnicityOpts: string[];
  cultureLanguageOpts: CultureLanguageOpts;
  cultureLoading: boolean;
};

export function MyProfileEditModals({
  user,
  editing,
  saving,
  close,
  save,
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
  listSearch,
  setListSearch,
  needsOriginForData,
  openOriginLocation,
  cultureEthnicityOpts,
  cultureLanguageOpts,
  cultureLoading,
}: MyProfileEditModalsProps) {
  return (
    <>
      <EditModal
        visible={editing === 'bio'}
        title="About Me"
        onClose={close}
        saving={saving}
        onSave={() => save({ bio: editText.trim() || null })}
      >
        <TextInput
          value={editText}
          onChangeText={setEditText}
          multiline
          numberOfLines={6}
          maxLength={300}
          placeholder="Tell others a little about yourself..."
          placeholderTextColor={COLORS.textMuted}
          style={em.textArea}
          autoFocus
        />
        <Text style={{ fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 6 }}>
          {editText.length}/300
          {editText.trim().length > 0 && editText.trim().length < 20 && ' · Add at least 20 characters'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {[
            'Sundays at the market 🌿',
            'Lifelong Eagles fan 🦅',
            'First-gen Ghanaian-American 🇬🇭',
          ].map((example) => (
            <TouchableOpacity
              key={example}
              onPress={() => setEditText(example)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 16,
                backgroundColor: COLORS.savanna,
                borderWidth: 1,
                borderColor: COLORS.border,
              }}
            >
              <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>{example}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </EditModal>

      <EditModal
        visible={editing === 'location'}
        title="Where do you live?"
        onClose={close}
        saving={saving}
        onSave={() =>
          save({
            country: editLocation.country ?? user.country,
            state: editLocation.subdivision?.trim() || null,
            city: editLocation.city?.trim() || null,
          })
        }
      >
        <LocationPicker value={editLocation} onChange={setEditLocation} />
      </EditModal>

      <EditModal
        visible={editing === 'origin_location'}
        title="Origin"
        onClose={close}
        saving={saving}
        onSave={() =>
          save({
            origin_country: editOriginLocation.country?.trim() || null,
            origin_state: editOriginLocation.subdivision?.trim() || null,
            origin_city: editOriginLocation.city?.trim() || null,
          })
        }
      >
        <Text
          style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 16, lineHeight: 20 }}
        >
          Setting your origin enables ethnicity and language options specific to your country.
        </Text>
        <LocationPicker value={editOriginLocation} onChange={setEditOriginLocation} />
      </EditModal>

      <EditModal
        visible={editing === 'birthdate'}
        title="Date of Birth"
        onClose={close}
        saving={saving}
        onSave={() => save({ birthdate: editDate ? editDate.toISOString().split('T')[0] : null })}
      >
        <DatePicker
          label="Date of Birth"
          value={editDate}
          onChange={setEditDate}
          placeholder="Tap to select"
        />
      </EditModal>

      <EditModal
        visible={editing === 'height'}
        title="Height"
        onClose={close}
        saving={saving}
        onSave={() => save({ height_cm: editHeight })}
      >
        <SliderPicker
          label="Height"
          value={editHeight}
          min={120}
          max={220}
          unit=""
          formatValue={(v) => `${(v / 100).toFixed(2)} m`}
          onChange={setEditHeight}
        />
      </EditModal>

      <EditModal
        visible={editing === 'weight_kg'}
        title="Weight"
        onClose={close}
        saving={saving}
        onSave={() => save({ weight_kg: editWeight })}
      >
        <SliderPicker
          label="Weight"
          value={editWeight}
          min={35}
          max={180}
          unit="kg"
          onChange={setEditWeight}
        />
      </EditModal>

      <EditModal
        visible={editing === 'ethnicity'}
        title="Ethnicity"
        onClose={close}
        saving={saving}
        onSave={() => save({ ethnicity: editText.trim() || null })}
      >
        {cultureLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : cultureEthnicityOpts.length > 0 ? (
          <MeProfileSelectList
            options={cultureEthnicityOpts.map((e) => ({ value: e, label: e }))}
            current={editText || null}
            onPick={(v) => setEditText(v ?? '')}
            withSearch
            listSearch={listSearch}
            onListSearchChange={setListSearch}
          />
        ) : needsOriginForData ? (
          <TouchableOpacity
            onPress={() => {
              close();
              setTimeout(openOriginLocation, 300);
            }}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: COLORS.emptyFieldBorder,
              backgroundColor: COLORS.emptyFieldSurface,
              padding: 18,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="flag-outline" size={28} color={COLORS.emptyField} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: COLORS.emptyField,
                textAlign: 'center',
              }}
            >
              Set your origin first
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: COLORS.textSecondary,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              Tap to set your origin country and unlock ethnicity options for your heritage.
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            <TextInput
              value={editText}
              onChangeText={setEditText}
              autoFocus
              placeholder="e.g. Yoruba, Amhara, Zulu, Habesha…"
              placeholderTextColor={COLORS.textMuted}
              style={em.input}
            />
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>
              Type your ethnicity if it{"'"}s not in the list
            </Text>
          </View>
        )}
      </EditModal>

      <EditModal
        visible={editing === 'languages'}
        title="Languages"
        onClose={close}
        saving={saving}
        onSave={() => save({ languages: editMulti })}
      >
        {cultureLoading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : cultureLanguageOpts.suggested.length > 0 || cultureLanguageOpts.all.length > 0 ? (
          <View>
            {cultureLanguageOpts.suggested.length > 0 ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={em.groupLabel}>Suggested languages</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {cultureLanguageOpts.suggested.map((lang) => {
                    const on = editMulti.includes(lang);
                    return (
                      <Pressable
                        key={lang}
                        onPress={() =>
                          setEditMulti((p) => (on ? p.filter((v) => v !== lang) : [...p, lang]))
                        }
                        style={[em.chip, on && em.chipOn]}
                      >
                        <Text style={[em.chipTxt, on && em.chipTxtOn]}>{lang}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            {cultureLanguageOpts.all.filter((l) => !cultureLanguageOpts.suggested.includes(l))
              .length > 0 ? (
              <View>
                <Text style={em.groupLabel}>More languages</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {cultureLanguageOpts.all
                    .filter((l) => !cultureLanguageOpts.suggested.includes(l))
                    .map((lang) => {
                      const on = editMulti.includes(lang);
                      return (
                        <Pressable
                          key={lang}
                          onPress={() =>
                            setEditMulti((p) => (on ? p.filter((v) => v !== lang) : [...p, lang]))
                          }
                          style={[em.chip, on && em.chipOn]}
                        >
                          <Text style={[em.chipTxt, on && em.chipTxtOn]}>{lang}</Text>
                        </Pressable>
                      );
                    })}
                </View>
              </View>
            ) : null}
          </View>
        ) : needsOriginForData ? (
          <TouchableOpacity
            onPress={() => {
              close();
              setTimeout(openOriginLocation, 300);
            }}
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: COLORS.emptyFieldBorder,
              backgroundColor: COLORS.emptyFieldSurface,
              padding: 18,
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Ionicons name="flag-outline" size={28} color={COLORS.emptyField} />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '700',
                color: COLORS.emptyField,
                textAlign: 'center',
              }}
            >
              Set your origin first
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: COLORS.textSecondary,
                textAlign: 'center',
                lineHeight: 18,
              }}
            >
              Tap to set your origin country and unlock language options for your heritage.
            </Text>
          </TouchableOpacity>
        ) : (
          <View>
            <TextInput
              value={editMulti.join(', ')}
              onChangeText={(t) =>
                setEditMulti(
                  t
                    .split(',')
                    .map((l) => l.trim())
                    .filter(Boolean),
                )
              }
              autoFocus
              placeholder="e.g. English, Amharic, French"
              placeholderTextColor={COLORS.textMuted}
              style={em.input}
            />
            <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 8 }}>
              Separate with commas
            </Text>
          </View>
        )}
      </EditModal>

      <EditModal
        visible={editing === 'occupation'}
        title="Occupation"
        onClose={close}
        saving={saving}
        onSave={() => save({ occupation: editSelect })}
      >
        <MeProfileSelectList
          options={[...OCCUPATION_OPTIONS]}
          current={editSelect}
          onPick={setEditSelect}
          withSearch
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'gender'}
        title="I am a"
        onClose={close}
        saving={saving}
        onSave={() =>
          save({
            gender: editSelect,
            interested_in: oppositeInterestedIn(editSelect as Gender),
          })
        }
      >
        <MeProfileSelectList
          options={GENDER_OPTIONS}
          current={editSelect}
          onPick={setEditSelect}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'interested_in'}
        title="Interested in"
        onClose={close}
        saving={saving}
        onSave={() => save({ interested_in: editSelect })}
      >
        <MeProfileSelectList
          options={INTERESTED_IN_OPTIONS}
          current={editSelect}
          onPick={setEditSelect}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'religion'}
        title="Religion"
        onClose={close}
        saving={saving}
        onSave={() => save({ religion: editSelect })}
      >
        <MeProfileSelectList
          options={RELIGION_OPTIONS}
          current={editSelect}
          onPick={setEditSelect}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'education'}
        title="Highest Education"
        onClose={close}
        saving={saving}
        onSave={() => save({ education: editSelect })}
      >
        <MeProfileSelectList
          options={[...EDUCATION_OPTIONS]}
          current={editSelect}
          onPick={setEditSelect}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'marital_status'}
        title="Marital Status"
        onClose={close}
        saving={saving}
        onSave={() => save({ marital_status: editSelect })}
      >
        <MeProfileSelectList
          options={MARITAL_STATUS_OPTIONS}
          current={editSelect}
          onPick={setEditSelect}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'body_type'}
        title="Body Type"
        onClose={close}
        saving={saving}
        onSave={() => save({ body_type: editSelect })}
      >
        <MeProfileSelectList
          options={[...PHYSICAL_CONDITION_OPTIONS]}
          current={editSelect}
          onPick={setEditSelect}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'want_children'}
        title="Want Children?"
        onClose={close}
        saving={saving}
        onSave={() => save({ want_children: editSelect })}
      >
        <MeProfileSelectList
          options={WANT_CHILDREN_YES_NO}
          current={editSelect}
          onPick={setEditSelect}
          listSearch={listSearch}
          onListSearchChange={setListSearch}
        />
      </EditModal>

      <EditModal
        visible={editing === 'has_children'}
        title="Has children"
        onClose={close}
        saving={saving}
        onSave={() => save({ has_children: editBool })}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {HAS_CHILDREN_OPTIONS.map((opt) => {
            const on = editBool === (opt.value === 'true');
            return (
              <Pressable
                key={opt.value}
                onPress={() => setEditBool(opt.value === 'true')}
                style={[em.bigChip, on && em.bigChipOn]}
              >
                <Text style={[em.bigChipTxt, on && em.bigChipTxtOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </EditModal>

      <EditModal
        visible={editing === 'looking_for'}
        title="Looking For"
        onClose={close}
        saving={saving}
        onSave={() => save({ looking_for: editMulti })}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {LOOKING_FOR_OPTIONS.map((opt) => {
            const on = editMulti.includes(opt.value);
            return (
              <Pressable
                key={opt.value}
                onPress={() =>
                  setEditMulti((p) => (on ? p.filter((v) => v !== opt.value) : [...p, opt.value]))
                }
                style={[em.chip, on && em.chipOn]}
              >
                <Text style={[em.chipTxt, on && em.chipTxtOn]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </EditModal>

      <EditModal
        visible={editing === 'hobbies'}
        title="Hobbies & Interests"
        onClose={close}
        saving={saving}
        onSave={() => save({ hobbies: editMulti })}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {HOBBY_OPTIONS.map((h) => {
            const on = editMulti.includes(h);
            return (
              <Pressable
                key={h}
                onPress={() => setEditMulti((p) => (on ? p.filter((v) => v !== h) : [...p, h]))}
                style={[em.chip, on && em.chipOn]}
              >
                <Text style={[em.chipTxt, on && em.chipTxtOn]}>{h}</Text>
              </Pressable>
            );
          })}
        </View>
      </EditModal>
    </>
  );
}
