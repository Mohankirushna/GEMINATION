import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  getAuthInstance,
  getDbInstance,
  isFirebaseConfigured,
  initializeFirebase,
} from "../services/firebase";
import { UserRole, UserProfile } from "../types";
import { generateUserData } from "../services/api";

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
  ) => Promise<void>;
  signInWithGoogle: (role?: UserRole) => Promise<void>;
  signOutUser: () => Promise<void>;
  setDemoRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

/* ── Demo-mode fallback when Firebase is NOT configured ──── */
function makeDemoProfile(role: UserRole): UserProfile {
  return {
    uid: "demo",
    email:
      role === "financial_institution"
        ? "analyst@sbi.co.in"
        : "priya@example.com",
    displayName:
      role === "financial_institution"
        ? "Ravi Sharma (SBI Analyst)"
        : "Priya Mehta",
    role,
    linkedAccounts: role === "financial_institution" ? [] : ["acc_priya"],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isFirebaseConfigured();
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: configured, // only show loading if we actually need to check auth
    error: null,
    isConfigured: configured,
  });

  // Ensure Firebase is initialized
  useEffect(() => {
    if (configured) {
      initializeFirebase();
    }
  }, [configured]);

  // Listen to auth state
  useEffect(() => {
    if (!configured) return;
    const auth = getAuthInstance();
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const profile = await fetchProfile(fbUser);
        setState((s) => ({
          ...s,
          user: fbUser,
          profile,
          loading: false,
          error: null,
        }));
      } else {
        setState((s) => ({ ...s, user: null, profile: null, loading: false }));
      }
    });
    return unsub;
  }, [configured]);

  async function fetchProfile(
    fbUser: FirebaseUser,
  ): Promise<UserProfile | null> {
    const db = getDbInstance();
    if (!db) return null;
    try {
      const snap = await getDoc(doc(db, "users", fbUser.uid));
      if (snap.exists()) {
        const d = snap.data();
        return {
          uid: fbUser.uid,
          email: fbUser.email ?? "",
          displayName: d.display_name ?? fbUser.displayName ?? "",
          role: d.role ?? "end_user",
          linkedAccounts: d.linked_accounts ?? [],
          photoURL: fbUser.photoURL ?? undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  async function signIn(email: string, password: string) {
    const auth = getAuthInstance();
    if (!auth) {
      // Firebase not configured — fall back to demo mode
      // Determine role from email pattern (institution emails often have org domains)
      const role: UserRole = email.includes("bank") || email.includes("sbi") || email.includes("hdfc") || email.includes("icici") || email.includes("institution")
        ? "financial_institution"
        : "end_user";
      const profile = makeDemoProfile(role);
      profile.email = email;
      profile.displayName = email.split("@")[0];
      profile.uid = `demo_${Date.now()}`;
      // Generate backend data for this user
      try {
        const accountId = `acc_${profile.uid.slice(0, 8)}`;
        await generateUserData(accountId, email);
      } catch { /* non-critical */ }
      setState((s) => ({ ...s, profile, loading: false, error: null }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
      throw e;
    }
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string,
    role: UserRole,
  ) {
    const auth = getAuthInstance();
    const db = getDbInstance();
    if (!auth || !db) {
      // Firebase not configured — fall back to demo mode with chosen role
      const profile = makeDemoProfile(role);
      profile.email = email;
      profile.displayName = displayName;
      profile.uid = `demo_${Date.now()}`;
      // Generate backend data for this user
      try {
        const accountId = `acc_${profile.uid.slice(0, 8)}`;
        await generateUserData(accountId, email);
      } catch { /* non-critical */ }
      setState((s) => ({ ...s, profile, loading: false, error: null }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        display_name: displayName,
        role,
        linked_accounts: [],
        created_at: new Date().toISOString(),
      });
      // Generate dynamic demo data for the new user in the backend
      try {
        const accountId = `acc_${cred.user.uid.slice(0, 8)}`;
        await generateUserData(accountId, email);
      } catch {
        // non-critical — dashboard still works with demo data
      }
      // Explicitly set profile state to avoid onAuthStateChanged race condition
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        email,
        displayName,
        role,
        linkedAccounts: [],
        photoURL: cred.user.photoURL ?? undefined,
      };
      setState((s) => ({ ...s, user: cred.user, profile: newProfile, loading: false, error: null }));    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
      throw e;
    }
  }

  async function signInWithGoogleFn(role?: UserRole) {
    const auth = getAuthInstance();
    const db = getDbInstance();
    if (!auth || !db) {
      // Firebase not configured — fall back to demo mode
      const demoRole = role ?? "end_user";
      const profile = makeDemoProfile(demoRole);
      profile.uid = `demo_google_${Date.now()}`;
      try {
        const accountId = `acc_${profile.uid.slice(0, 8)}`;
        await generateUserData(accountId, profile.email);
      } catch { /* non-critical */ }
      setState((s) => ({ ...s, profile, loading: false, error: null }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      // Create profile if first login
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      if (!snap.exists()) {
        await setDoc(doc(db, "users", cred.user.uid), {
          email: cred.user.email,
          display_name: cred.user.displayName,
          role: role ?? "end_user",
          linked_accounts: [],
          created_at: new Date().toISOString(),
        });
        // Generate dynamic demo data for new Google sign-in user
        try {
          const accountId = `acc_${cred.user.uid.slice(0, 8)}`;
          await generateUserData(accountId, cred.user.email ?? "");
        } catch {
          // non-critical
        }
      }
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
      throw e;
    }
  }

  async function signOutUser() {
    const auth = getAuthInstance();
    if (auth) await fbSignOut(auth);
    setState((s) => ({ ...s, user: null, profile: null, error: null }));
  }

  function setDemoRole(role: UserRole) {
    setState((s) => ({ ...s, profile: makeDemoProfile(role), loading: false }));
  }

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signUp,
        signInWithGoogle: signInWithGoogleFn,
        signOutUser,
        setDemoRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
