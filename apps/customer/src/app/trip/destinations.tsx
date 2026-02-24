import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { makeAPICall } from '@prayana/shared-services';
import { useDebounce } from '@prayana/shared-hooks';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResult {
  id?: string;
  name: string;
  country?: string;
  description?: string;
  image?: string;
  location?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DestinationsScreen() {
  const router = useRouter();

  // Store state
  const destinations = useCreateTripStore((s) => s.destinations);
  const startDate = useCreateTripStore((s) => s.startDate);
  const endDate = useCreateTripStore((s) => s.endDate);

  // Store actions
  const addDestination = useCreateTripStore((s) => s.addDestination);
  const removeDestination = useCreateTripStore((s) => s.removeDestination);
  const setDestinationDuration = useCreateTripStore((s) => s.setDestinationDuration);
  const setCurrentStep = useCreateTripStore((s) => s.setCurrentStep);

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef<TextInput>(null);

  // Debounced search query
  const debouncedQuery = useDebounce(searchQuery, 300);

  // ─── Derived values ───

  const totalTripDays = (() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  })();

  const assignedDays = destinations.reduce((sum, d) => sum + (d.duration || 0), 0);
  const remainingDays = totalTripDays - assignedDays;

  // ─── Search Logic ───

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    let cancelled = false;

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const response = await makeAPICall(
          `/destinations/global-autocomplete?q=${encodeURIComponent(debouncedQuery.trim())}&limit=8`
        );

        if (cancelled) return;

        if (response.success && Array.isArray(response.data)) {
          setSearchResults(response.data);
          setShowResults(true);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Destination search failed:', err);
        // Try fallback search endpoint
        try {
          const fallback = await makeAPICall('/destinations/search', {
            method: 'POST',
            body: JSON.stringify({
              location: debouncedQuery.trim(),
              page: 1,
              limit: 8,
              stream: false,
            }),
          });

          if (cancelled) return;

          if (fallback.success && Array.isArray(fallback.data)) {
            setSearchResults(
              fallback.data.map((item: any) => ({
                id: item.id,
                name: item.name || item.location || debouncedQuery,
                country: item.country || item.location || '',
                description: item.description || '',
                image: item.image || item.imageUrls?.[0] || '',
              }))
            );
            setShowResults(true);
          }
        } catch {
          // Silently fail - user can still type
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    };

    performSearch();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // ─── Handlers ───

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      // Check for duplicates
      const alreadyAdded = destinations.some(
        (d) => d.name.toLowerCase() === result.name.toLowerCase()
      );
      if (alreadyAdded) {
        setError(`${result.name} is already added`);
        setTimeout(() => setError(''), 2000);
        return;
      }

      addDestination({
        name: result.name,
        country: result.country || '',
        description: result.description || '',
        image: result.image || '',
        duration: Math.max(1, remainingDays > 0 ? Math.min(remainingDays, 2) : 1),
      });

      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
      Keyboard.dismiss();
    },
    [destinations, addDestination, remainingDays]
  );

  const handleRemoveDestination = useCallback(
    (index: number) => {
      removeDestination(index);
    },
    [removeDestination]
  );

  const handleDurationChange = useCallback(
    (index: number, delta: number) => {
      const current = destinations[index]?.duration || 1;
      const newDuration = current + delta;
      if (newDuration < 1) return;

      // Check if total doesn't exceed trip length (allow if no dates set)
      if (totalTripDays > 0) {
        const otherDays = assignedDays - current;
        if (otherDays + newDuration > totalTripDays) return;
      }

      setDestinationDuration(index, newDuration);
    },
    [destinations, totalTripDays, assignedDays, setDestinationDuration]
  );

  const handleNext = useCallback(() => {
    if (destinations.length === 0) {
      setError('Please add at least one destination');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setCurrentStep(3);
    router.push('/trip/planner');
  }, [destinations, setCurrentStep, router]);

  const handleBack = useCallback(() => {
    setCurrentStep(1);
    router.back();
  }, [setCurrentStep, router]);

  // ─── Render Search Result Item ───

  const renderSearchResult = useCallback(
    ({ item }: { item: SearchResult }) => (
      <TouchableOpacity
        style={styles.searchResultItem}
        onPress={() => handleSelectResult(item)}
        activeOpacity={0.7}
      >
        <View style={styles.searchResultIcon}>
          <Ionicons name="location" size={18} color={colors.primary[500]} />
        </View>
        <View style={styles.searchResultContent}>
          <Text style={styles.searchResultName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.country ? (
            <Text style={styles.searchResultCountry} numberOfLines={1}>
              {item.country}
            </Text>
          ) : null}
        </View>
        <Ionicons name="add-circle-outline" size={22} color={colors.primary[500]} />
      </TouchableOpacity>
    ),
    [handleSelectResult]
  );

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
            <Text style={styles.stepIndicator}>Step 2 of 4</Text>
            <Text style={styles.headerTitle}>Destinations</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* ── Progress Bar ── */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: '50%' }]} />
        </View>

        {/* ── Search Bar ── */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search destinations (e.g., Goa, Paris, Tokyo)"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (text.length >= 2) setShowResults(true);
              }}
              returnKeyType="search"
              autoCorrect={false}
            />
            {isSearching && <ActivityIndicator size="small" color={colors.primary[500]} />}
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowResults(false);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Search Results Dropdown ── */}
          {showResults && searchResults.length > 0 && (
            <View style={styles.searchDropdown}>
              <FlatList
                data={searchResults}
                renderItem={renderSearchResult}
                keyExtractor={(item, idx) => item.id || `${item.name}-${idx}`}
                keyboardShouldPersistTaps="handled"
                style={styles.searchResultsList}
                ItemSeparatorComponent={() => <View style={styles.searchDivider} />}
              />
            </View>
          )}

          {showResults && !isSearching && searchResults.length === 0 && debouncedQuery.length >= 2 && (
            <View style={styles.searchDropdown}>
              <View style={styles.noResultsContainer}>
                <Ionicons name="globe-outline" size={24} color={colors.textTertiary} />
                <Text style={styles.noResultsText}>No destinations found for "{debouncedQuery}"</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Error Message ── */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* ── Days Progress ── */}
        {totalTripDays > 0 && (
          <View style={styles.daysProgress}>
            <View style={styles.daysProgressBar}>
              <View
                style={[
                  styles.daysProgressFill,
                  {
                    width: `${Math.min((assignedDays / totalTripDays) * 100, 100)}%`,
                    backgroundColor:
                      assignedDays > totalTripDays ? colors.error : colors.primary[500],
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.daysProgressText,
                assignedDays > totalTripDays && { color: colors.error },
              ]}
            >
              {assignedDays} of {totalTripDays} days assigned
              {remainingDays > 0 ? ` (${remainingDays} remaining)` : ''}
              {remainingDays < 0 ? ` (${Math.abs(remainingDays)} over)` : ''}
            </Text>
          </View>
        )}

        {/* ── Destinations List ── */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {destinations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="map-outline" size={56} color={colors.gray[300]} />
              <Text style={styles.emptyTitle}>No destinations yet</Text>
              <Text style={styles.emptySubtitle}>
                Search and add destinations for your trip
              </Text>
            </View>
          ) : (
            destinations.map((dest, index) => (
              <View key={`${dest.name}-${index}`} style={styles.destCard}>
                <View style={styles.destCardHeader}>
                  <View style={styles.destOrderBadge}>
                    <Text style={styles.destOrderText}>{index + 1}</Text>
                  </View>
                  <View style={styles.destInfo}>
                    <Text style={styles.destName} numberOfLines={1}>
                      {dest.name}
                    </Text>
                    {dest.country ? (
                      <Text style={styles.destCountry} numberOfLines={1}>
                        {dest.country}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveDestination(index)}
                    style={styles.destRemoveBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>

                {/* Duration Editor */}
                <View style={styles.durationRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.durationLabel}>Duration</Text>
                  <View style={styles.durationControls}>
                    <TouchableOpacity
                      style={[
                        styles.durationBtn,
                        (dest.duration || 1) <= 1 && styles.durationBtnDisabled,
                      ]}
                      onPress={() => handleDurationChange(index, -1)}
                      disabled={(dest.duration || 1) <= 1}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={(dest.duration || 1) <= 1 ? colors.gray[300] : colors.primary[500]}
                      />
                    </TouchableOpacity>
                    <Text style={styles.durationValue}>
                      {dest.duration || 1} {(dest.duration || 1) === 1 ? 'day' : 'days'}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.durationBtn,
                        totalTripDays > 0 &&
                          remainingDays <= 0 &&
                          styles.durationBtnDisabled,
                      ]}
                      onPress={() => handleDurationChange(index, 1)}
                      disabled={totalTripDays > 0 && remainingDays <= 0}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={
                          totalTripDays > 0 && remainingDays <= 0
                            ? colors.gray[300]
                            : colors.primary[500]
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}

          {/* Bottom spacer */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ── Bottom Bar ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.nextButton,
              destinations.length === 0 && styles.nextButtonDisabled,
            ]}
            onPress={handleNext}
            activeOpacity={0.8}
            disabled={destinations.length === 0}
          >
            <Text style={styles.nextButtonText}>Day Planner</Text>
            <Ionicons name="arrow-forward" size={18} color="#ffffff" />
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

  // Progress Bar
  progressBar: {
    height: 3,
    backgroundColor: colors.gray[200],
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    zIndex: 10,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  searchDropdown: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xs,
    maxHeight: 280,
    ...shadow.lg,
  },
  searchResultsList: {
    maxHeight: 280,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  searchResultIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  searchResultCountry: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  searchDivider: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginHorizontal: spacing.lg,
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  noResultsText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
  },
  errorBannerText: {
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: fontWeight.medium,
  },

  // Days Progress
  daysProgress: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  daysProgressBar: {
    height: 6,
    backgroundColor: colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  daysProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  daysProgressText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Destination Card
  destCard: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  destCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  destOrderBadge: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  destOrderText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  destInfo: {
    flex: 1,
  },
  destName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  destCountry: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },
  destRemoveBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.errorLight,
  },

  // Duration Row
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    gap: spacing.sm,
  },
  durationLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  durationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  durationBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.primary[300],
    backgroundColor: colors.background,
  },
  durationBtnDisabled: {
    borderColor: colors.gray[200],
    backgroundColor: colors.gray[50],
  },
  durationValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    minWidth: 60,
    textAlign: 'center',
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing['2xl'],
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadow.md,
  },
  nextButtonDisabled: {
    backgroundColor: colors.gray[300],
  },
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
});
