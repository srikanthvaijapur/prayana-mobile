import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';

// ─── Constants ───────────────────────────────────────────────────────────────

const BUDGET_TIERS = [
  { key: 'budget', label: 'Budget', emoji: '\uD83D\uDCB0', description: 'Cost-effective' },
  { key: 'moderate', label: 'Moderate', emoji: '\uD83D\uDC8E', description: 'Balanced comfort' },
  { key: 'luxury', label: 'Luxury', emoji: '\uD83D\uDC51', description: 'Premium experiences' },
] as const;

const TRIP_TYPES = [
  { key: 'leisure', label: 'Leisure', icon: 'sunny-outline' as const },
  { key: 'adventure', label: 'Adventure', icon: 'compass-outline' as const },
  { key: 'cultural', label: 'Cultural', icon: 'library-outline' as const },
  { key: 'romantic', label: 'Romantic', icon: 'heart-outline' as const },
  { key: 'solo', label: 'Solo', icon: 'person-outline' as const },
  { key: 'family', label: 'Family', icon: 'people-outline' as const },
  { key: 'business', label: 'Business', icon: 'briefcase-outline' as const },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return 'Select date';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TripSetupScreen() {
  const router = useRouter();

  // Store state
  const name = useCreateTripStore((s) => s.name);
  const startDate = useCreateTripStore((s) => s.startDate);
  const endDate = useCreateTripStore((s) => s.endDate);
  const travelers = useCreateTripStore((s) => s.travelers);
  const kids = useCreateTripStore((s) => s.kids);
  const budget = useCreateTripStore((s) => s.budget);
  const tripType = useCreateTripStore((s) => s.tripType);

  // Store actions
  const setName = useCreateTripStore((s) => s.setName);
  const setDates = useCreateTripStore((s) => s.setDates);
  const setTravelers = useCreateTripStore((s) => s.setTravelers);
  const setKids = useCreateTripStore((s) => s.setKids);
  const setBudget = useCreateTripStore((s) => s.setBudget);
  const setTripType = useCreateTripStore((s) => s.setTripType);
  const setCurrentStep = useCreateTripStore((s) => s.setCurrentStep);

  // Local UI state
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Date Handlers ───

  const handleStartDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowStartPicker(false);
      }
      if (selectedDate) {
        const isoStart = selectedDate.toISOString();
        // If end date is before new start date, clear it
        const currentEnd = endDate ? new Date(endDate) : null;
        if (currentEnd && selectedDate > currentEnd) {
          setDates(isoStart, null);
        } else {
          setDates(isoStart, endDate);
        }
        setErrors((prev) => ({ ...prev, dates: '' }));
      }
    },
    [endDate, setDates]
  );

  const handleEndDateChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'android') {
        setShowEndPicker(false);
      }
      if (selectedDate) {
        setDates(startDate, selectedDate.toISOString());
        setErrors((prev) => ({ ...prev, dates: '' }));
      }
    },
    [startDate, setDates]
  );

  // ─── Counter Handlers ───

  const incrementTravelers = useCallback(() => {
    if (travelers < 20) setTravelers(travelers + 1);
  }, [travelers, setTravelers]);

  const decrementTravelers = useCallback(() => {
    if (travelers > 1) setTravelers(travelers - 1);
  }, [travelers, setTravelers]);

  const incrementKids = useCallback(() => {
    if (kids < 10) setKids(kids + 1);
  }, [kids, setKids]);

  const decrementKids = useCallback(() => {
    if (kids > 0) setKids(kids - 1);
  }, [kids, setKids]);

  // ─── Validation & Navigation ───

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name || name.trim().length === 0 || name.trim() === 'My Trip') {
      newErrors.name = 'Please give your trip a name';
    }

    if (!startDate) {
      newErrors.dates = 'Please select a start date';
    } else if (!endDate) {
      newErrors.dates = 'Please select an end date';
    } else {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        newErrors.dates = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, startDate, endDate]);

  const handleNext = useCallback(() => {
    if (validate()) {
      setCurrentStep(2);
      router.push('/trip/destinations');
    }
  }, [validate, setCurrentStep, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  // ─── Derived values ───

  const parsedStartDate = startDate ? new Date(startDate) : null;
  const parsedEndDate = endDate ? new Date(endDate) : null;
  const minimumEndDate = parsedStartDate
    ? new Date(parsedStartDate.getTime() + 86400000)
    : new Date();

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.stepIndicator}>Step 1 of 4</Text>
            <Text style={styles.headerTitle}>Trip Setup</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Step Navigation ── */}
        <View style={styles.stepNav}>
          {[
            { step: 1, label: 'Setup', route: null },
            { step: 2, label: 'Destinations', route: '/trip/destinations' },
            { step: 3, label: 'Planner', route: '/trip/planner' },
            { step: 4, label: 'Review', route: '/trip/review' },
          ].map((item, idx) => {
            const isCurrent = item.step === 1;
            const isCompleted = false; // Step 1 has nothing before it
            return (
              <React.Fragment key={item.step}>
                {idx > 0 && (
                  <View style={[styles.stepConnector, isCurrent && styles.stepConnectorActive]} />
                )}
                <TouchableOpacity
                  style={[
                    styles.stepDot,
                    isCurrent && styles.stepDotCurrent,
                  ]}
                  onPress={() => {
                    if (item.route && item.step !== 1) {
                      setCurrentStep(item.step);
                      router.push(item.route as any);
                    }
                  }}
                  disabled={isCurrent}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.stepDotText, isCurrent && styles.stepDotTextCurrent]}>
                    {item.step}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Trip Name ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trip Name</Text>
            <TextInput
              style={[styles.textInput, errors.name ? styles.inputError : null]}
              placeholder="My Adventure in..."
              placeholderTextColor={colors.textTertiary}
              value={name === 'My Trip' ? '' : name}
              onChangeText={(text) => {
                setName(text || 'My Trip');
                if (text.trim().length > 0) {
                  setErrors((prev) => ({ ...prev, name: '' }));
                }
              }}
              maxLength={100}
              returnKeyType="done"
            />
            {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
          </View>

          {/* ── Date Range ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Travel Dates</Text>
            <View style={styles.dateRow}>
              {/* Start Date */}
              <TouchableOpacity
                style={[styles.dateButton, errors.dates ? styles.inputError : null]}
                onPress={() => setShowStartPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                <View style={styles.dateTextContainer}>
                  <Text style={styles.dateLabel}>Start</Text>
                  <Text style={[styles.dateValue, !parsedStartDate && styles.datePlaceholder]}>
                    {formatDate(parsedStartDate)}
                  </Text>
                </View>
              </TouchableOpacity>

              <Ionicons
                name="arrow-forward"
                size={18}
                color={colors.textTertiary}
                style={styles.dateArrow}
              />

              {/* End Date */}
              <TouchableOpacity
                style={[styles.dateButton, errors.dates ? styles.inputError : null]}
                onPress={() => {
                  if (!startDate) {
                    Alert.alert('Start Date Required', 'Please select a start date first.');
                    return;
                  }
                  setShowEndPicker(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                <View style={styles.dateTextContainer}>
                  <Text style={styles.dateLabel}>End</Text>
                  <Text style={[styles.dateValue, !parsedEndDate && styles.datePlaceholder]}>
                    {formatDate(parsedEndDate)}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            {errors.dates ? <Text style={styles.errorText}>{errors.dates}</Text> : null}

            {parsedStartDate && parsedEndDate && (
              <View style={styles.durationBadge}>
                <Ionicons name="time-outline" size={14} color={colors.primary[600]} />
                <Text style={styles.durationText}>
                  {Math.ceil(
                    (parsedEndDate.getTime() - parsedStartDate.getTime()) / 86400000
                  ) + 1}{' '}
                  days
                </Text>
              </View>
            )}
          </View>

          {/* Date Pickers (conditionally rendered) */}
          {showStartPicker && (
            <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
              <DateTimePicker
                value={parsedStartDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={handleStartDateChange}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setShowStartPicker(false)}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          {showEndPicker && (
            <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
              <DateTimePicker
                value={parsedEndDate || minimumEndDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={minimumEndDate}
                onChange={handleEndDateChange}
              />
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={styles.iosPickerDone}
                  onPress={() => setShowEndPicker(false)}
                >
                  <Text style={styles.iosPickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Travelers Counter ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Travelers</Text>
            <View style={styles.counterRow}>
              {/* Adults */}
              <View style={styles.counterBlock}>
                <Text style={styles.counterLabel}>Adults</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={[styles.counterBtn, travelers <= 1 && styles.counterBtnDisabled]}
                    onPress={decrementTravelers}
                    disabled={travelers <= 1}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={travelers <= 1 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{travelers}</Text>
                  <TouchableOpacity
                    style={[styles.counterBtn, travelers >= 20 && styles.counterBtnDisabled]}
                    onPress={incrementTravelers}
                    disabled={travelers >= 20}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={travelers >= 20 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.counterDivider} />

              {/* Children */}
              <View style={styles.counterBlock}>
                <Text style={styles.counterLabel}>Children</Text>
                <View style={styles.counterControls}>
                  <TouchableOpacity
                    style={[styles.counterBtn, kids <= 0 && styles.counterBtnDisabled]}
                    onPress={decrementKids}
                    disabled={kids <= 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="remove"
                      size={20}
                      color={kids <= 0 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{kids}</Text>
                  <TouchableOpacity
                    style={[styles.counterBtn, kids >= 10 && styles.counterBtnDisabled]}
                    onPress={incrementKids}
                    disabled={kids >= 10}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="add"
                      size={20}
                      color={kids >= 10 ? colors.gray[300] : colors.primary[500]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>

          {/* ── Budget Tier ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Budget Tier</Text>
            <View style={styles.budgetRow}>
              {BUDGET_TIERS.map((tier) => {
                const isSelected = budget === tier.key;
                return (
                  <TouchableOpacity
                    key={tier.key}
                    style={[styles.budgetCard, isSelected && styles.budgetCardSelected]}
                    onPress={() => setBudget(tier.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.budgetEmoji}>{tier.emoji}</Text>
                    <Text style={[styles.budgetLabel, isSelected && styles.budgetLabelSelected]}>
                      {tier.label}
                    </Text>
                    <Text style={styles.budgetDesc}>{tier.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Trip Type ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Trip Type</Text>
            <View style={styles.tripTypeGrid}>
              {TRIP_TYPES.map((type) => {
                const isSelected = tripType === type.key;
                return (
                  <TouchableOpacity
                    key={type.key}
                    style={[styles.tripTypeChip, isSelected && styles.tripTypeChipSelected]}
                    onPress={() => setTripType(type.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={type.icon}
                      size={16}
                      color={isSelected ? '#ffffff' : colors.gray[600]}
                    />
                    <Text style={[styles.tripTypeLabel, isSelected && styles.tripTypeLabelSelected]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Bottom spacer for button */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Next Button (fixed at bottom) ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
            <Text style={styles.nextButtonText}>Continue to Destinations</Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  stepIndicator: {
    fontSize: fontSize.xs,
    color: colors.primary[500],
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: 2,
  },
  headerSpacer: {
    width: 40,
  },

  // Step Navigation
  stepNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[200],
  },
  stepDotCurrent: {
    backgroundColor: '#f97316',
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  stepDotText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textTertiary,
  },
  stepDotTextCurrent: {
    color: '#ffffff',
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray[200],
    marginHorizontal: spacing.xs,
    maxWidth: 50,
  },
  stepConnectorActive: {
    backgroundColor: '#f97316',
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing['3xl'],
  },

  // Sections
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },

  // Text Input
  textInput: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },

  // Date Range
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    fontWeight: fontWeight.medium,
  },
  dateValue: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: fontWeight.medium,
    marginTop: 1,
  },
  datePlaceholder: {
    color: colors.textTertiary,
  },
  dateArrow: {
    marginHorizontal: spacing.sm,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  durationText: {
    fontSize: fontSize.xs,
    color: colors.primary[600],
    fontWeight: fontWeight.semibold,
  },

  // iOS Picker
  iosPickerContainer: {
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    paddingBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iosPickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  iosPickerDoneText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },

  // Travelers Counter
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  counterBlock: {
    flex: 1,
    alignItems: 'center',
  },
  counterLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
    marginBottom: spacing.sm,
  },
  counterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  counterBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    backgroundColor: colors.background,
  },
  counterBtnDisabled: {
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },
  counterValue: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
    minWidth: 32,
    textAlign: 'center',
  },
  counterDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },

  // Budget Tier
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  budgetCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  budgetCardSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  budgetEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  budgetLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  budgetLabelSelected: {
    color: colors.primary[700],
  },
  budgetDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Trip Type
  tripTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tripTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  tripTypeChipSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  tripTypeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.gray[600],
  },
  tripTypeLabelSelected: {
    color: '#ffffff',
  },

  // Bottom Bar
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing['2xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadow.md,
  },
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
});
