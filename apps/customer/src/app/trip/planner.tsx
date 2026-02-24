import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { makeAPICall } from '@prayana/shared-services';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ───────────────────────────────────────────────────────────────

type TimeSlotKey = 'morning' | 'afternoon' | 'evening' | 'night';

interface TimeSlotConfig {
  key: TimeSlotKey;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
}

const TIME_SLOTS: TimeSlotConfig[] = [
  { key: 'morning', label: 'Morning', emoji: '\u2600\uFE0F', color: '#f59e0b', bgColor: '#fffbeb' },
  { key: 'afternoon', label: 'Afternoon', emoji: '\u2601\uFE0F', color: '#3b82f6', bgColor: '#eff6ff' },
  { key: 'evening', label: 'Evening', emoji: '\uD83C\uDF19', color: '#8b5cf6', bgColor: '#f5f3ff' },
  { key: 'night', label: 'Night', emoji: '\u2B50', color: '#1e3a5f', bgColor: '#f0f4f8' },
];

interface Activity {
  activityId?: string;
  name: string;
  description?: string;
  timeSlot: TimeSlotKey;
  duration?: number;
  rating?: number;
  category?: string;
  coordinates?: { lat: number; lng: number };
  image?: string;
  notes?: string;
  order?: number;
}

interface AISuggestion {
  name: string;
  description: string;
  timeSlot: TimeSlotKey;
  duration: number;
  rating: number;
  category: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActivitiesForSlot(activities: Activity[], slot: TimeSlotKey): Activity[] {
  return activities.filter((a) => a.timeSlot === slot);
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  return '\u2605'.repeat(full) + (half ? '\u00BD' : '') + '\u2606'.repeat(5 - full - half);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DayPlannerScreen() {
  const router = useRouter();

  // Store state
  const days = useCreateTripStore((s) => s.days);
  const destinations = useCreateTripStore((s) => s.destinations);
  const selectedDayIndex = useCreateTripStore((s) => s.selectedDayIndex);
  const tripType = useCreateTripStore((s) => s.tripType);
  const budget = useCreateTripStore((s) => s.budget);

  // Store actions
  const addActivity = useCreateTripStore((s) => s.addActivity);
  const removeActivity = useCreateTripStore((s) => s.removeActivity);
  const setSelectedDayIndex = useCreateTripStore((s) => s.setSelectedDayIndex);
  const setCurrentStep = useCreateTripStore((s) => s.setCurrentStep);
  const getDestinationForDay = useCreateTripStore((s) => s.getDestinationForDay);

  // Local UI state
  const [collapsedSlots, setCollapsedSlots] = useState<Record<string, boolean>>({});
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [activeSlot, setActiveSlot] = useState<TimeSlotKey>('morning');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<AISuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [showAISuggestions, setShowAISuggestions] = useState(false);

  const dayTabsRef = useRef<ScrollView>(null);

  // ─── Derived Values ───

  const currentDay = days[selectedDayIndex];
  const currentDestination = currentDay ? getDestinationForDay(selectedDayIndex) : null;
  const currentActivities: Activity[] = currentDay?.activities || [];

  const dayDate = useMemo(() => {
    if (!currentDay?.date) return '';
    const d = new Date(currentDay.date);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }, [currentDay?.date]);

  // ─── Slot Toggle ───

  const toggleSlot = useCallback((slot: TimeSlotKey) => {
    setCollapsedSlots((prev) => ({ ...prev, [slot]: !prev[slot] }));
  }, []);

  // ─── Open Search Modal ───

  const handleOpenSearch = useCallback((slot: TimeSlotKey) => {
    setActiveSlot(slot);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchModal(true);
  }, []);

  // ─── Search Activities ───

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !currentDestination) return;

    setIsSearching(true);
    try {
      const response = await makeAPICall('/trip-suggestions/activities', {
        method: 'POST',
        body: JSON.stringify({
          destination: currentDestination.name,
          dayNumber: selectedDayIndex + 1,
          timeSlot: activeSlot,
          tripType,
          existingActivities: currentActivities.map((a) => a.name),
          searchQuery: searchQuery.trim(),
        }),
        timeout: 60000,
      });

      if (response.success && Array.isArray(response.data)) {
        setSearchResults(
          response.data.map((item: any) => ({
            name: item.name || item.title || 'Activity',
            description: item.description || '',
            timeSlot: activeSlot,
            duration: item.duration || 2,
            rating: item.rating || 4.0,
            category: item.category || 'general',
          }))
        );
      } else {
        setSearchResults([]);
      }
    } catch (err) {
      console.error('Activity search failed:', err);
      Alert.alert('Search Failed', 'Could not search for activities. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, currentDestination, selectedDayIndex, activeSlot, tripType, currentActivities]);

  // ─── Add Activity From Search/AI ───

  const handleAddActivity = useCallback(
    (suggestion: AISuggestion) => {
      addActivity(selectedDayIndex, {
        name: suggestion.name,
        description: suggestion.description || '',
        timeSlot: suggestion.timeSlot || activeSlot,
        duration: suggestion.duration || 2,
        rating: suggestion.rating || 4.0,
        category: suggestion.category || 'general',
        coordinates: { lat: 0, lng: 0 },
        image: '',
        notes: '',
      });
    },
    [selectedDayIndex, activeSlot, addActivity]
  );

  // ─── Remove Activity ───

  const handleRemoveActivity = useCallback(
    (activityIndex: number) => {
      Alert.alert(
        'Remove Activity',
        'Are you sure you want to remove this activity?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => removeActivity(selectedDayIndex, activityIndex),
          },
        ]
      );
    },
    [selectedDayIndex, removeActivity]
  );

  // ─── AI Generate Suggestions ───

  const handleGenerateAI = useCallback(async () => {
    if (!currentDestination) {
      Alert.alert('No Destination', 'This day has no associated destination.');
      return;
    }

    setIsGeneratingAI(true);
    setAiSuggestions([]);
    setShowAISuggestions(true);

    try {
      const existingNames = currentActivities.map((a) => a.name);
      const dayNum = selectedDayIndex + 1;
      const destName = currentDestination.name;

      const prompt = `Suggest 5-7 activities for Day ${dayNum} in ${destName}. Trip type: ${tripType}, Budget: ${budget}. Distribute activities across morning, afternoon, evening, and night time slots. Already planned: ${existingNames.join(', ') || 'none'}. For each activity, provide: name, description (1 sentence), timeSlot (morning/afternoon/evening/night), duration in hours, rating (1-5), category. Return as JSON array.`;

      const response = await makeAPICall('/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          temperature: 0.7,
        }),
        timeout: 60000,
      });

      if (response.success && response.data) {
        let suggestions: AISuggestion[] = [];

        // Parse AI response - could be an array directly or a string needing JSON parse
        if (Array.isArray(response.data)) {
          suggestions = response.data;
        } else if (typeof response.data === 'string') {
          try {
            // Try extracting JSON array from response text
            const jsonMatch = response.data.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              suggestions = JSON.parse(jsonMatch[0]);
            }
          } catch {
            console.warn('Failed to parse AI suggestions as JSON');
          }
        } else if (response.data.suggestions && Array.isArray(response.data.suggestions)) {
          suggestions = response.data.suggestions;
        } else if (response.data.activities && Array.isArray(response.data.activities)) {
          suggestions = response.data.activities;
        }

        setAiSuggestions(
          suggestions.map((s: any) => ({
            name: s.name || s.title || 'Suggested Activity',
            description: s.description || '',
            timeSlot: (['morning', 'afternoon', 'evening', 'night'].includes(s.timeSlot)
              ? s.timeSlot
              : 'morning') as TimeSlotKey,
            duration: Number(s.duration) || 2,
            rating: Number(s.rating) || 4.0,
            category: s.category || 'general',
          }))
        );
      }
    } catch (err: any) {
      console.error('AI generation failed:', err);
      Alert.alert(
        'AI Generation Failed',
        err?.message?.includes('timeout')
          ? 'The request timed out. Please try again.'
          : 'Could not generate suggestions. Please try again.'
      );
      setShowAISuggestions(false);
    } finally {
      setIsGeneratingAI(false);
    }
  }, [currentDestination, currentActivities, selectedDayIndex, tripType, budget]);

  // ─── Navigation ───

  const handleNext = useCallback(() => {
    setCurrentStep(4);
    router.push('/trip/review');
  }, [setCurrentStep, router]);

  const handleBack = useCallback(() => {
    setCurrentStep(2);
    router.back();
  }, [setCurrentStep, router]);

  // ─── Day Tab Selection ───

  const handleDaySelect = useCallback(
    (index: number) => {
      setSelectedDayIndex(index);
      setShowAISuggestions(false);
      setAiSuggestions([]);
    },
    [setSelectedDayIndex]
  );

  // ─── Render: Day Tabs ───

  const renderDayTabs = () => (
    <ScrollView
      ref={dayTabsRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.dayTabsContent}
      style={styles.dayTabsContainer}
    >
      {days.map((day, index) => {
        const isSelected = index === selectedDayIndex;
        const actCount = day.activities?.length || 0;
        const dest = getDestinationForDay(index);
        return (
          <TouchableOpacity
            key={index}
            style={[styles.dayTab, isSelected && styles.dayTabSelected]}
            onPress={() => handleDaySelect(index)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayTabLabel, isSelected && styles.dayTabLabelSelected]}>
              Day {day.dayNumber}
            </Text>
            {dest ? (
              <Text
                style={[styles.dayTabDest, isSelected && styles.dayTabDestSelected]}
                numberOfLines={1}
              >
                {dest.name}
              </Text>
            ) : null}
            {actCount > 0 && (
              <View style={[styles.dayTabBadge, isSelected && styles.dayTabBadgeSelected]}>
                <Text style={[styles.dayTabBadgeText, isSelected && styles.dayTabBadgeTextSelected]}>
                  {actCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ─── Render: Time Slot Section ───

  const renderTimeSlot = (slot: TimeSlotConfig) => {
    const activities = getActivitiesForSlot(currentActivities, slot.key);
    const isCollapsed = collapsedSlots[slot.key];

    return (
      <View key={slot.key} style={styles.timeSlotSection}>
        {/* Section Header */}
        <TouchableOpacity
          style={[styles.timeSlotHeader, { backgroundColor: slot.bgColor }]}
          onPress={() => toggleSlot(slot.key)}
          activeOpacity={0.7}
        >
          <View style={styles.timeSlotHeaderLeft}>
            <Text style={styles.timeSlotEmoji}>{slot.emoji}</Text>
            <Text style={[styles.timeSlotLabel, { color: slot.color }]}>{slot.label}</Text>
            <View style={[styles.timeSlotCount, { backgroundColor: slot.color }]}>
              <Text style={styles.timeSlotCountText}>{activities.length}</Text>
            </View>
          </View>
          <Ionicons
            name={isCollapsed ? 'chevron-down' : 'chevron-up'}
            size={18}
            color={slot.color}
          />
        </TouchableOpacity>

        {/* Activities */}
        {!isCollapsed && (
          <View style={styles.timeSlotBody}>
            {activities.length === 0 ? (
              <View style={styles.emptySlot}>
                <Text style={styles.emptySlotText}>No activities planned</Text>
              </View>
            ) : (
              activities.map((activity, actIdx) => {
                // Find the real index in the full activities array
                const realIndex = currentActivities.findIndex(
                  (a) => a.activityId === activity.activityId
                );
                return (
                  <View key={activity.activityId || actIdx} style={styles.activityCard}>
                    {/* Image placeholder */}
                    <View style={[styles.activityImage, { backgroundColor: slot.bgColor }]}>
                      <Ionicons name="image-outline" size={24} color={slot.color} />
                    </View>
                    <View style={styles.activityContent}>
                      <Text style={styles.activityName} numberOfLines={1}>
                        {activity.name}
                      </Text>
                      {activity.description ? (
                        <Text style={styles.activityDescription} numberOfLines={2}>
                          {activity.description}
                        </Text>
                      ) : null}
                      <View style={styles.activityMeta}>
                        {activity.duration ? (
                          <View style={styles.activityMetaItem}>
                            <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                            <Text style={styles.activityMetaText}>{activity.duration}h</Text>
                          </View>
                        ) : null}
                        {activity.rating ? (
                          <View style={styles.activityMetaItem}>
                            <Ionicons name="star" size={12} color="#f59e0b" />
                            <Text style={styles.activityMetaText}>
                              {activity.rating.toFixed(1)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveActivity(realIndex >= 0 ? realIndex : actIdx)}
                      style={styles.activityDeleteBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {/* Add Activity Button */}
            <TouchableOpacity
              style={styles.addActivityBtn}
              onPress={() => handleOpenSearch(slot.key)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={18} color={colors.primary[500]} />
              <Text style={styles.addActivityText}>Add Activity</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // ─── Render: AI Suggestions Panel ───

  const renderAISuggestions = () => {
    if (!showAISuggestions) return null;

    return (
      <View style={styles.aiPanel}>
        <View style={styles.aiPanelHeader}>
          <Text style={styles.aiPanelTitle}>AI Suggestions</Text>
          <TouchableOpacity
            onPress={() => {
              setShowAISuggestions(false);
              setAiSuggestions([]);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {isGeneratingAI ? (
          <View style={styles.aiLoading}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={styles.aiLoadingText}>Generating smart suggestions...</Text>
            <Text style={styles.aiLoadingSubtext}>
              Crafting the perfect itinerary for {currentDestination?.name}
            </Text>
          </View>
        ) : aiSuggestions.length === 0 ? (
          <View style={styles.aiEmpty}>
            <Ionicons name="sparkles-outline" size={24} color={colors.textTertiary} />
            <Text style={styles.aiEmptyText}>No suggestions generated yet</Text>
          </View>
        ) : (
          <ScrollView style={styles.aiSuggestionsList} nestedScrollEnabled>
            {aiSuggestions.map((suggestion, idx) => {
              const slotConfig = TIME_SLOTS.find((s) => s.key === suggestion.timeSlot);
              return (
                <View key={idx} style={styles.aiSuggestionCard}>
                  <View style={styles.aiSuggestionContent}>
                    <View style={styles.aiSuggestionHeader}>
                      <Text style={styles.aiSuggestionName}>{suggestion.name}</Text>
                      {slotConfig && (
                        <View
                          style={[
                            styles.aiSuggestionSlotBadge,
                            { backgroundColor: slotConfig.bgColor },
                          ]}
                        >
                          <Text style={[styles.aiSuggestionSlotText, { color: slotConfig.color }]}>
                            {slotConfig.emoji} {slotConfig.label}
                          </Text>
                        </View>
                      )}
                    </View>
                    {suggestion.description ? (
                      <Text style={styles.aiSuggestionDesc} numberOfLines={2}>
                        {suggestion.description}
                      </Text>
                    ) : null}
                    <View style={styles.aiSuggestionMeta}>
                      <Text style={styles.aiSuggestionMetaItem}>
                        {suggestion.duration}h
                      </Text>
                      <Text style={styles.aiSuggestionMetaItem}>
                        {'\u2605'} {suggestion.rating.toFixed(1)}
                      </Text>
                      <Text style={styles.aiSuggestionMetaItem}>{suggestion.category}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.aiAddBtn}
                    onPress={() => handleAddActivity(suggestion)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    );
  };

  // ─── Render: Search Modal ───

  const renderSearchModal = () => (
    <Modal
      visible={showSearchModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowSearchModal(false)}
    >
      <SafeAreaView style={styles.modalSafeArea} edges={['top']}>
        {/* Modal Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowSearchModal(false)}
            style={styles.modalCloseBtn}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add Activity</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        {/* Slot Badge */}
        <View style={styles.modalSlotInfo}>
          {(() => {
            const slotConfig = TIME_SLOTS.find((s) => s.key === activeSlot);
            return slotConfig ? (
              <View style={[styles.modalSlotBadge, { backgroundColor: slotConfig.bgColor }]}>
                <Text style={{ color: slotConfig.color, fontWeight: fontWeight.medium }}>
                  {slotConfig.emoji} {slotConfig.label} - Day {(currentDay?.dayNumber || 1)}
                </Text>
              </View>
            ) : null;
          })()}
          {currentDestination && (
            <Text style={styles.modalDestName}>{currentDestination.name}</Text>
          )}
        </View>

        {/* Search Input */}
        <View style={styles.modalSearchRow}>
          <View style={styles.modalSearchInput}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.modalSearchTextInput}
              placeholder={`Search activities in ${currentDestination?.name || 'destination'}...`}
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.modalSearchBtn} onPress={handleSearch} activeOpacity={0.7}>
            <Text style={styles.modalSearchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Search Results */}
        {isSearching ? (
          <View style={styles.modalLoading}>
            <ActivityIndicator size="large" color={colors.primary[500]} />
            <Text style={styles.modalLoadingText}>Searching activities...</Text>
          </View>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item, idx) => `${item.name}-${idx}`}
            contentContainerStyle={styles.modalResultsList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalResultCard}
                onPress={() => {
                  handleAddActivity(item);
                  setShowSearchModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.modalResultContent}>
                  <Text style={styles.modalResultName}>{item.name}</Text>
                  {item.description ? (
                    <Text style={styles.modalResultDesc} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={styles.modalResultMeta}>
                    <Text style={styles.modalResultMetaItem}>{item.category}</Text>
                    <Text style={styles.modalResultMetaItem}>
                      {'\u2605'} {item.rating.toFixed(1)}
                    </Text>
                    <Text style={styles.modalResultMetaItem}>{item.duration}h</Text>
                  </View>
                </View>
                <Ionicons name="add-circle" size={28} color={colors.primary[500]} />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.modalDivider} />}
          />
        ) : (
          <View style={styles.modalEmpty}>
            <Ionicons name="search-outline" size={48} color={colors.gray[300]} />
            <Text style={styles.modalEmptyTitle}>Search for activities</Text>
            <Text style={styles.modalEmptySubtitle}>
              Find things to do in {currentDestination?.name || 'your destination'}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  if (days.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.stepIndicator}>Step 3 of 4</Text>
            <Text style={styles.headerTitle}>Day Planner</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyDays}>
          <Ionicons name="calendar-outline" size={56} color={colors.gray[300]} />
          <Text style={styles.emptyDaysTitle}>No days to plan</Text>
          <Text style={styles.emptyDaysSubtitle}>
            Go back and add destinations with durations first
          </Text>
          <TouchableOpacity style={styles.emptyDaysBtn} onPress={handleBack}>
            <Text style={styles.emptyDaysBtnText}>Back to Destinations</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.stepIndicator}>Step 3 of 4</Text>
          <Text style={styles.headerTitle}>Day Planner</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* ── Progress Bar ── */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: '75%' }]} />
      </View>

      {/* ── Day Tabs ── */}
      {renderDayTabs()}

      {/* ── Day Info ── */}
      {currentDay && (
        <View style={styles.dayInfoBar}>
          <View style={styles.dayInfoLeft}>
            <Text style={styles.dayInfoTitle}>{currentDay.title}</Text>
            {dayDate ? <Text style={styles.dayInfoDate}>{dayDate}</Text> : null}
          </View>
          <TouchableOpacity style={styles.aiButton} onPress={handleGenerateAI} activeOpacity={0.7}>
            <Ionicons name="sparkles" size={16} color="#ffffff" />
            <Text style={styles.aiButtonText}>AI Suggestions</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Main Content ── */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AI Suggestions Panel */}
        {renderAISuggestions()}

        {/* Time Slot Sections */}
        {TIME_SLOTS.map(renderTimeSlot)}

        {/* Bottom spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Bottom Bar ── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={18} color={colors.textSecondary} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextButtonText}>Review Trip</Text>
          <Ionicons name="arrow-forward" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* ── Search Modal ── */}
      {renderSearchModal()}
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

  // Day Tabs
  dayTabsContainer: {
    maxHeight: 80,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.gray[50],
  },
  dayTabsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dayTab: {
    minWidth: 80,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    position: 'relative',
  },
  dayTabSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[500],
  },
  dayTabLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  dayTabLabelSelected: {
    color: '#ffffff',
  },
  dayTabDest: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
    maxWidth: 80,
  },
  dayTabDestSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  dayTabBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.gray[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTabBadgeSelected: {
    backgroundColor: colors.primary[700],
  },
  dayTabBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  dayTabBadgeTextSelected: {
    color: '#ffffff',
  },

  // Day Info Bar
  dayInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayInfoLeft: {
    flex: 1,
    marginRight: spacing.md,
  },
  dayInfoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dayInfoDate: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 1,
  },

  // AI Button
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    ...shadow.sm,
  },
  aiButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // Time Slot Section
  timeSlotSection: {
    marginBottom: spacing.lg,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  timeSlotHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  timeSlotEmoji: {
    fontSize: 18,
  },
  timeSlotLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  timeSlotCount: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotCountText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  timeSlotBody: {
    paddingTop: spacing.sm,
    paddingLeft: spacing.sm,
  },

  // Empty Slot
  emptySlot: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  emptySlotText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  // Activity Card
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
    ...shadow.sm,
  },
  activityImage: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  activityDescription: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  activityMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  activityMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  activityMetaText: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  activityDeleteBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.errorLight,
  },

  // Add Activity Button
  addActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    borderStyle: 'dashed',
    backgroundColor: colors.primary[50],
    marginTop: spacing.xs,
  },
  addActivityText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.primary[500],
  },

  // AI Panel
  aiPanel: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  aiPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  aiPanelTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary[700],
  },
  aiLoading: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.md,
  },
  aiLoadingText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  aiLoadingSubtext: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  aiEmpty: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  aiEmptyText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  aiSuggestionsList: {
    maxHeight: 350,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  aiSuggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
    gap: spacing.md,
  },
  aiSuggestionContent: {
    flex: 1,
  },
  aiSuggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  aiSuggestionName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  aiSuggestionSlotBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  aiSuggestionSlotText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  aiSuggestionDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  aiSuggestionMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  aiSuggestionMetaItem: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  aiAddBtn: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },

  // Empty Days State
  emptyDays: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
    gap: spacing.md,
  },
  emptyDaysTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  emptyDaysSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  emptyDaysBtn: {
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[500],
    marginTop: spacing.md,
  },
  emptyDaysBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
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
  nextButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },

  // Modal
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  modalTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  modalHeaderSpacer: {
    width: 40,
  },
  modalSlotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalSlotBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  modalDestName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalSearchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  modalSearchTextInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },
  modalSearchBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  modalSearchBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#ffffff',
  },
  modalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  modalLoadingText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
  modalResultsList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  modalResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  modalResultContent: {
    flex: 1,
  },
  modalResultName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  modalResultDesc: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: 2,
    lineHeight: 16,
  },
  modalResultMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  modalResultMetaItem: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.gray[100],
  },
  modalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  modalEmptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  modalEmptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing['3xl'],
  },
});
