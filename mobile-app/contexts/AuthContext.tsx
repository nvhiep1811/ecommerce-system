import authService, { AvatarUploadAsset } from "@/services/authService";
import { User } from "@/types/user";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

interface AuthContextType {
  user: any;
  profile: User | null;
  isLoading: boolean;
  signIn: (
    email: string,
    password: string,
    rememberMe?: boolean,
  ) => Promise<{ error: string | null; profile?: User | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    otp?: string,
  ) => Promise<{ error: string | null; profile?: User | null }>;
  signInWithGoogle: () => Promise<{
    error: string | null;
    profile?: User | null;
  }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (
    updates: Partial<User>,
  ) => Promise<{ error: string | null; profile?: User | null }>;
  uploadAvatar: (
    asset: AvatarUploadAsset,
  ) => Promise<{ error: string | null; profile?: User | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const { user: currentUser } = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setProfile(currentUser);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfile = async (userId: string) => {
    const { profile } = await authService.getUserProfile(userId);
    setProfile(profile);
  };

  const signIn = async (email: string, password: string, rememberMe?: boolean) => {
    const { data, error } = await authService.signIn(email, password, rememberMe);
    if (data?.user) {
      setUser(data.user);
      setProfile(data.user);
      return { error, profile: data.user };
    }
    return { error, profile: null };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    phoneNumber?: string,
    otp?: string,
  ) => {
    const { data, error } = await authService.signUp({
      email,
      password,
      fullName,
      phoneNumber,
      otp,
    });
    if (data?.user) {
      setUser(data.user);
      setProfile(data.user);
      return { error, profile: data.user };
    }
    return { error, profile: null };
  };

  const signInWithGoogle = async () => {
    const { error } = await authService.signInWithGoogle();
    return { error, profile };
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    await authService.signOut();
  };

  const refreshProfile = async () => {
    if (user?.id) await loadProfile(user.id);
  };

  const updateProfile = async (updates: Partial<User>) => {
    const { data, error } = await authService.updateProfile(updates);
    if (data) {
      setUser(data);
      setProfile(data);
      return { error, profile: data };
    }
    return { error, profile: null };
  };

  const uploadAvatar = async (asset: AvatarUploadAsset) => {
    const { data, error } = await authService.uploadAvatar(asset);
    if (data) {
      setUser(data);
      setProfile(data);
      return { error, profile: data };
    }
    return { error, profile: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        refreshProfile,
        updateProfile,
        uploadAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
