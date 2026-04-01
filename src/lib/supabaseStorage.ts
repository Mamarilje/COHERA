import { supabase } from '../Supabase/supabaseConfig'

export const uploadProfilePhoto = async (firebaseUid: string, imageUri: string): Promise<string> => {
  try {
    if (!firebaseUid) {
      throw new Error('Invalid user ID');
    }
    
    if (!imageUri) {
      throw new Error('No image URI provided');
    }
    
    console.log('Uploading photo for user:', firebaseUid);
    
    // For React Native/Expo, fetch the image as a blob
    const response = await fetch(imageUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    const blob = await response.blob();
    
    // Validate blob size (limit to 5MB)
    if (blob.size > 5 * 1024 * 1024) {
      throw new Error('Image size too large. Maximum size is 5MB.');
    }
    
    const filename = `profile_${Date.now()}.jpg`;
    const path = `${firebaseUid}/profile/${filename}`;
    
    const { data, error } = await supabase.storage
      .from('photos')
      .upload(path, blob, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'image/jpeg'
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(path);

    if (!publicUrl) {
      throw new Error('Failed to get public URL for uploaded profile photo');
    }

    console.log('Upload successful, URL:', publicUrl);
    return publicUrl;
  } catch (error: any) {
    console.error('Profile photo upload error:', error);
    throw new Error(error.message || 'Failed to upload profile photo');
  }
};