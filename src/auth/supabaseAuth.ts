import { supabase } from "../Supabase/supabaseConfig";

export const supabaseLoginUser = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data.user;
  } catch (error: any) {
    throw new Error(error?.message || "Login failed with Supabase");
  }
};

export const supabaseRegisterUser = async (
  name: string,
  email: string,
  password: string
) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) throw error;
    return data.user;
  } catch (error: any) {
    throw new Error(error?.message || "Registration failed with Supabase");
  }
};

export const supabaseLogoutUser = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error: any) {
    throw new Error(error?.message || "Logout failed");
  }
};
