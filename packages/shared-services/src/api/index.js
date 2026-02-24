// services/api/index.js - CENTRALIZED API EXPORTS

// Import all API services
import { destinationAPI } from "./destinationAPI";
import { tripPlanningAPI } from "./tripPlanningAPI";
import { userAPI } from "./userAPI";

// Export individual services
export { destinationAPI, tripPlanningAPI, userAPI };

// Create the default export object for backward compatibility
const apiServices = {
  destinationAPI,
  tripPlanningAPI,
  userAPI,
};

export default apiServices;
