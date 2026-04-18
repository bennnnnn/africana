import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT, RADIUS } from '@/constants';
import { USER_REPORT_REASONS, type UserReportReason } from '@/lib/report-reasons';
import { reportUser } from '@/lib/social-actions';
import { useDialog } from '@/components/ui/DialogProvider';

type Props = {
  visible: boolean;
  onClose: () => void;
  reporterId: string;
  reportedUserId: string;
  reportedUserName: string;
};

export function ReportUserModal({
  visible,
  onClose,
  reporterId,
  reportedUserId,
  reportedUserName,
}: Props) {
  const { showToast } = useDialog();
  const [selectedReason, setSelectedReason] = useState<UserReportReason | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedReason(null);
      setShowValidation(false);
      setSubmitting(false);
    }
  }, [visible]);

  const close = () => {
    onClose();
    setSelectedReason(null);
    setShowValidation(false);
  };

  const submit = async () => {
    if (!selectedReason) {
      setShowValidation(true);
      return;
    }
    setSubmitting(true);
    try {
      const result = await reportUser(reporterId, reportedUserId, selectedReason);
      close();
      if (result === 'exists') {
        showToast({ message: 'You already reported this user', icon: 'information-circle-outline' });
      } else {
        showToast({ message: 'Report submitted. Thank you.', icon: 'checkmark-circle-outline' });
      }
    } catch {
      close();
      showToast({ message: 'Could not send report. Try again.', icon: 'alert-circle-outline' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(17,17,17,0.42)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: COLORS.white, borderRadius: RADIUS.xxl, padding: 22 }}>
          <Text style={{ fontSize: FONT.xl, fontWeight: FONT.extrabold, color: COLORS.textStrong, lineHeight: 28 }}>
            Report {reportedUserName}
          </Text>
          <Text style={{ marginTop: 8, fontSize: FONT.md, lineHeight: 22, color: COLORS.textSecondary }}>
            Select a reason. Our team will review it.
          </Text>
          <View style={{ marginTop: 18, gap: 10 }}>
            {USER_REPORT_REASONS.map((reason) => {
              const selected = selectedReason === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedReason(reason);
                    setShowValidation(false);
                  }}
                  style={{
                    minHeight: 50,
                    borderRadius: RADIUS.lg,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    backgroundColor: selected ? COLORS.successSurface : COLORS.white,
                    borderWidth: 1,
                    borderColor: selected ? COLORS.success : COLORS.border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    style={{
                      fontSize: FONT.md,
                      fontWeight: FONT.bold,
                      color: selected ? COLORS.success : COLORS.textStrong,
                    }}
                  >
                    {reason}
                  </Text>
                  {selected ? <Ionicons name="checkmark-circle" size={18} color={COLORS.success} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          {showValidation ? (
            <View
              style={{
                marginTop: 12,
                borderRadius: RADIUS.md,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: COLORS.savanna,
              }}
            >
              <Text style={{ fontSize: FONT.sm, fontWeight: FONT.bold, color: COLORS.earth }}>Select a reason</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={close}
              disabled={submitting}
              style={{
                flex: 1,
                minHeight: 50,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: COLORS.border,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.white,
              }}
            >
              <Text style={{ fontSize: FONT.md, fontWeight: FONT.bold, color: COLORS.textStrong }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => void submit()}
              disabled={submitting}
              style={{
                flex: 1,
                minHeight: 50,
                borderRadius: RADIUS.lg,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: COLORS.textStrong,
                flexDirection: 'row',
                gap: 8,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              <Ionicons name="flag-outline" size={17} color={COLORS.white} />
              <Text style={{ fontSize: FONT.md, fontWeight: FONT.bold, color: COLORS.white }}>Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
