// hooks/useItineraryGeneration.js - Updated with both setInitialMarkdownData and setInitialStructuredData
import { useState, useCallback, useRef } from 'react';
// TODO: Migrate itineraryAPI to shared-services
const itineraryAPI = { generateItinerary: async () => null, generateStructuredItinerary: async () => null };

export const useItineraryGeneration = () => {
  const [markdownData, setMarkdownData] = useState(null);
  const [structuredData, setStructuredData] = useState(null);
  const [loadingStates, setLoadingStates] = useState({
    markdown: false,
    structured: false
  });
  const [errors, setErrors] = useState({});

  // Use refs to prevent stale closures
  const abortControllers = useRef({});

  const setLoading = useCallback((type, loading) => {
    setLoadingStates(prev => ({ ...prev, [type]: loading }));
  }, []);

  const setError = useCallback((type, error) => {
    setErrors(prev => ({ ...prev, [type]: error }));
  }, []);

  const clearError = useCallback((type) => {
    setErrors(prev => ({ ...prev, [type]: null }));
  }, []);

  const abortRequest = useCallback((type) => {
    if (abortControllers.current[type]) {
      abortControllers.current[type].abort();
      delete abortControllers.current[type];
    }
  }, []);

  // Method to set initial markdown data without API call
  const setInitialMarkdownData = useCallback((data) => {
    console.log('Setting initial markdown data in hook');
    setMarkdownData(data);
  }, []);

  // Method to set initial structured data without API call
  const setInitialStructuredData = useCallback((data) => {
    console.log('Setting initial structured data in hook');
    setStructuredData(data);
  }, []);

  const generateMarkdown = useCallback(async (requestData) => {
    // Abort any existing request
    abortRequest('markdown');

    // Create new abort controller for this request
    abortControllers.current.markdown = new AbortController();

    setLoading('markdown', true);
    clearError('markdown');

    try {
      const result = await itineraryAPI.generateMarkdownItinerary(requestData);
      console.log('Markdown generation completed:', result);
      setMarkdownData(result);
      return result;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Markdown generation failed:', error);
        setError('markdown', error.message);
      }
      throw error;
    } finally {
      setLoading('markdown', false);
      delete abortControllers.current.markdown;
    }
  }, [setLoading, clearError, setError, abortRequest]);

  const generateStructured = useCallback(async (requestData) => {
    // Abort any existing request
    abortRequest('structured');

    // Create new abort controller for this request
    abortControllers.current.structured = new AbortController();

    setLoading('structured', true);
    clearError('structured');

    try {
      const result = await itineraryAPI.generateStructuredItinerary(requestData);
      console.log('Structured generation completed:', result);
      setStructuredData(result);
      return result;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Structured generation failed:', error);
        setError('structured', error.message);
      }
      throw error;
    } finally {
      setLoading('structured', false);
      delete abortControllers.current.structured;
    }
  }, [setLoading, clearError, setError, abortRequest]);

  const retry = useCallback(async (type, requestData) => {
    if (type === 'markdown') {
      return generateMarkdown(requestData);
    } else if (type === 'structured') {
      return generateStructured(requestData);
    }
  }, [generateMarkdown, generateStructured]);

  const reset = useCallback(() => {
    // Abort all requests
    Object.keys(abortControllers.current).forEach(type => {
      abortRequest(type);
    });

    setMarkdownData(null);
    setStructuredData(null);
    setLoadingStates({ markdown: false, structured: false });
    setErrors({});
  }, [abortRequest]);

  return {
    markdownData,
    structuredData,
    loadingStates,
    errors,
    generateMarkdown,
    generateStructured,
    setInitialMarkdownData,
    setInitialStructuredData,
    retry,
    reset,
    isLoading: loadingStates.markdown || loadingStates.structured
  };
};

export const useItineraryActions = () => {
  const [bookmarkStates, setBookmarkStates] = useState({});
  const [shareStates, setShareStates] = useState({});

  const toggleBookmark = useCallback(async (itineraryId, isCurrentlyBookmarked = false) => {
    setBookmarkStates(prev => ({ ...prev, [itineraryId]: 'loading' }));

    try {
      const action = isCurrentlyBookmarked ? 'remove' : 'add';
      await itineraryAPI.toggleBookmark(itineraryId, action);

      setBookmarkStates(prev => ({
        ...prev,
        [itineraryId]: isCurrentlyBookmarked ? 'removed' : 'added'
      }));

      return !isCurrentlyBookmarked;
    } catch (error) {
      console.error('Bookmark failed:', error);
      setBookmarkStates(prev => ({ ...prev, [itineraryId]: 'error' }));
      throw error;
    }
  }, []);

  const shareItinerary = useCallback(async (itinerary) => {
    const shareId = itinerary.itineraryId || itinerary.markdownItineraryId;
    setShareStates(prev => ({ ...prev, [shareId]: 'loading' }));

    try {
      const shareData = {
        title: itinerary.title || `${itinerary.duration}-Day ${itinerary.destination} Trip`,
        text: itinerary.subtitle || `Check out this amazing ${itinerary.duration}-day trip to ${itinerary.destination}!`,
        url: `${window.location.origin}/itinerary/${shareId}`
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        setShareStates(prev => ({ ...prev, [shareId]: 'shared' }));
      } else {
        // Fallback to clipboard
        await navigator.clipboard.writeText(shareData.url);
        setShareStates(prev => ({ ...prev, [shareId]: 'copied' }));
      }

      // Reset state after 3 seconds
      setTimeout(() => {
        setShareStates(prev => ({ ...prev, [shareId]: null }));
      }, 3000);

    } catch (error) {
      console.error('Share failed:', error);
      setShareStates(prev => ({ ...prev, [shareId]: 'error' }));

      // Reset error state after 3 seconds
      setTimeout(() => {
        setShareStates(prev => ({ ...prev, [shareId]: null }));
      }, 3000);
    }
  }, []);

  const copyMarkdown = useCallback(async (markdown) => {
    try {
      await navigator.clipboard.writeText(markdown);
      return true;
    } catch (error) {
      console.error('Copy failed:', error);
      return false;
    }
  }, []);

  return {
    bookmarkStates,
    shareStates,
    toggleBookmark,
    shareItinerary,
    copyMarkdown
  };
};

export const useTabSystem = (initialTab = 'markdown', onTabChange) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [transitionState, setTransitionState] = useState('idle');

  const changeTab = useCallback(async (newTab) => {
    if (newTab === activeTab) return;

    setTransitionState('changing');

    // Call external handler if provided
    if (onTabChange) {
      await onTabChange(newTab, activeTab);
    }

    setActiveTab(newTab);

    // Small delay for smooth transition
    setTimeout(() => {
      setTransitionState('idle');
    }, 150);
  }, [activeTab, onTabChange]);

  return {
    activeTab,
    transitionState,
    changeTab,
    isTransitioning: transitionState === 'changing'
  };
};
