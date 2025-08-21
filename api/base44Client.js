import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "687bb75a65792d5121df5f40", 
  requiresAuth: true // Ensure authentication is required for all operations
});
