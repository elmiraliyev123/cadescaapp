export const featureFlags = {
  demoMode: false,
  employeeFeatures: false,
  employerFeatures: false,
  studentFeatures: true,
  merchantPortal: true,
  adminConsole: true,
  publicUserApp: true
};

export const demoModeEnabled = featureFlags.demoMode;
export const employeeFeaturesEnabled = featureFlags.employeeFeatures;
export const employerFeaturesEnabled = featureFlags.employerFeatures;
export const employerDashboardEnabled = featureFlags.employerFeatures;
export const studentFeaturesEnabled = featureFlags.studentFeatures;
export const merchantPortalEnabled = featureFlags.merchantPortal;
export const adminConsoleEnabled = featureFlags.adminConsole;
export const publicUserAppEnabled = featureFlags.publicUserApp;
