import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://cuztcbznvckhubsmcvuj.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1enRjYnpudmNraHVic21jdnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNTIzODksImV4cCI6MjA3ODYyODM4OX0.XnZeq-_6RvPnQgXXSRrhLJ6tEWGz70H0Vy1te91RNdY";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);