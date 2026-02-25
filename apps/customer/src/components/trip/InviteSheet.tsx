import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Share,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import BottomModal, { BottomModalRef } from '../common/BottomModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';

interface InviteSheetProps {
  sheetRef: React.RefObject<BottomModalRef | null>;
}

const InviteSheet: React.FC<InviteSheetProps> = ({ sheetRef }) => {
  const tripId = useCreateTripStore((s) => s.tripId);
  const tempTripId = useCreateTripStore((s) => s.tempTripId);
  const name = useCreateTripStore((s) => s.name);

  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);

  const activeTripId = tripId || tempTripId;
  const shareLink = activeTripId
    ? `https://prayana.ai/trip/join/${activeTripId}`
    : '';

  const handleCopyLink = useCallback(async () => {
    if (!shareLink) return;
    await Clipboard.setStringAsync(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareLink]);

  const handleNativeShare = useCallback(async () => {
    if (!shareLink) return;
    try {
      await Share.share({
        message: `Join my trip "${name || 'Untitled Trip'}" on Prayana AI!\n\n${shareLink}`,
        title: `Join Trip: ${name || 'Trip'}`,
      });
    } catch (err: any) {
      if (err.message !== 'User did not share') {
        Alert.alert('Error', 'Could not share the link');
      }
    }
  }, [shareLink, name]);

  const handleSendInvite = useCallback(() => {
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // In a real app, this would call an API to send the invite
    Alert.alert(
      'Invite Sent!',
      `An invitation has been sent to ${email.trim()}`,
      [{ text: 'OK' }]
    );
    setEmail('');
  }, [email]);

  return (
    <BottomModal ref={sheetRef}>
      <View style={styles.header}>
        <Ionicons name="people" size={20} color={colors.primary[500]} />
        <Text style={styles.headerTitle}>Invite Collaborators</Text>
        <TouchableOpacity onPress={() => sheetRef.current?.close()}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Share link */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Share Link</Text>
          <View style={styles.linkRow}>
            <View style={styles.linkBox}>
              <Ionicons name="link" size={16} color={colors.textTertiary} />
              <Text style={styles.linkText} numberOfLines={1}>
                {shareLink || 'Save trip first to generate link'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.copyBtn, copied && styles.copyBtnCopied]}
              onPress={handleCopyLink}
              disabled={!shareLink}
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={16}
                color={copied ? colors.success : colors.primary[500]}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Native share */}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleNativeShare}
          disabled={!shareLink}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={18} color="#ffffff" />
          <Text style={styles.shareBtnText}>Share via...</Text>
        </TouchableOpacity>

        {/* Email invite */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Invite by Email</Text>
          <View style={styles.emailRow}>
            <TextInput
              style={styles.emailInput}
              value={email}
              onChangeText={setEmail}
              placeholder="friend@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={handleSendInvite}
              activeOpacity={0.7}
            >
              <Ionicons name="send" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary[500]} />
          <Text style={styles.infoText}>
            Collaborators can edit activities, add notes, and chat in real-time. Maximum 10 users.
          </Text>
        </View>
      </View>
    </BottomModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  content: { padding: spacing.lg, gap: spacing.lg },
  section: { gap: spacing.sm },
  sectionLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  linkBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkText: { flex: 1, fontSize: fontSize.xs, color: colors.textTertiary },
  copyBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    backgroundColor: colors.primary[50],
  },
  copyBtnCopied: { borderColor: colors.success, backgroundColor: colors.successLight },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    ...shadow.md,
  },
  shareBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#ffffff' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  emailInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
  },
  infoText: { flex: 1, fontSize: fontSize.xs, color: colors.primary[600], lineHeight: 18 },
});

export default InviteSheet;
