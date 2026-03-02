import { getAnalytics, logEvent, setUserId, setUserProperties } from 'firebase/analytics';
import { getAnalyticsInstance } from './firebase';

/**
 * Log a custom event to Firebase Analytics
 * @param eventName - Name of the event to log
 * @param eventParams - Optional parameters to include with the event
 */
export const logAnalyticsEvent = (eventName: string, eventParams?: Record<string, any>): void => {
  const analytics = getAnalyticsInstance();
  if (analytics) {
    logEvent(analytics, eventName, eventParams);
  }
};

/**
 * Set the user ID for analytics (call after user authentication)
 * @param userId - The unique user identifier
 */
export const setAnalyticsUserId = (userId: string): void => {
  const analytics = getAnalyticsInstance();
  if (analytics) {
    setUserId(analytics, userId);
  }
};

/**
 * Set custom user properties for analytics
 * @param properties - Key-value pairs of user properties
 */
export const setAnalyticsUserProperties = (properties: Record<string, any>): void => {
  const analytics = getAnalyticsInstance();
  if (analytics) {
    setUserProperties(analytics, properties);
  }
};

/**
 * Predefined event names for common tracking scenarios
 */
export const AnalyticsEvents = {
  // Authentication
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',

  // Dashboard interactions
  DASHBOARD_VIEW: 'dashboard_view',
  ALERT_VIEW: 'alert_view',
  ALERT_ACTION: 'alert_action',

  // Bank specific
  ACCOUNT_FREEZE: 'account_freeze',
  STR_REPORT_GENERATE: 'str_report_generate',
  NETWORK_GRAPH_VIEW: 'network_graph_view',

  // User specific
  TRANSACTION_VIEW: 'transaction_view',
  RISK_CHECK: 'risk_check',

  // Generic
  BUTTON_CLICK: 'button_click',
  PAGE_VIEW: 'page_view',
  ERROR_OCCURRED: 'error_occurred',
} as const;
