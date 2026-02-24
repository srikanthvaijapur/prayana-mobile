import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  colors,
  fontSize,
  fontWeight,
  spacing,
  shadow,
  borderRadius,
  useTheme,
} from '@prayana/shared-ui';
import { hierarchicalSearch, destinationAPI } from '@prayana/shared-services';
import {
  transformToLuxuryLayout,
  getPlaceImageUrl,
  resolveImageUrl,
  type LuxuryData,
  type LuxuryPlace,
} from '@prayana/shared-utils';

import { HeroCarousel } from '../../../components/destination/HeroCarousel';
import { ExperienceTagFilters } from '../../../components/destination/ExperienceTagFilters';
import { HeritageCircuits } from '../../../components/destination/HeritageCircuits';
import { HiddenGems } from '../../../components/destination/HiddenGems';
import { EmbeddedChatWidget } from '../../../components/destination/EmbeddedChatWidget';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;
const BENTO_SMALL_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;
const INITIAL_MORE_PLACES = 8;

// ============================================================
// Image Enrichment (matches web PWA's enrichPlacesWithImages)
// Fetches images via backend /destinations/place-images (S3 → Google Places)
// Progressive: updates UI after each batch for faster perceived loading
// ============================================================
const ENRICH_BATCH_SIZE = 3;
const ENRICH_BATCH_DELAY = 500;

function extractImageUrl(res: any): string | null {
  const images = res?.data || res?.images || (Array.isArray(res) ? res : []);
  if (images.length === 0) return null;
  const first = images[0];
  const url = first?.url || first?.imageUrl || (typeof first === 'string' ? first : null);
  return url ? (resolveImageUrl(url) || url) : null;
}

async function enrichPlacesWithImages(
  places: LuxuryPlace[],
  locationName: string,
  onBatchComplete?: (imageMap: Map<string, string>) => void,
): Promise<Map<string, string>> {
  const needsImage = places.filter((p) => !getPlaceImageUrl(p));
  if (needsImage.length === 0) return new Map();

  console.log(`[ImageEnrich] ${needsImage.length}/${places.length} places need images`);

  const imageMap = new Map<string, string>();

  for (let i = 0; i < needsImage.length; i += ENRICH_BATCH_SIZE) {
    const batch = needsImage.slice(i, i + ENRICH_BATCH_SIZE);

    await Promise.allSettled(
      batch.map((place) =>
        destinationAPI.getPlaceImages(place.name, locationName, 1)
          .then((res: any) => {
            const url = extractImageUrl(res);
            if (url) imageMap.set(place.name, url);
          })
          .catch(() => {}) // silently skip failed fetches
      )
    );

    // Progressively update UI after each batch
    if (onBatchComplete && imageMap.size > 0) {
      onBatchComplete(new Map(imageMap));
    }

    // Short delay between batches to avoid hammering the server
    if (i + ENRICH_BATCH_SIZE < needsImage.length) {
      await new Promise((r) => setTimeout(r, ENRICH_BATCH_DELAY));
    }
  }

  console.log(`[ImageEnrich] Fetched ${imageMap.size}/${needsImage.length} images`);
  return imageMap;
}

