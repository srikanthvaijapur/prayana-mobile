// services/api/bookingAPI.js
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class BookingAPI {
  async checkAvailability(activityId, date) {
    const params = new URLSearchParams({ activityId, date });
    return makeAPICall(`/bookings/check-availability?${params.toString()}`);
  }

  async createBooking(data) {
    return makeAPICall("/bookings", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async getMyBookings() {
    return makeAPICall("/bookings/my", {
      headers: await getAuthHeaders(),
    });
  }

  async getBookingById(id) {
    return makeAPICall(`/bookings/${id}`, {
      headers: await getAuthHeaders(),
    });
  }

  async cancelBooking(id, reason = null) {
    return makeAPICall(`/bookings/${id}/cancel`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason }),
    });
  }

  async submitReview(bookingId, reviewData) {
    return makeAPICall(`/bookings/${bookingId}/review`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(reviewData),
    });
  }

  // ===== Price Breakdown =====

  async calculateBreakdown({ activityId, adults, children, date, variantId, couponCode }) {
    return makeAPICall("/bookings/calculate-breakdown", {
      method: "POST",
      body: JSON.stringify({ activityId, adults, children, date, variantId, couponCode }),
    });
  }

  // ===== Payment =====

  async createPaymentOrder(bookingId, gateway = "razorpay") {
    return makeAPICall(`/bookings/${bookingId}/payment/create-order`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ gateway }),
    });
  }

  async verifyPayment(bookingId, paymentData) {
    return makeAPICall(`/bookings/${bookingId}/payment/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(paymentData),
    });
  }

  async refundPayment(bookingId, { amount, reason } = {}) {
    return makeAPICall(`/bookings/${bookingId}/payment/refund`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ amount, reason }),
    });
  }
}

export const bookingAPI = new BookingAPI();
