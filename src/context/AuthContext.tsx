import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface UserData {
  uid: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier';
  name: string;
}

interface AuthContextType {
  currentUser: User | null;
  userData: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
  showFirebaseSetup: boolean;
  setShowFirebaseSetup: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  loading: true,
  signOut: async () => {},
  showFirebaseSetup: false,
  setShowFirebaseSetup: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFirebaseSetup, setShowFirebaseSetup] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserData;
            if (user.email === 'nabaz@hookah.com' || user.email === 'kurdb234@gmail.com') {
              data.role = 'admin';
            }
            setUserData({ uid: user.uid, ...data });
          } else {
            // Default role if not found (for testing/initial setup)
            const role = (user.email === 'nabaz@hookah.com' || user.email === 'kurdb234@gmail.com') ? 'admin' : 'cashier';
            const newUserData = { email: user.email || '', role: role, name: user.displayName || 'User' };
            
            // Try to create the user document in Firestore
            try {
              const { setDoc } = await import('firebase/firestore');
              await setDoc(docRef, newUserData);
            } catch (e) {
              console.error("Could not create user document:", e);
            }
            
            setUserData({ uid: user.uid, ...newUserData });
          }
        } catch (error: any) {
          console.error("Error fetching user data:", error);
          if (error.code === 'permission-denied') {
            setShowFirebaseSetup(true);
          }
          // Fallback for admin users even if permission denied
          if (user.email === 'nabaz@hookah.com' || user.email === 'kurdb234@gmail.com') {
             setUserData({ uid: user.uid, email: user.email || '', role: 'admin', name: user.displayName || 'Admin' });
          } else {
             setUserData(null);
          }
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, signOut, showFirebaseSetup, setShowFirebaseSetup }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
