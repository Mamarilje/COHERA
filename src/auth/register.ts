import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../Firebase/firebaseConfig";

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

    // Don't store password in database for security
    await setDoc(doc(db, "users", user.uid), {
      name,
      email,
      photoURL: "",
      createdAt: serverTimestamp(),
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

