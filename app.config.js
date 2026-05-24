// app.config.js — dynamic config that reads environment variables.
// This replaces app.json for builds. The static app.json is kept for
// tooling that requires it (EAS CLI, etc.) but app.config.js takes precedence.

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: 'cf1a7873-de68-4b76-9602-7958bb489c6d',
    },
  },
});
