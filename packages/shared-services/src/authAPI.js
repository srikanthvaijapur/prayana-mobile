// authAPI.js - API functions for authentication endpoints
// Handles backend sync, profile fetching, and profile updates.

import { makeAPICall, getAuthHeaders } from './apiConfig';

/**
 * Sync the Firebase user with the backend after sign-in or sign-up.
 * The backend creates or updates the user record.
 *
 * @param {Object} userData - { uid, name, email, phone, avatar, authMethod }
 * @param {string} idToken - Firebase ID token for Authorization header
 * @returns {Promise<Object>} Backend response
 */
export async function syncUserWithBackend(userData, idToken) {
  return makeAPICall('/auth/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(userData),
  });
}

/**
 * Fetch the current user's profile from the backend.
 * Requires the auth token provider to be set via setAuthTokenProvider().
 *
 * @returns {Promise<Object>} User profile data
 */
export async function fetchUserProfile() {
  return makeAPICall('/auth/profile', {
    headers: await getAuthHeaders(),
  });
}

/**
 * Update the current user's profile on the backend.
 *
 * @param {Object} profileData - Fields to update (name, avatar, phone, etc.)
 * @returns {Promise<Object>} Updated profile data
 */
export async function updateUserProfile(profileData) {
  return makeAPICall('/auth/profile', {
    method: 'PUT',
    headers: await getAuthHeaders(),
    body: JSON.stringify(profileData),
  });
}

/**
 * Save email notification preference for the user.
 *
 * @param {Object} data - { emailOptIn: boolean, email: string }
 * @returns {Promise<Object>} Backend response
 */
export async function saveEmailPreference(data) {
  return makeAPICall('/auth/save-email-preference', {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
  });
}
