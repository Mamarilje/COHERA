import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAZSZzZalxUGM_ygoahyXBgrqEhXK2gD7o",
  authDomain: "grouptaskmanager-ac1cd.firebaseapp.com",
  projectId: "grouptaskmanager-ac1cd",
  messagingSenderId: "586147687520",
  appId: "1:586147687520:web:72cdcbd655443574b3e705",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
