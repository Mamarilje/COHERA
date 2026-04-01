import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../Firebase/firebaseConfig";
import { syncFirebaseToSupabaseAuth } from "./supabaseAuth";

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Sync Firebase user to Supabase profiles (non-blocking)
    syncFirebaseToSupabaseAuth(user.uid, email)
      .catch(error => {
        console.warn("Supabase sync warning:", error);
        // Don't throw - let login succeed even if sync fails
      });
    
    return user;
  } catch (error: any) {
    // Handle specific Firebase errors
    if (error.code === "auth/user-not-found") {
      throw new Error("User not found");
    } else if (error.code === "auth/wrong-password") {
      throw new Error("Incorrect password");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address");
    } else if (error.code === "auth/user-disabled") {
      throw new Error("User account has been disabled");
    }
    throw error;
  }
};