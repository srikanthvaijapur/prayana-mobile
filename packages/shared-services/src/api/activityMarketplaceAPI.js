// services/api/activityMarketplaceAPI.js
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class ActivityMarketplaceAPI {
  // ===== PUBLIC ROUTES =====

  async searchActivities(filters = {}) {
    const params = new URLSearchParams(filters);
    return makeAPICall(`/activities/search?${params.toString()}`);
  }

  async getFeaturedActivities(limit = 8) {
    return makeAPICall(`/activities/featured?limit=${limit}`);
  }

  async getCategories() {
    return makeAPICall("/activities/categories");
  }

  async getActivityById(id) {
    return makeAPICall(`/activities/${id}`);
  }

  async getActivityReviews(id, page = 1, sort = "newest") {
    return makeAPICall(`/activities/${id}/reviews?page=${page}&sort=${sort}`);
  }

  async getSimilarActivities(id) {
    return makeAPICall(`/activities/${id}/similar`);
  }

  async voteReviewHelpful(reviewId) {
    return makeAPICall(`/reviews/${reviewId}/helpful`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  // ===== BUSINESS-PROTECTED ROUTES =====

  async createListing(data) {
    return makeAPICall("/activities", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
      timeout: 30000,
    });
  }

  async getMyListings(status) {
    const params = status ? `?status=${status}` : "";
    return makeAPICall(`/activities/my${params}`, {
      headers: await getAuthHeaders(),
    });
  }

  async submitForApproval(id) {
    return makeAPICall(`/activities/${id}/submit-for-approval`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  async updateListing(id, data) {
    return makeAPICall(`/activities/${id}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async deleteListing(id) {
    return makeAPICall(`/activities/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  async toggleListingStatus(id, status) {
    return makeAPICall(`/activities/${id}/status`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
  }

  async uploadImages(id, imageUrls) {
    return makeAPICall(`/activities/${id}/images`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ imageUrls }),
    });
  }

  async uploadImageFiles(id, formData) {
    // FormData with "images" field -- browser/RN sets Content-Type with boundary
    return makeAPICall(`/activities/${id}/images`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });
  }

  async removeImage(id, imgId) {
    return makeAPICall(`/activities/${id}/images/${imgId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  async updateAvailability(id, schedule) {
    return makeAPICall(`/activities/${id}/availability`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ schedule }),
    });
  }

  // ===== ACTIVITY TYPE CONFIG =====

  async getActivityTypeConfigs() {
    return makeAPICall("/activity-type-config");
  }

  async getActivityTypeConfig(categoryKey) {
    return makeAPICall(`/activity-type-config/${encodeURIComponent(categoryKey)}`);
  }

  async getRequiredDocuments(categoryKey) {
    return makeAPICall(`/activity-type-config/${encodeURIComponent(categoryKey)}/documents`);
  }

  async validateTypeFields(categoryKey, fields) {
    return makeAPICall("/activity-type-config/validate", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ categoryKey, fields }),
    });
  }
}

export const activityMarketplaceAPI = new ActivityMarketplaceAPI();
