import { supabase } from '../Supabase/supabaseConfig'

export const syncFirebaseToSupabase = async (
  firebaseUid: string, 
  email: string, 
  name?: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        firebase_uid: firebaseUid,
        email,
        full_name: name || '',
        photo_url: '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'firebase_uid' })

    if (error) throw error
    console.log('User synced to Supabase profiles:', firebaseUid)
  } catch (error) {
    console.error('Supabase sync error:', error)
    throw new Error('Failed to sync user to Supabase')
  }
}
