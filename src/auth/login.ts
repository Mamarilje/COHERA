import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../Firebase/firebaseConfig";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { syncFirebaseToSupabaseAuth } from "./supabaseAuth";

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Ensure user document exists in Firestore
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (!userDocSnap.exists()) {
      // Create user document if it doesn't exist
      await setDoc(userDocRef, {
        name: user.displayName || email.split('@')[0],
        email: user.email,
        profileImage: user.photoURL || "",
        photoURL: user.photoURL || "",
        createdAt: serverTimestamp(),
      });
    } else {
      // Update user document with latest info
      await setDoc(userDocRef, {
        name: user.displayName || userDocSnap.data().name || email.split('@')[0],
        email: user.email,
        profileImage: user.photoURL || userDocSnap.data().profileImage || "",
        photoURL: user.photoURL || userDocSnap.data().photoURL || "",
      }, { merge: true });
    }
    
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