// ============================================================
// Shimmer Loading Skeleton
// ============================================================
const ShimmerBlock = ({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: any;
}) => {
  const animValue = React.useRef(new Animated.Value(0)).current;
  const { isDarkMode } = useTheme();

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animValue]);

  const bg = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: isDarkMode
      ? ['#1F2937', '#374151']
      : ['#E5E7EB', '#F3F4F6'],
  });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: 12, backgroundColor: bg },
        style,
      ]}
    />
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function LocationSearchResults() {
  const router = useRouter();
  const { location } = useLocalSearchParams<{ location: string }>();
  const { themeColors, isDarkMode } = useTheme();

  const [luxuryData, setLuxuryData] = useState<LuxuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filteredTag, setFilteredTag] = useState('all');
  const [showAllPlaces, setShowAllPlaces] = useState(false);

  const locationName = location || '';

  // ----------------------------------------------------------
  // Image enrichment helper (shared by streaming & fallback)
  // ----------------------------------------------------------
  const applyImageMap = useCallback((imgMap: Map<string, string>) => {
    const enrichPlace = (p: LuxuryPlace) => {
      const url = imgMap.get(p.name);
      return url ? { ...p, image: url, imageUrls: [url] } : p;
    };
    const enrichCircuits = (circuits: Record<string, LuxuryPlace[]>) => {
      const result: Record<string, LuxuryPlace[]> = {};
      for (const [key, places] of Object.entries(circuits)) {
        result[key] = places.map(enrichPlace);
      }
      return result;
    };
    setLuxuryData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        crownJewels: prev.crownJewels.map(enrichPlace),
        hiddenGems: prev.hiddenGems.map(enrichPlace),
        allPlaces: prev.allPlaces.map(enrichPlace),
        administrativeCircuits: enrichCircuits(prev.administrativeCircuits),
        dynamicCircuits: enrichCircuits(prev.dynamicCircuits),
      };
    });
  }, []);

  // Enrich images for a set of places (priority crown jewels, then rest)
  const startImageEnrichment = useCallback(
    (transformed: LuxuryData) => {
      const crownNames = new Set(transformed.crownJewels.map((p) => p.name));
      const priorityPlaces = transformed.crownJewels.filter((p) => !getPlaceImageUrl(p));
      const restPlaces = (transformed.allPlaces || []).filter(
        (p) => !crownNames.has(p.name) && !getPlaceImageUrl(p)
      );

      enrichPlacesWithImages(priorityPlaces, locationName, applyImageMap)
        .then(() => enrichPlacesWithImages(restPlaces, locationName, applyImageMap))
        .catch((err) => {
          console.warn('[ImageEnrich] Background enrichment failed:', err.message);
        });
    },
    [locationName, applyImageMap]
  );

  // ----------------------------------------------------------
  // Data Fetching — hierarchicalSearch API
  // Uses POST /destinations/hierarchical-search (correct endpoint)
  // Note: streamingSearch uses the older /destinations/search endpoint
  // which returns different data format — not compatible with luxuryLayout
  // ----------------------------------------------------------
  const isFetchingRef = useRef(false);

  const fetchPlaces = useCallback(
    async (isRefresh = false) => {
      if (!locationName) return;
      if (isFetchingRef.current && !isRefresh) return; // Prevent duplicate fetches
      isFetchingRef.current = true;

      if (!isRefresh) setLoading(true);
      setError(null);

      try {
        const response = await hierarchicalSearch(locationName, {}, { timeout: 60000 });
        const transformed = transformToLuxuryLayout(response);

        if (transformed) {
          setLuxuryData(transformed);
          setLoading(false);
          setRefreshing(false);
          startImageEnrichment(transformed);
        } else {
          setLuxuryData(null);
          setError('No places found. Try a different destination.');
          setLoading(false);
          setRefreshing(false);
        }
      } catch (err: any) {
        console.error('[LocationSearch] Hierarchical search error:', err);
        setError(err.message || 'Failed to search. Please try again.');
        setLoading(false);
        setRefreshing(false);
      } finally {
        isFetchingRef.current = false;
      }
    },
    [locationName, startImageEnrichment]
  );

  useEffect(() => {
    fetchPlaces();
  }, [fetchPlaces]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPlaces(true);
  }, [fetchPlaces]);

  // ----------------------------------------------------------
  // Navigation
  // ----------------------------------------------------------
  const isNavigatingRef = useRef(false);

  const handlePlacePress = useCallback(
    (place: any) => {
      if (!place?.name) return;
      if (isNavigatingRef.current) return; // Prevent rapid double-tap
      isNavigatingRef.current = true;
      setTimeout(() => { isNavigatingRef.current = false; }, 1000);

      const pName = String(place.name).trim();
      const loc = String(locationName).trim();
      // Pass essential place data so the detail page can render instantly
      const preview = JSON.stringify({
        name: place.name,
        category: place.category || '',
        rating: place.rating || null,
        shortDescription: place.shortDescription || place.description || '',
        image: getPlaceImageUrl(place) || '',
        duration: place.duration || '',
      });
      console.log('[Nav] Navigating to place:', pName, 'in', loc);
      router.push({
        pathname: '/destination/[location]/[place]',
        params: { location: loc, place: pName, preview },
      } as any);
    },
    [router, locationName]
  );

  // ----------------------------------------------------------
  // Filtering by Experience Tag
  // ----------------------------------------------------------
  const filterByTag = useCallback((places: LuxuryPlace[]) => {
    if (!filteredTag || filteredTag === 'all') return places;
    return places.filter((p) => {
      const tags = p.organizationData?.experienceTags || [];
      const category = (p.category || '').toLowerCase();
      return (
        tags.some((t) => t.toLowerCase() === filteredTag.toLowerCase()) ||
        category === filteredTag.toLowerCase()
      );
    });
  }, [filteredTag]);

  const filteredCrownJewels = useMemo(
    () => (luxuryData ? filterByTag(luxuryData.crownJewels) : []),
    [luxuryData, filterByTag]
  );

  const filteredAllPlaces = useMemo(
    () => (luxuryData ? filterByTag(luxuryData.allPlaces) : []),
    [luxuryData, filterByTag]
  );

  // "More places" = all places not in crown jewels
  const morePlaces = useMemo(() => {
    if (!luxuryData) return [];
    const crownNames = new Set(filteredCrownJewels.map((p) => p.name));
    return filteredAllPlaces.filter((p) => !crownNames.has(p.name));
  }, [luxuryData, filteredCrownJewels, filteredAllPlaces]);

  const visibleMorePlaces = showAllPlaces
    ? morePlaces
    : morePlaces.slice(0, INITIAL_MORE_PLACES);

  const filteredHiddenGems = useMemo(
    () => (luxuryData ? filterByTag(luxuryData.hiddenGems) : []),
    [luxuryData, filterByTag]
  );

  // ----------------------------------------------------------
  // LOADING STATE
  // ----------------------------------------------------------
  if (loading && !luxuryData) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: themeColors.background }]}
        edges={['top']}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerTitle, { color: themeColors.text }]}
              numberOfLines={1}
            >
              {locationName}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Shimmer Skeleton */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
        >
          {/* Hero skeleton */}
          <ShimmerBlock width="100%" height={280} />

          {/* Filter bar skeleton */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <ShimmerBlock width={80} height={36} />
            <ShimmerBlock width={100} height={36} />
            <ShimmerBlock width={90} height={36} />
            <ShimmerBlock width={70} height={36} />
          </View>

          {/* Section title */}
          <ShimmerBlock width={200} height={24} />

          {/* Bento grid skeleton */}
          <ShimmerBlock width="100%" height={220} />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <ShimmerBlock width={BENTO_SMALL_WIDTH} height={140} />
            <ShimmerBlock width={BENTO_SMALL_WIDTH} height={140} />
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <ShimmerBlock width={BENTO_SMALL_WIDTH} height={140} />
            <ShimmerBlock width={BENTO_SMALL_WIDTH} height={140} />
          </View>

          {/* Chat skeleton */}
          <ShimmerBlock width="100%" height={180} />

          {/* Circuits skeleton */}
          <ShimmerBlock width={180} height={24} />
          <ShimmerBlock width="100%" height={200} />
          <ShimmerBlock width="100%" height={200} />
        </ScrollView>

        {/* Bottom loading indicator */}
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBadge}>
            <ActivityIndicator size="small" color={colors.primary[500]} />
            <Ionicons name="sparkles" size={16} color={colors.primary[500]} />
            <Text style={[styles.loadingText, { color: themeColors.text }]}>
              AI discovering {locationName}...
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ----------------------------------------------------------
  // MAIN RENDER
  // ----------------------------------------------------------
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={themeColors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text
            style={[styles.headerTitle, { color: themeColors.text }]}
            numberOfLines={1}
          >
            {locationName}
          </Text>
          <View style={styles.sourceTag}>
            <Ionicons name="sparkles" size={10} color={colors.primary[500]} />
            <Text style={styles.sourceTagText}>AI Powered</Text>
          </View>
        </View>
        <Text style={[styles.resultCount, { color: themeColors.textSecondary }]}>
          {luxuryData?.allPlaces.length || 0} places
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary[500]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Error */}
        {error && !luxuryData && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
            <Text style={[styles.errorText, { color: themeColors.text }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchPlaces()}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {luxuryData && (
          <>
            {/* ============================== */}
            {/* 0. HERO CAROUSEL               */}
            {/* ============================== */}
            <HeroCarousel
              places={filteredCrownJewels}
              hero={luxuryData.hero}
              locationName={locationName}
            />

            {/* ============================== */}
            {/* 1. EXPERIENCE TAG FILTERS (STICKY) */}
            {/* ============================== */}
            <ExperienceTagFilters
              tags={luxuryData.experienceTags}
              selectedTag={filteredTag}
              onTagSelect={setFilteredTag}
            />

            {/* ============================== */}
            {/* 2. TOP PLACES — BENTO GRID     */}
            {/* ============================== */}
            {filteredCrownJewels.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    Top Places to Explore
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    Must-visit attractions in {locationName}
                  </Text>
                </View>

                {/* #1 - Large Hero Card */}
                <TouchableOpacity
                  style={[styles.bentoLarge, shadow.md]}
                  activeOpacity={0.7}
                  onPress={() => handlePlacePress(filteredCrownJewels[0])}
                >
                  {getPlaceImageUrl(filteredCrownJewels[0]) ? (
                    <Image
                      source={{ uri: getPlaceImageUrl(filteredCrownJewels[0])! }}
                      style={styles.bentoLargeImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <LinearGradient
                      colors={[colors.primary[400], colors.primary[700]]}
                      style={styles.bentoLargeImage}
                    />
                  )}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.8)']}
                    style={styles.bentoOverlay}
                  >
                    <View style={styles.bentoContent}>
                      {/* Rank Badge */}
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankBadgeText}>#1</Text>
                      </View>
                      {filteredCrownJewels[0].category && (
                        <View style={styles.categoryPill}>
                          <Text style={styles.categoryPillText}>
                            {filteredCrownJewels[0].category}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.bentoTitle} numberOfLines={2}>
                        {filteredCrownJewels[0].name}
                      </Text>
                      {filteredCrownJewels[0].shortDescription && (
                        <Text style={styles.bentoDesc} numberOfLines={2}>
                          {filteredCrownJewels[0].shortDescription}
                        </Text>
                      )}
                      <View style={styles.bentoMeta}>
                        {filteredCrownJewels[0].rating && (
                          <View style={styles.metaItem}>
                            <Ionicons name="star" size={14} color="#FBBF24" />
                            <Text style={styles.metaText}>
                              {Number(filteredCrownJewels[0].rating).toFixed(1)}
                            </Text>
                          </View>
                        )}
                        {filteredCrownJewels[0].duration && (
                          <View style={styles.metaItem}>
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color="rgba(255,255,255,0.8)"
                            />
                            <Text style={styles.metaText}>
                              {filteredCrownJewels[0].duration}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* #2-5 — 2x2 Grid */}
                {filteredCrownJewels.length > 1 && (
                  <View style={styles.bentoGrid}>
                    {filteredCrownJewels.slice(1, 5).map((place, idx) => {
                      const imageUrl = getPlaceImageUrl(place);
                      return (
                        <TouchableOpacity
                          key={place.name + idx}
                          style={[styles.bentoSmall, shadow.sm]}
                          activeOpacity={0.7}
                          onPress={() => handlePlacePress(place)}
                        >
                          {imageUrl ? (
                            <Image
                              source={{ uri: imageUrl }}
                              style={styles.bentoSmallImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <LinearGradient
                              colors={[colors.primary[300], colors.primary[600]]}
                              style={styles.bentoSmallImage}
                            />
                          )}
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.75)']}
                            style={styles.bentoSmallOverlay}
                          >
                            {/* Rank Badge */}
                            <View style={[styles.rankBadge, styles.rankBadgeSmall]}>
                              <Text style={styles.rankBadgeSmallText}>
                                #{idx + 2}
                              </Text>
                            </View>
                            {/* Rating */}
                            {place.rating && (
                              <View style={styles.smallRatingBadge}>
                                <Ionicons name="star" size={10} color="#FBBF24" />
                                <Text style={styles.smallRatingText}>
                                  {Number(place.rating).toFixed(1)}
                                </Text>
                              </View>
                            )}
                            <View style={styles.bentoSmallContent}>
                              <Text
                                style={styles.bentoSmallTitle}
                                numberOfLines={2}
                              >
                                {place.name}
                              </Text>
                              {place.category && (
                                <Text
                                  style={styles.bentoSmallCategory}
                                  numberOfLines={1}
                                >
                                  {place.category}
                                </Text>
                              )}
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* ============================== */}
            {/* 3. MORE AMAZING PLACES         */}
            {/* ============================== */}
            {morePlaces.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
                    More Amazing Places
                  </Text>
                  <Text
                    style={[
                      styles.sectionSubtitle,
                      { color: themeColors.textSecondary },
                    ]}
                  >
                    {morePlaces.length} more places to discover
                  </Text>
                </View>

                <View style={styles.morePlacesGrid}>
                  {visibleMorePlaces.map((place, idx) => {
                    const imageUrl = getPlaceImageUrl(place);
                    return (
                      <TouchableOpacity
                        key={place.name + idx}
                        style={[
                          styles.morePlaceCard,
                          shadow.sm,
                          { backgroundColor: themeColors.card },
                        ]}
                        activeOpacity={0.7}
                        onPress={() => handlePlacePress(place)}
                      >
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.morePlaceImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.morePlaceImage,
                              styles.morePlacePlaceholder,
                              {
                                backgroundColor: isDarkMode
                                  ? '#1F2937'
                                  : '#F3F4F6',
                              },
                            ]}
                          >
                            <Ionicons
                              name="image-outline"
                              size={24}
                              color={themeColors.textTertiary}
                            />
                          </View>
                        )}
                        {/* Rating badge on image */}
                        {place.rating && (
                          <View style={styles.cardRatingBadge}>
                            <Ionicons name="star" size={10} color="#FBBF24" />
                            <Text style={styles.cardRatingText}>
                              {Number(place.rating).toFixed(1)}
                            </Text>
                          </View>
                        )}
                        {place.category && (
                          <View style={styles.cardCategoryBadge}>
                            <Text style={styles.cardCategoryText}>
                              {place.category}
                            </Text>
                          </View>
                        )}
                        <View style={styles.morePlaceContent}>
                          <Text
                            style={[
                              styles.morePlaceName,
                              { color: themeColors.text },
                            ]}
                            numberOfLines={2}
                          >
                            {place.name}
                          </Text>
                          {place.shortDescription && (
                            <Text
                              style={[
                                styles.morePlaceDesc,
                                { color: themeColors.textTertiary },
                              ]}
                              numberOfLines={2}
                            >
                              {place.shortDescription}
                            </Text>
                          )}
                          {place.duration && (
                            <Text
                              style={[
                                styles.morePlaceDuration,
                                { color: themeColors.textSecondary },
                              ]}
                            >
                              {place.duration}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* View All / Show Less */}
                {morePlaces.length > INITIAL_MORE_PLACES && (
                  <TouchableOpacity
                    onPress={() => setShowAllPlaces(!showAllPlaces)}
                    style={[
                      styles.viewAllButton,
                      {
                        backgroundColor: isDarkMode ? '#1F2937' : '#FFF7ED',
                        borderColor: colors.primary[300],
                      },
                    ]}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={showAllPlaces ? 'chevron-up' : 'grid-outline'}
                      size={18}
                      color={colors.primary[500]}
                    />
                    <Text style={styles.viewAllButtonText}>
                      {showAllPlaces
                        ? 'Show Less'
                        : `View All ${morePlaces.length} Places`}
                    </Text>
                    {!showAllPlaces && (
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.primary[500]}
                      />
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ============================== */}
            {/* 4. EMBEDDED AI CHAT WIDGET     */}
            {/* ============================== */}
            <EmbeddedChatWidget locationName={locationName} />

            {/* ============================== */}
            {/* 5. HERITAGE CIRCUITS           */}
            {/* ============================== */}
            {(Object.keys(luxuryData.administrativeCircuits).length > 0 ||
              Object.keys(luxuryData.dynamicCircuits).length > 0) && (
              <HeritageCircuits
                administrativeCircuits={luxuryData.administrativeCircuits}
                dynamicCircuits={luxuryData.dynamicCircuits}
                onPlacePress={handlePlacePress}
                filteredTag={filteredTag}
              />
            )}

            {/* ============================== */}
            {/* 6. HIDDEN GEMS                 */}
            {/* ============================== */}
            {filteredHiddenGems.length > 0 && (
              <HiddenGems
                gems={filteredHiddenGems}
                onPlacePress={handlePlacePress}
                filteredTag={filteredTag}
              />
            )}

            {/* Bottom Spacer */}
            <View style={{ height: spacing['3xl'] }} />
          </>
        )}

        {/* Empty state */}
        {!loading && !error && !luxuryData && (
          <View style={styles.emptyContainer}>
            <Ionicons name="earth-outline" size={64} color={colors.gray[300]} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>
              No places found for "{locationName}"
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: themeColors.textSecondary }]}
            >
              Try a different destination name
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  backBtn: { padding: spacing.xs },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  sourceTagText: {
    fontSize: 10,
    color: colors.primary[500],
    fontWeight: fontWeight.medium,
  },
  resultCount: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // Loading Skeleton
  loadingOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  loadingText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#ffffff',
  },

  // Error
  errorContainer: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: fontSize.md,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },

  // Section
  section: {
    paddingTop: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: fontSize.sm,
  },

  // Bento Grid - Large Card (#1)
  bentoLarge: {
    height: 220,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  bentoLargeImage: { width: '100%', height: '100%' },
  bentoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing['5xl'],
  },
  bentoContent: {},
  rankBadge: {
    position: 'absolute',
    top: -60,
    left: 0,
    backgroundColor: colors.primary[500],
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  rankBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  bentoTitle: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  bentoDesc: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  bentoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: fontWeight.medium,
  },

  // Bento Grid - Small Cards (#2-5)
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  bentoSmall: {
    width: BENTO_SMALL_WIDTH,
    height: 140,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  bentoSmallImage: { width: '100%', height: '100%' },
  bentoSmallOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: spacing.sm + 2,
  },
  rankBadgeSmall: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  rankBadgeSmallText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  smallRatingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 3,
  },
  smallRatingText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  bentoSmallContent: {},
  bentoSmallTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bentoSmallCategory: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // More Places Grid
  morePlacesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  morePlaceCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  morePlaceImage: { width: '100%', height: 110 },
  morePlacePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardRatingBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 3,
  },
  cardRatingText: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  cardCategoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  cardCategoryText: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  morePlaceContent: { padding: spacing.sm + 2 },
  morePlaceName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },
  morePlaceDesc: { fontSize: fontSize.xs, marginTop: 3, lineHeight: 16 },
  morePlaceDuration: { fontSize: fontSize.xs, marginTop: 4 },

  // View All Button
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  viewAllButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[500],
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing['5xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
