import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../Firebase/firebaseConfig";
import { syncFirebaseToSupabaseAuth } from "./supabaseAuth";

export const registerUser = async (
  name: string,
  email: string,
  password: string
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = userCredential.user;

    // Store in Firebase Firestore
    await setDoc(doc(db, "users", user.uid), {
      name,
      email,
      photoURL: "",
      createdAt: serverTimestamp(),
    });

    // Sync Firebase user to Supabase profiles (non-blocking)
    syncFirebaseToSupabaseAuth(user.uid, email, name)
      .catch(error => {
        console.warn("Supabase sync warning:", error);
        // Don't throw - let registration succeed even if sync fails
      });

    return user;
  } catch (error: any) {
    // Handle specific Firebase errors
    if (error.code === "auth/email-already-in-use") {
      throw new Error("Email already in use");
    } else if (error.code === "auth/weak-password") {
      throw new Error("Password should be at least 6 characters");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Invalid email address");
    }
    throw error;
  }
};