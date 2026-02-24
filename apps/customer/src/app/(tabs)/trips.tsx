import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  shadow,
  borderRadius,
  Badge,
  EmptyState,
} from '@prayana/shared-ui';
import { createTripAPI } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FILTER_TABS = ['All', 'Upcoming', 'Completed', 'Draft'] as const;
type FilterTab = (typeof FILTER_TABS)[number];

// --- Budget tier labels ---
const BUDGET_LABELS: Record<string, string> = {
  budget: 'Budget',
  moderate: 'Moderate',
  luxury: 'Luxury',
  'ultra-luxury': 'Ultra Luxury',
};

// --- Status badge config ---
const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Draft', variant: 'default' },
  planned: { label: 'Planned', variant: 'primary' },
  active: { label: 'Active', variant: 'info' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'warning' },
};

// --- Skeleton placeholder ---
function SkeletonCard() {
  return (
    <View style={[styles.tripCard, styles.skeletonCard]}>
      <View style={styles.skeletonImage} />
      <View style={styles.tripCardBody}>
        <View style={[styles.skeletonLine, { width: '70%' }]} />
        <View style={[styles.skeletonLine, { width: '50%', marginTop: spacing.sm }]} />
        <View style={[styles.skeletonLine, { width: '40%', marginTop: spacing.sm }]} />
      </View>
    </View>
  );
}

