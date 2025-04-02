// config.js - Configuration for Supabase

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// ✅ Supabase Credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ✅ Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storage: {
      getItem: key => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
      removeItem: key => localStorage.removeItem(key)
    },
    storageKey: "sb-auth"
  },
  db: { schema: "public" }
});

// ✅ Test auth status on load
(async () => {
  try {
    await supabase.from("recordings").select("*").limit(1);

    const { data: { session } } = await supabase.auth.getSession();
    console.log("Supabase initialized | Auth:", session ? "✅ Authenticated" : "⚠️ Not authenticated");

    if (import.meta.env?.MODE === "development") {
      window.supabase = supabase;
      window.getUserId = getUserId;
      window.debugAuthStatus = debugAuthStatus;
    }
  } catch (error) {
    console.error("Initialization error:", error);
    throw new Error("Supabase failed to initialize");
  }
})();

// ✅ User helpers
async function getUserId() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.id) {
      console.warn("No authenticated user");
      return null;
    }
    return user.id;
  } catch (error) {
    console.error("getUserId error:", error.message);
    return null;
  }
}

async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { id: user.id, email: user.email };
  } catch (error) {
    console.error("getCurrentUser error:", error.message);
    return null;
  }
}

async function debugAuthStatus() {
  const { data: { session } } = await supabase.auth.getSession();
  const { data: { user } } = await supabase.auth.getUser();

  return {
    session: session ? {
      expiresAt: new Date(session.expires_at * 1000),
      accessToken: session.access_token ? "****" + session.access_token.slice(-4) : null
    } : null,
    user: user ? {
      id: user.id,
      email: user.email,
      lastSignIn: new Date(user.last_sign_in_at)
    } : null
  };
}

// ✅ Debug tools for dev
if (import.meta.env?.MODE === "development") {
  window._supabase = supabase;
  window._getUserId = getUserId;
}

if (typeof window !== "undefined") {
  window._supabaseDebug = {
    auth: {
      getSession: () => supabase.auth.getSession(),
      getUser: () => supabase.auth.getUser(),
      getUserId: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        return user?.id;
      }
    },
    storage: {
      listBuckets: () => supabase.storage.listBuckets(),
      getBucket: name => supabase.storage.getBucket(name)
    }
  };
  console.log("Debug tools available via _supabaseDebug");
}

// ✅ Public exports
export { supabase, getUserId, getCurrentUser, debugAuthStatus };