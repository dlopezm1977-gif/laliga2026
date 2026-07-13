import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { createUser, getUser, updateUser } from '../lib/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async firebaseUser => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const p = await getUser(firebaseUser.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
    });
  }, []);

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function register(email, password, username) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await createUser(cred.user.uid, { username, email });
    setProfile({ username, email });
  }

  async function logout() {
    await signOut(auth);
  }

  async function resetPassword(email) {
    await sendPasswordResetEmail(auth, email);
  }

  async function updateProfile(data) {
    if (!user) return;
    await updateUser(user.uid, data);
    setProfile(prev => ({ ...prev, ...data }));
  }

  const isLoading = user === undefined;
  const isGuest   = !isLoading && !user;

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, isGuest, login, register, logout, resetPassword, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
