import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Card,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { saveEmailPreference } from '@prayana/shared-services';
import Toast from 'react-native-toast-message';

// ============================================================
// TYPES
// ============================================================
interface NotificationPreference {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  value: boolean;
}

interface PreferenceSection {
  title: string;
  items: NotificationPreference[];
}

// ============================================================
// NOTIFICATION TOGGLE ROW
// ============================================================
function NotificationToggleRow({
  pref,
  isLast,
  onToggle,
}: {
  pref: NotificationPreference;
  isLast: boolean;
  onToggle: (key: string, value: boolean) => void;
}) {
  return (
    <View style={[styles.toggleRow, !isLast && styles.toggleRowBorder]}>
      <View style={styles.toggleLeft}>
        <View
          style={[
            styles.toggleIcon,
            { backgroundColor: pref.iconBg },
          ]}
        >
          <Ionicons name={pref.icon} size={20} color={pref.iconColor} />
        </View>
        <View style={styles.toggleTextContainer}>
          <Text style={styles.toggleLabel}>{pref.label}</Text>
          <Text style={styles.toggleDescription}>{pref.description}</Text>
        </View>
      </View>
      <Switch
        value={pref.value}
        onValueChange={(val) => onToggle(pref.key, val)}
        trackColor={{
          false: colors.gray[200],
          true: colors.primary[300],
        }}
        thumbColor={pref.value ? colors.primary[500] : colors.gray[50]}
        ios_backgroundColor={colors.gray[200]}
      />
    </View>
  );
}

// ============================================================
// NOTIFICATIONS SCREEN
// ============================================================
export default function NotificationsScreen() {
  const { user } = useAuth();

  // --- State ---
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    pushNotifications: true,
    emailNotifications: true,
    tripReminders: true,
    bookingUpdates: true,
    marketingEmails: false,
    priceAlerts: true,
    collaborationUpdates: true,
    weeklyDigest: false,
  });

  // ============================================================
  // PREFERENCE SECTIONS
  // ============================================================
  const sections: PreferenceSection[] = [
    {
      title: 'General',
      items: [
        {
          key: 'pushNotifications',
          label: 'Push Notifications',
          description: 'Receive push notifications on your device',
          icon: 'notifications-outline',
          iconColor: colors.primary[500],
          iconBg: colors.primary[50],
          value: preferences.pushNotifications,
        },
        {
          key: 'emailNotifications',
          label: 'Email Notifications',
          description: 'Receive updates via email',
          icon: 'mail-outline',
          iconColor: '#3b82f6',
          iconBg: '#eff6ff',
          value: preferences.emailNotifications,
        },
      ],
    },
    {
      title: 'Trip & Booking',
      items: [
        {
          key: 'tripReminders',
          label: 'Trip Reminders',
          description: 'Get reminders before your upcoming trips',
          icon: 'alarm-outline',
          iconColor: '#8b5cf6',
          iconBg: '#f3f0ff',
          value: preferences.tripReminders,
        },
        {
          key: 'bookingUpdates',
          label: 'Booking Updates',
          description: 'Status changes, confirmations, and receipts',
          icon: 'ticket-outline',
          iconColor: '#059669',
          iconBg: '#ecfdf5',
          value: preferences.bookingUpdates,
        },
        {
          key: 'priceAlerts',
          label: 'Price Alerts',
          description: 'Notified when prices drop for saved activities',
          icon: 'pricetag-outline',
          iconColor: '#f59e0b',
          iconBg: '#fffbeb',
          value: preferences.priceAlerts,
        },
      ],
    },
    {
      title: 'Social & Updates',
      items: [
        {
          key: 'collaborationUpdates',
          label: 'Collaboration Updates',
          description: 'When someone edits your shared trip',
          icon: 'people-outline',
          iconColor: '#0ea5e9',
          iconBg: '#f0f9ff',
          value: preferences.collaborationUpdates,
        },
        {
          key: 'marketingEmails',
          label: 'Marketing & Promotions',
          description: 'Special offers, deals, and new features',
          icon: 'megaphone-outline',
          iconColor: '#ef4444',
          iconBg: '#fef2f2',
          value: preferences.marketingEmails,
        },
        {
          key: 'weeklyDigest',
          label: 'Weekly Digest',
          description: 'A summary of travel inspiration each week',
          icon: 'newspaper-outline',
          iconColor: colors.textSecondary,
          iconBg: colors.backgroundSecondary,
          value: preferences.weeklyDigest,
        },
      ],
    },
  ];

  // ============================================================
  // HANDLE TOGGLE
  // ============================================================
  const handleToggle = useCallback(
    async (key: string, value: boolean) => {
      // Optimistic update
      setPreferences((prev) => ({ ...prev, [key]: value }));

      if (!user?.uid) {
        Toast.show({
          type: 'error',
          text1: 'Not signed in',
          text2: 'Please sign in to save preferences.',
        });
        // Revert
        setPreferences((prev) => ({ ...prev, [key]: !value }));
        return;
      }

      setSaving(true);
      try {
        const updatedPrefs = { ...preferences, [key]: value };
        await saveEmailPreference(user.uid, updatedPrefs);

        Toast.show({
          type: 'success',
          text1: 'Saved',
          text2: `${key === 'pushNotifications' ? 'Push notifications' : sections.flatMap((s) => s.items).find((i) => i.key === key)?.label || 'Preference'} ${value ? 'enabled' : 'disabled'}.`,
          visibilityTime: 2000,
        });
      } catch (err: any) {
        console.warn('[Notifications] Failed to save preference:', err.message);
        // Revert on error
        setPreferences((prev) => ({ ...prev, [key]: !value }));
        Toast.show({
          type: 'error',
          text1: 'Save failed',
          text2: 'Could not update your preference. Please try again.',
        });
      } finally {
        setSaving(false);
      }
    },
    [user?.uid, preferences, sections]
  );

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ====== INFO BANNER ====== */}
      <View style={styles.infoBanner}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={colors.primary[500]}
        />
        <Text style={styles.infoBannerText}>
          Manage how you receive updates. Changes are saved automatically.
        </Text>
      </View>

      {/* ====== PREFERENCE SECTIONS ====== */}
      {sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Card style={styles.sectionCard}>
            {section.items.map((item, index) => (
              <NotificationToggleRow
                key={item.key}
                pref={item}
                isLast={index === section.items.length - 1}
                onToggle={handleToggle}
              />
            ))}
          </Card>
        </View>
      ))}

      {/* ====== SAVING INDICATOR ====== */}
      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color={colors.primary[500]} />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}

      {/* ====== FOOTER NOTE ====== */}
      <View style={styles.footerNote}>
        <Ionicons
          name="shield-checkmark-outline"
          size={16}
          color={colors.textTertiary}
        />
        <Text style={styles.footerNoteText}>
          You can unsubscribe from marketing emails at any time. Essential
          notifications about your bookings and account cannot be disabled.
        </Text>
      </View>
    </ScrollView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // --- Info Banner ---
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    gap: spacing.sm,
  },
  infoBannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primary[700] || colors.primary[600],
    lineHeight: 20,
  },

  // --- Sections ---
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    marginHorizontal: spacing.xl,
    paddingHorizontal: 0,
  },

  // --- Toggle Row ---
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  toggleRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
  },
  toggleLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  toggleDescription: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },

  // --- Saving Indicator ---
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  savingText: {
    fontSize: fontSize.sm,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },

  // --- Footer Note ---
  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  footerNoteText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    lineHeight: 18,
  },
});
