import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { colors, fontSize, fontWeight, spacing, shadow, useTheme } from '@prayana/shared-ui';
import { destinationAPI } from '@prayana/shared-services';
import { resolveImageUrl, getPlaceImageUrl } from '@prayana/shared-utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.xl * 2 - 12) / 2;

interface NearbyTabProps {
  placeName: string;
  location: string;
}

export const NearbyTab: React.FC<NearbyTabProps> = ({ placeName, location }) => {
  const { themeColors, isDarkMode } = useTheme();
  const router = useRouter();
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNearby = async () => {
      try {
        setLoading(true);
        const res = await destinationAPI.getNearbyPlaces(placeName, location);
        const places = res?.data || res?.places || res?.nearby || (Array.isArray(res) ? res : []);
        setNearbyPlaces(Array.isArray(places) ? places : []);
      } catch (err: any) {
        console.warn('[Nearby] Error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchNearby();
  }, [placeName, location]);

  const handlePlacePress = (place: any) => {
    const preview = JSON.stringify({
      name: place.name,
      category: place.category || '',
      rating: place.rating || null,
      shortDescription: place.shortDescription || '',
      image: getPlaceImageUrl(place) || '',
    });
    router.push({
      pathname: '/destination/[location]/[place]',
      params: { location, place: place.name, preview },
    } as any);
  };

  const getImageUri = (place: any): string | null => {
    const url = getPlaceImageUrl(place);
    return url || resolveImageUrl(place.image) || resolveImageUrl(place.imageUrls?.[0]) || null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Finding nearby places...
        </Text>
      </View>
    );
  }

  if (nearbyPlaces.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="location-outline" size={48} color={themeColors.textTertiary} />
        <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
          No nearby places found
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Ionicons name="location" size={20} color={colors.primary[500]} />
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
          Nearby Places
        </Text>
        <Text style={[styles.countBadge, { color: themeColors.textTertiary }]}>
          {nearbyPlaces.length}
        </Text>
      </View>

      <View style={styles.grid}>
        {nearbyPlaces.map((place, idx) => {
          const imageUri = getImageUri(place);
          return (
            <Pressable
              key={place.name || idx}
              style={({ pressed }) => [styles.card, shadow.md, { width: CARD_WIDTH, backgroundColor: themeColors.card }, pressed && { opacity: 0.7 }]}
              onPress={() => handlePlacePress(place)}
            >
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.cardImage} />
              ) : (
                <LinearGradient
                  colors={[colors.primary[400], colors.primary[700]]}
                  style={styles.cardImage}
                >
                  <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.5)" />
                </LinearGradient>
              )}
              {place.category && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{place.category}</Text>
                </View>
              )}
              <View style={styles.cardContent}>
                <Text style={[styles.cardName, { color: themeColors.text }]} numberOfLines={2}>
                  {place.name}
                </Text>
                {place.rating && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text style={[styles.ratingText, { color: themeColors.text }]}>
                      {Number(place.rating).toFixed(1)}
                    </Text>
                  </View>
                )}
                {place.shortDescription && (
                  <Text
                    style={[styles.cardDesc, { color: themeColors.textTertiary }]}
                    numberOfLines={2}
                  >
                    {place.shortDescription}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  loadingContainer: { paddingTop: 60, alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: fontSize.md },
  emptyContainer: { paddingTop: 60, alignItems: 'center', gap: spacing.md },
  emptyText: { fontSize: fontSize.md },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, flex: 1 },
  countBadge: { fontSize: fontSize.sm },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: spacing['2xl'],
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#ffffff' },
  cardContent: { padding: spacing.sm + 2 },
  cardName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, lineHeight: 18 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  ratingText: { fontSize: 12, fontWeight: fontWeight.semibold },
  cardDesc: { fontSize: 11, lineHeight: 16, marginTop: 4 },
});

export default NearbyTab;
