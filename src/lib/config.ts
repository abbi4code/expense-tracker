// Working title — rename freely; used by the manifest, metadata and UI.
export const APP_NAME = "Expense";
export const APP_DESCRIPTION = "Log a spend in seconds. See where your money goes.";

// Routes that need a signed-in user.
export const APP_ROUTES = [
  "/home",
  "/activity",
  "/insights",
  "/settings",
  "/welcome",
  "/reset-password",
  "/groups",
  "/join",
];
// Routes only for signed-out users.
export const AUTH_ROUTES = ["/login", "/signup", "/check-email", "/forgot-password"];
