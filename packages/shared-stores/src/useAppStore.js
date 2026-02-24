// stores/useAppStore.js - Main Application Store using Zustand
import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";
import { mmkvStorage } from "./storage";

const useAppStore = create()(
  devtools(
    persist(
      (set, get) => ({
        // ===== APPLICATION STATE =====
        loading: false,
        error: null,

        // Destination data
        featuredDestinations: [],
        recommendedDestinations: [],

        // User preferences (persisted)
        userPreferences: {
          theme: "light",
          language: "en",
          currency: "INR",
          currencySymbol: "\u20B9",
          country: "IN",
          countryName: "India",
          locationDetected: false,
          manuallySet: false, // Track if user manually changed country
          notifications: true,
          region: "asia", // europe, asia, americas, africa, oceania, middle-east
          isEuropean: false, // Quick flag for European countries
        },

        // App metadata
        appMetadata: {
          version: "1.0.0",
          lastUpdated: null,
          apiStatus: "online",
        },

        // ===== ACTIONS =====

        // Loading state management
        setLoading: (loading) => set({ loading }, false, "setLoading"),

        // Error state management
        setError: (error) => set({ error }, false, "setError"),

        clearError: () => set({ error: null }, false, "clearError"),

        // Destination management
        setFeaturedDestinations: (destinations) =>
          set(
            { featuredDestinations: destinations },
            false,
            "setFeaturedDestinations"
          ),

        setRecommendedDestinations: (destinations) =>
          set(
            { recommendedDestinations: destinations },
            false,
            "setRecommendedDestinations"
          ),

        // Add single destination to featured (useful for real-time updates)
        addFeaturedDestination: (destination) =>
          set(
            (state) => ({
              featuredDestinations: [
                ...state.featuredDestinations,
                destination,
              ],
            }),
            false,
            "addFeaturedDestination"
          ),

        // Remove destination from featured
        removeFeaturedDestination: (destinationId) =>
          set(
            (state) => ({
              featuredDestinations: state.featuredDestinations.filter(
                (dest) => dest.id !== destinationId
              ),
            }),
            false,
            "removeFeaturedDestination"
          ),

        // Update destination in featured list
        updateFeaturedDestination: (destinationId, updates) =>
          set(
            (state) => ({
              featuredDestinations: state.featuredDestinations.map((dest) =>
                dest.id === destinationId ? { ...dest, ...updates } : dest
              ),
            }),
            false,
            "updateFeaturedDestination"
          ),

        // User preferences management
        setUserPreferences: (preferences) =>
          set({ userPreferences: preferences }, false, "setUserPreferences"),

        updateUserPreference: (key, value) =>
          set(
            (state) => ({
              userPreferences: {
                ...state.userPreferences,
                [key]: value,
              },
            }),
            false,
            "updateUserPreference"
          ),

        // Initialize country/currency from geolocation
        // NOTE: In React Native, country/currency mapping utils must be provided externally
        initializeLocationPreferences: async (locationData) => {
          const { country } = locationData;

          if (!country) {
            console.warn("No country detected from location");
            return;
          }

          try {
            // In React Native, these utils should be injected or imported from shared-utils
            // For now, set basic location data
            set(
              (state) => ({
                userPreferences: {
                  ...state.userPreferences,
                  countryName: country,
                  locationDetected: true,
                },
              }),
              false,
              "initializeLocationPreferences"
            );

            console.log(`Auto-set location: ${country}`);
          } catch (error) {
            console.error("Failed to initialize location preferences:", error);
          }
        },

        // Manual country/currency update
        updateCountryAndCurrency: async (countryCode, currencyCode = null) => {
          try {
            set(
              (state) => ({
                userPreferences: {
                  ...state.userPreferences,
                  country: countryCode,
                  manuallySet: true,
                  ...(currencyCode ? { currency: currencyCode } : {}),
                },
              }),
              false,
              "updateCountryAndCurrency"
            );
          } catch (error) {
            console.error("Failed to update country and currency:", error);
          }
        },

        // Update currency only
        updateCurrency: async (currencyCode) => {
          try {
            set(
              (state) => ({
                userPreferences: {
                  ...state.userPreferences,
                  currency: currencyCode,
                },
              }),
              false,
              "updateCurrency"
            );
          } catch (error) {
            console.error("Failed to update currency:", error);
          }
        },

        // App metadata management
        setAppMetadata: (metadata) =>
          set({ appMetadata: metadata }, false, "setAppMetadata"),

        updateAppStatus: (status) =>
          set(
            (state) => ({
              appMetadata: {
                ...state.appMetadata,
                apiStatus: status,
                lastUpdated: new Date().toISOString(),
              },
            }),
            false,
            "updateAppStatus"
          ),

        // ===== COMPUTED/DERIVED STATE =====

        // Get all destinations combined
        getAllDestinations: () => {
          const state = get();
          return [
            ...state.featuredDestinations,
            ...state.recommendedDestinations,
          ];
        },

        // Get destination by ID
        getDestinationById: (id) => {
          const state = get();
          const allDestinations = [
            ...state.featuredDestinations,
            ...state.recommendedDestinations,
          ];
          return allDestinations.find((dest) => dest.id === id);
        },

        // Check if app is ready (has loaded initial data)
        isAppReady: () => {
          const state = get();
          return (
            !state.loading &&
            (state.featuredDestinations.length > 0 ||
              state.recommendedDestinations.length > 0)
          );
        },

        // Get app health status
        getAppHealth: () => {
          const state = get();
          return {
            hasData:
              state.featuredDestinations.length > 0 ||
              state.recommendedDestinations.length > 0,
            hasError: state.error !== null,
            isLoading: state.loading,
            apiStatus: state.appMetadata.apiStatus,
            lastUpdated: state.appMetadata.lastUpdated,
          };
        },

        // ===== UTILITY ACTIONS =====

        // Reset all data (useful for logout or data refresh)
        resetAppData: () =>
          set(
            {
              featuredDestinations: [],
              recommendedDestinations: [],
              loading: false,
              error: null,
            },
            false,
            "resetAppData"
          ),

        // Refresh data trigger
        // NOTE: In React Native, the API import path will differ.
        // This action should be overridden or the API should be injected.
        refreshData: async () => {
          const {
            setLoading,
            setError,
            setFeaturedDestinations,
            setRecommendedDestinations,
          } = get();

          try {
            setLoading(true);
            setError(null);

            // TODO: Import API from React Native services layer
            // const { destinationAPI } = await import("@prayana/shared-services");
            console.warn("refreshData: API import not configured for React Native yet");

          } catch (error) {
            console.error("Error refreshing data:", error);
            setError("Failed to refresh data");
          } finally {
            setLoading(false);
          }
        },
      }),
      {
        name: "travel-ai-app-store", // Storage key
        storage: createJSONStorage(() => mmkvStorage),
        partialize: (state) => ({
          // Only persist user preferences, not temporary data
          userPreferences: state.userPreferences,
          appMetadata: {
            version: state.appMetadata.version,
            lastUpdated: state.appMetadata.lastUpdated,
          },
        }),
        version: 2, // Store version for migrations
        migrate: (persistedState, version) => {
          if (version < 2) {
            // Migrate from version 1 to 2: add country/currency fields
            return {
              ...persistedState,
              userPreferences: {
                ...persistedState.userPreferences,
                country: "IN",
                countryName: "India",
                currencySymbol: "\u20B9",
                locationDetected: false,
              },
            };
          }
          return persistedState;
        },
      }
    ),
    {
      name: "AppStore", // DevTools name
    }
  )
);

export { useAppStore };
