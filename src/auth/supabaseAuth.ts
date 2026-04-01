import { supabase } from "../Supabase/supabaseConfig";

// Remove all auth functions - we don't need them since Firebase handles auth

// Keep only the sync function that creates/updates profiles
export const syncFirebaseToSupabaseAuth = async (firebaseUid: string, email: string, name?: string) => {
  try {
    console.log('Syncing Firebase user to Supabase profiles:', firebaseUid);
    
    // Check if user already exists in profiles
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('firebase_uid')
      .eq('firebase_uid', firebaseUid)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing user:', fetchError);
    }

    // If user exists, update their email and name
    if (existingProfile) {
      console.log('Supabase profile already exists for:', email);
      
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          email: email,
          full_name: name || null,
          updated_at: new Date().toISOString(),
        })
        .eq('firebase_uid', firebaseUid);
      
      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw updateError;
      }
      
      return { success: true, exists: true };
    }

    // Create new profile
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        firebase_uid: firebaseUid,
        email: email,
        full_name: name || null,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Error creating profile:', insertError);
      throw insertError;
    }
    
    console.log('Supabase profile created for:', email);
    return { success: true, exists: false };
  } catch (error: any) {
    console.error('Supabase sync error:', error);
    // Don't throw - just log the error
    return { success: false, error: error.message };
  }
};

// Helper to ensure profile exists (non-blocking)
export const ensureProfileExists = async (firebaseUid: string, email: string, name?: string) => {
  try {
    await syncFirebaseToSupabaseAuth(firebaseUid, email, name);
  } catch (error) {
    console.error('Failed to ensure profile:', error);
  }
};