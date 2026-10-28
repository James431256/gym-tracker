import { createClient } from "@supabase/supabase-js";

// Set these in .env.local (see SUPABASE.md). Without them the app runs on this
// device only, saving to localStorage like before.
const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_KEY;

export const supabase = url && key ? createClient(url, key) : null;