export default function TripsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');

  // --- Fetch trips ---
  const fetchTrips = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    try {
      const response = await createTripAPI.getUserTrips(user.uid);
      if (response?.success && Array.isArray(response.data)) {
        setTrips(response.data);
      } else if (Array.isArray(response)) {
        setTrips(response);
      } else {
        setTrips([]);
      }
    } catch (err) {
      console.error('[Trips] Failed to fetch:', err.message);
      Toast.show({ type: 'error', text1: 'Failed to load trips', text2: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  // --- Pull to refresh ---
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTrips();
    setRefreshing(false);
  }, [fetchTrips]);

  // --- Filter trips ---
  const filteredTrips = useMemo(() => {
    if (activeFilter === 'All') return trips;

    return trips.filter((trip) => {
      const status = (trip.status || 'draft').toLowerCase();
      switch (activeFilter) {
        case 'Upcoming': {
          if (status === 'planned' || status === 'active') return true;
          // Also check if start date is in the future
          if (trip.startDate && new Date(trip.startDate) > new Date()) return true;
          return false;
        }
        case 'Completed':
          return status === 'completed';
        case 'Draft':
          return status === 'draft';
        default:
          return true;
      }
    });
  }, [trips, activeFilter]);

  // --- Format date range ---
  const formatDateRange = useCallback((startDate, endDate) => {
    if (!startDate) return 'Dates not set';
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!end) return startStr;

    // Same month
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${startStr} - ${end.getDate()}, ${end.getFullYear()}`;
    }

    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} - ${endStr}`;
  }, []);

  // --- Navigate to trip ---
  const handleTripPress = useCallback(
    (trip) => {
      const id = trip._id || trip.tripId;
      if (id) {
        router.push(`/trip/${id}`);
      }
    },
    [router]
  );

  // --- Render trip card ---
  const renderTripCard = useCallback(
    ({ item: trip, index }) => {
      const destCount = trip.destinations?.length || 0;
      const activityCount =
        trip.days?.reduce((sum, day) => sum + (day.activities?.length || 0), 0) || 0;
      const status = (trip.status || 'draft').toLowerCase();
      const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
      const budgetLabel = BUDGET_LABELS[trip.budget] || trip.budget;

      return (
        <TouchableOpacity
          style={[styles.tripCard, shadow.md]}
          activeOpacity={0.85}
          onPress={() => handleTripPress(trip)}
        >
          {/* Cover image or gradient */}
          {trip.coverImage ? (
            <Image source={{ uri: trip.coverImage }} style={styles.tripCardImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={[colors.primary[300], colors.primary[600]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.tripCardImage}
            >
              <Text style={styles.tripCardImageEmoji}>{'\u2708\uFE0F'}</Text>
            </LinearGradient>
          )}

          {/* Status badge - positioned over image */}
          <View style={styles.statusBadgeContainer}>
            <Badge label={statusCfg.label} variant={statusCfg.variant} />
          </View>

          {/* Body */}
          <View style={styles.tripCardBody}>
            <Text style={styles.tripCardName} numberOfLines={1}>
              {trip.name || 'Untitled Trip'}
            </Text>

            <Text style={styles.tripCardDates} numberOfLines={1}>
              {formatDateRange(trip.startDate, trip.endDate)}
            </Text>

            <View style={styles.tripCardMetaRow}>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {destCount} destination{destCount !== 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.metaChip}>
                <Text style={styles.metaChipText}>
                  {activityCount} activit{activityCount !== 1 ? 'ies' : 'y'}
                </Text>
              </View>
            </View>

            {budgetLabel ? (
              <View style={styles.budgetRow}>
                <Badge label={budgetLabel} variant="primary" />
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [handleTripPress, formatDateRange]
  );

  const keyExtractor = useCallback(
    (item, index) => item._id || item.tripId || String(index),
    []
  );

  // --- Empty component ---
  const ListEmptyComponent = useMemo(() => {
    if (loading) return null;

    if (activeFilter !== 'All' && trips.length > 0) {
      return (
        <View style={styles.emptyFilterContainer}>
          <Text style={styles.emptyFilterEmoji}>{'\uD83D\uDD0D'}</Text>
          <Text style={styles.emptyFilterTitle}>No {activeFilter.toLowerCase()} trips</Text>
          <Text style={styles.emptyFilterSubtitle}>
            Try switching to a different filter or create a new trip
          </Text>
        </View>
      );
    }

    return (
      <EmptyState
        title="No trips yet"
        description="Start planning your first adventure and it will appear here."
        actionLabel="Plan Your First Trip"
        onAction={() => router.push('/trip/setup')}
      />
    );
  }, [loading, activeFilter, trips.length, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ======= HEADER ======= */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Trips</Text>
          {trips.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{trips.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ======= FILTER TABS ======= */}
      <View style={styles.filterContainer}>
        <FlatList
          data={FILTER_TABS as unknown as FilterTab[]}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: tab }) => {
            const isActive = tab === activeFilter;
            return (
              <TouchableOpacity
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ======= TRIPS LIST ======= */}
      {loading ? (
        <View style={styles.skeletonContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          renderItem={renderTripCard}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary[500]}
            />
          }
          ListEmptyComponent={ListEmptyComponent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* ======= FAB ======= */}
      <TouchableOpacity
        style={[styles.fab, shadow.lg]}
        activeOpacity={0.85}
        onPress={() => router.push('/trip/setup')}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // --- Header ---
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  countBadge: {
    marginLeft: spacing.md,
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.full,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  countBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },

  // --- Filter Tabs ---
  filterContainer: {
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  filterTabActive: {
    backgroundColor: colors.primary[500],
  },
  filterTabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
  },

  // --- List ---
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 100, // Space for FAB
  },
  separator: {
    height: spacing.lg,
  },

  // --- Trip Card ---
  tripCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  tripCardImage: {
    width: '100%',
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripCardImageEmoji: {
    fontSize: 40,
    opacity: 0.6,
  },
  statusBadgeContainer: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  tripCardBody: {
    padding: spacing.lg,
  },
  tripCardName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  tripCardDates: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  tripCardMetaRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  metaChip: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  metaChipText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  budgetRow: {
    marginTop: spacing.md,
  },

  // --- Skeleton ---
  skeletonContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  skeletonCard: {
    borderWidth: 0,
  },
  skeletonImage: {
    width: '100%',
    height: 140,
    backgroundColor: colors.gray[100],
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
  },
  skeletonLine: {
    height: 14,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.gray[100],
  },

  // --- Empty filter state ---
  emptyFilterContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyFilterEmoji: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyFilterTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyFilterSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // --- FAB ---
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    lineHeight: 30,
  },
});
