
"use client";

import type { User, UserRole, FirestoreUser, CartItem, VinylRecord, AppNotification, BrandingSettings, Distributor, DiscogsListing, WorkerPermissions, WeightOption, OnboardingFormValues, FirestoreCartItem, Supplier, SearchResult } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { auth, db, app } from '@/lib/firebase';
import { initializeApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  User as FirebaseUserType,
  getAuth as getAuthInstance,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where, limit, updateDoc, Timestamp, deleteDoc, arrayUnion, QuerySnapshot, arrayRemove, DocumentSnapshot } from 'firebase/firestore';
import { getOrders, getOrdersByViewerId } from '@/services/order-service';
import { getNotifications, markNotificationAsRead } from '@/services/notification-service';
import { getBrandingSettings } from '@/services/settings-service';
import { getDistributorById, updateDistributor, addDistributor as addDistributorService, getDistributorsByIds } from '@/services/distributor-service';
import { getMasterUserByDistributorId, getClientsByDistributorId, updateUserDistributorAccess, getUsersByDistributorId as fetchUsersByDistributorId } from '@/services/user-service';
import { verifyDiscogsUser, fetchAllDiscogsInventory } from '@/services/discogs-user-service';
import { getWeightOptions as fetchWeightOptions } from '@/services/subscription-service';
import { getAllUsers } from '@/services/admin-user-service';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getRecordById, searchRecordsByTerm as searchRecords } from '@/services/record-service';
import { getSuppliersByDistributorId } from '@/services/supplier-service';


interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  addUser: (email: string, temporaryPassword_DO_NOT_USE_EVER: string, role: UserRole, distributorId?: string, details?: Partial<User>) => Promise<string | null>;
  deleteUser: (uid: string) => Promise<boolean>;
  toggleFavorite: (recordId: string) => Promise<void>;
  updateUserProfile: (data: Partial<User>, uid?: string) => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  cart: CartItem[];
  addToCart: (record: VinylRecord, quantity: number, distributorId: string) => void;
  removeFromCart: (recordId: string) => void;
  updateCartQuantity: (recordId: string, quantity: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  clientPendingOrdersCount: number;
  operatorPendingOrdersCount: number;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  markNotificationRead: (notificationId: string) => Promise<void>;
  platformBranding: BrandingSettings | null;
  displayBranding: BrandingSettings | null;
  activeDistributor: Distributor | null;
  updateMyDistributorSettings: (settings: Partial<Distributor>) => Promise<void>;
  
  activeDistributorId: string | null;
  setActiveDistributorId: (id: string | null) => void;
  accessibleDistributors: Distributor[];

  // Impersonation
  isImpersonating: boolean;
  impersonate: (distributorId: string) => Promise<void>;
  stopImpersonating: () => void;

  // Discogs
  connectToDiscogs: (username: string) => Promise<void>;
  disconnectFromDiscogs: () => Promise<void>;
  syncDiscogsInventory: () => Promise<void>;
  discogsInventoryReleaseIds: Set<number>;
  isFetchingDiscogsInventory: boolean;
  getDiscogsListing(releaseId: number): DiscogsListing | undefined;

  // Global Search
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  globalSearchResults: SearchResult[];
  isGlobalSearching: boolean;

  // Theme
  theme: 'light' | 'dark' | 'black';
  
  // Token refresh
  refreshAuthToken: () => Promise<boolean>;
  setTheme: (theme: 'light' | 'dark' | 'black') => void;

  // Stripe Onboarding
  isFinalizing: boolean;
  registrationError: string | null;
  
  // Client Management
  updateUserAccess: (viewerEmail: string, distributorId: string, action: 'grant' | 'revoke') => Promise<void>;
  
  // Mobile sidebar control
  setOpenMobile?: (open: boolean) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const roleDisplayNames: Record<UserRole, string> = {
  master: 'Master',
  worker: 'Operator',
  viewer: 'Client',
  superadmin: 'Super Admin',
};

const THEME_STORAGE_KEY = 'vinyl_db_theme';
const ACTIVE_DISTRIBUTOR_ID_KEY = 'vinyl_db_active_distributor_id';


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientPendingOrdersCount, setClientPendingOrdersCount] = useState(0);
  const [operatorPendingOrdersCount, setOperatorPendingOrdersCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [platformBranding, setPlatformBranding] = useState<BrandingSettings | null>(null);
  const [displayBranding, setDisplayBranding] = useState<BrandingSettings | null>(null);
  const [activeDistributor, setActiveDistributor] = useState<Distributor | null>(null);
  const [activeDistributorId, _setActiveDistributorId] = useState<string | null>(null);
  const [accessibleDistributors, setAccessibleDistributors] = useState<Distributor[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark' | 'black'>('dark');
  
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [originalUser, setOriginalUser] = useState<User | null>(null);
  
  const [discogsInventory, setDiscogsInventory] = useState<DiscogsListing[]>([]);
  const [isFetchingDiscogsInventory, setIsFetchingDiscogsInventory] = useState(false);

  // Stripe Onboarding State
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  
  // This state will be connected to the SidebarProvider
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Global Search State
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState<SearchResult[]>([]);
  const [isGlobalSearching, setIsGlobalSearching] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;
  
  // Debounce hook
  const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);
    return debouncedValue;
  };

  const debouncedSearchTerm = useDebounce(globalSearchTerm, 300);

  useEffect(() => {
    const performSearch = async () => {
        if (debouncedSearchTerm.length < 2) {
            setGlobalSearchResults([]);
            setIsGlobalSearching(false);
            return;
        }

        setIsGlobalSearching(true);
        try {
            const distributorIdForSearch = user?.role === 'viewer' ? activeDistributorId : user?.distributorId;
            if (!distributorIdForSearch) {
                setGlobalSearchResults([]);
                return;
            }
            const results = await searchRecords(debouncedSearchTerm, distributorIdForSearch);
            setGlobalSearchResults(results);
        } catch (error) {
            console.error("Global search failed:", error);
            setGlobalSearchResults([]);
        } finally {
            setIsGlobalSearching(false);
        }
    };

    performSearch();
  }, [debouncedSearchTerm, user, activeDistributorId]);

  const setActiveDistributorId = useCallback((id: string | null) => {
    _setActiveDistributorId(id);
    if (id) {
        localStorage.setItem(ACTIVE_DISTRIBUTOR_ID_KEY, id);
    } else {
        localStorage.removeItem(ACTIVE_DISTRIBUTOR_ID_KEY);
    }
  }, []);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'black') {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('theme-light', 'theme-dark', 'theme-black');
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const fetchSettings = async () => {
      const settings = await getBrandingSettings();
      setPlatformBranding(settings);
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const determineBranding = () => {
        const baseBranding = platformBranding || { companyName: 'Vinylogix', logoUrl: '/logo.png' };
        
        if (user && (user.role === 'master' || user.role === 'worker' || user.role === 'viewer') && activeDistributor) {
            setDisplayBranding({
                companyName: activeDistributor.companyName || baseBranding.companyName,
                logoUrl: activeDistributor.logoUrl || baseBranding.logoUrl,
            });
        } 
        else {
            setDisplayBranding(baseBranding);
        }
    };

    determineBranding();
  }, [user, platformBranding, activeDistributor]);

  const fetchUserNotifications = useCallback(async () => {
    if (user && ['master', 'worker'].includes(user.role)) {
      try {
        const userNotifications = await getNotifications(user);
        setNotifications(userNotifications);
      } catch (error) {
        console.error("AuthContext: Failed to fetch notifications", error);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && (user.role === 'master' || user.role === 'worker')) {
        const fetchOperatorOrders = async () => {
            try {
                const orders = await getOrders(user);
                const pendingCount = orders.filter(o => o.status === 'pending').length;
                setOperatorPendingOrdersCount(pendingCount);
            } catch (error) {
                console.error("AuthContext: Failed to fetch operator orders for count", error);
                setOperatorPendingOrdersCount(0);
            }
        };
        fetchOperatorOrders();
    } else {
        setOperatorPendingOrdersCount(0);
    }
}, [user, activeDistributorId]);

  useEffect(() => {
    fetchUserNotifications();
  }, [fetchUserNotifications]);

  const markNotificationRead = async (notificationId: string) => {
    const success = await markNotificationAsRead(notificationId);
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
      );
    }
  };

  const syncCartToFirestore = async (cartToSync: CartItem[]) => {
      if (!user) return;
      const firestoreCart: FirestoreCartItem[] = cartToSync.map(item => ({
          recordId: item.record.id,
          quantity: item.quantity,
          distributorId: item.distributorId,
      }));
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { cart: firestoreCart });
  };
  
  const addToCart = (record: VinylRecord, quantity: number, distributorId: string) => {
    setCart(prevCart => {
      const isNewDistributor = prevCart.length > 0 && prevCart[0].distributorId !== distributorId;
      const cartToUpdate = isNewDistributor ? [] : prevCart;
      
      if(isNewDistributor) {
          toast({ title: "Cart Cleared", description: "You can only order from one distributor at a time. Your cart has been cleared." });
      }

      const existingItem = cartToUpdate.find(item => item.record.id === record.id);
      let updatedCart: CartItem[];
      if (existingItem) {
        updatedCart = cartToUpdate.map(item =>
          item.record.id === record.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        updatedCart = [...cartToUpdate, { record, quantity, distributorId }];
      }
      syncCartToFirestore(updatedCart);
      return updatedCart;
    });
    toast({
        title: "Added to Cart",
        description: `Added ${quantity} x "${record.title}" to your cart.`,
    })
  };

  const removeFromCart = (recordId: string) => {
    setCart(prevCart => {
        const updatedCart = prevCart.filter(item => item.record.id !== recordId);
        syncCartToFirestore(updatedCart);
        return updatedCart;
    });
  };

  const updateCartQuantity = (recordId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(recordId);
      return;
    }
    setCart(prevCart => {
        const updatedCart = prevCart.map(item =>
            item.record.id === recordId ? { ...item, quantity } : item
        );
        syncCartToFirestore(updatedCart);
        return updatedCart;
    });
  };

  const clearCart = () => {
    setCart([]);
    syncCartToFirestore([]);
  };

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const cartTotal = cart.reduce((total, item) => total + (item.record.sellingPrice || 0) * item.quantity, 0);


  const refreshAuthToken = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    
    try {
      console.log('AuthContext: Refreshing authentication token...');
      await auth.currentUser.getIdToken(true); // Force token refresh
      console.log('AuthContext: Successfully refreshed token');
      return true;
    } catch (error) {
      console.error('AuthContext: Error refreshing auth token:', error);
      return false;
    }
  }, []);

  const fetchUserRole = useCallback(async (firebaseUser: FirebaseUserType): Promise<User | null> => {
    const userDocRef = doc(db, "users", firebaseUser.uid);
    try {
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as FirestoreUser;
        return {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: userData.role,
          status: userData.status,
          distributorId: userData.distributorId,
          accessibleDistributorIds: userData.accessibleDistributorIds || [],
          disabledForDistributors: userData.disabledForDistributors || [],
          favorites: userData.favorites || [],
          cart: userData.cart || [],
          createdAt: userData.createdAt instanceof Timestamp ? userData.createdAt.toDate().toISOString() : undefined,
          lastLoginAt: userData.lastLoginAt instanceof Timestamp ? userData.lastLoginAt.toDate().toISOString() : undefined,
          loginHistory: Array.isArray(userData.loginHistory) ? userData.loginHistory.map(ts => (ts instanceof Timestamp ? ts.toDate().toISOString() : ts)) : [],
          firstName: userData.firstName,
          lastName: userData.lastName,
          companyName: userData.companyName,
          phoneNumber: userData.phoneNumber,
          mobileNumber: userData.mobileNumber,
          addressLine1: userData.addressLine1,
          addressLine2: userData.addressLine2,
          postcode: userData.postcode,
          city: userData.city,
          country: userData.country,
          billingAddress: userData.billingAddress,
          useDifferentBillingAddress: userData.useDifferentBillingAddress,
          chamberOfCommerce: userData.chamberOfCommerce,
          vatNumber: userData.vatNumber,
          eoriNumber: userData.eoriNumber,
          notes: userData.notes,
          discogsUsername: userData.discogsUsername,
          discogsUserId: userData.discogsUserId,
          permissions: userData.permissions,
          profileComplete: userData.profileComplete || false,
        };
      } else {
        if (!firebaseUser.email) return null;
        const newTimestamp = Timestamp.now();
        const newUserFirestoreData: FirestoreUser = { 
            email: firebaseUser.email, 
            role: 'viewer',
            favorites: [],
            cart: [],
            accessibleDistributorIds: [], 
            createdAt: newTimestamp,
            lastLoginAt: newTimestamp,
            loginHistory: [newTimestamp],
            profileComplete: false,
        };
        try {
            await setDoc(userDocRef, newUserFirestoreData);
            return { 
                uid: firebaseUser.uid, 
                email: firebaseUser.email, 
                role: 'viewer', 
                favorites: [], 
                cart: [],
                accessibleDistributorIds: [],
                createdAt: newUserFirestoreData.createdAt.toDate().toISOString(),
                lastLoginAt: newUserFirestoreData.lastLoginAt.toDate().toISOString(),
                loginHistory: [newUserFirestoreData.lastLoginAt.toDate().toISOString()],
                profileComplete: false,
            };
        } catch (error) {
           const fError = error as { code?: string; message?: string };
           const specificError = `(Operation: setDoc, Collection: 'users', Document: '${firebaseUser.uid}'. Original error: ${fError.message})`;
           if (fError.code === 'permission-denied' || fError.code === 'PERMISSION_DENIED') {
                 toast({ title: "Setup Error: Permission Denied", description: `Could not create user profile due to permissions. ${specificError}`, variant: "destructive", duration: 15000 });
            } else {
                toast({ title: "Setup Error", description: `Could not create user profile: ${fError.message || 'Unknown error'}. Check console.`, variant: "destructive", duration: 10000 });
            }
            return null; 
        }
      }
    } catch (error: any) {
        const specificError = `(Operation: 'getDoc', Collection: 'users', Document: '${firebaseUser.uid}'. Original error: ${error.message})`;
        console.error("Firebase Read Error:", specificError);
        toast({ title: "Permission Error on Load", description: `Could not load your user profile. ${specificError}`, variant: "destructive", duration: 10000 });
        return null;
    }
  }, [toast]);
  
  const loadCartFromFirestore = useCallback(async (firestoreCart: FirestoreCartItem[]) => {
      if (!firestoreCart || firestoreCart.length === 0) {
          setCart([]);
          return;
      }
      const recordPromises = firestoreCart.map(item => getRecordById(item.recordId));
      const records = await Promise.all(recordPromises);
      const newCart: CartItem[] = firestoreCart
          .map((item, index) => {
              const record = records[index];
              return record ? { record, quantity: item.quantity, distributorId: item.distributorId } : null;
          })
          .filter((item): item is CartItem => item !== null);
      setCart(newCart);
  }, []);

  const loadActiveDistributorData = useCallback(async (distributorId: string, currentDistributors: Distributor[]): Promise<Distributor | null> => {
      try {
          const distributorDetails = currentDistributors.find(d => d.id === distributorId) || await getDistributorById(distributorId);
          if (distributorDetails) {
              const [weightOptions, suppliers] = await Promise.all([
                  fetchWeightOptions(),
                  getSuppliersByDistributorId(distributorId)
              ]);
              return { ...distributorDetails, weightOptions, suppliers };
          }
          return null;
      } catch (error) {
          const err = error as Error;
          const specificError = `(Distributor ID: ${distributorId})`;
          console.error(`AuthContext: Could not fetch details for active distributor. ${specificError}`, err.message);
          toast({ title: "Data Loading Error", description: `Could not load data for the selected distributor. ${specificError}`, variant: "destructive", duration: 15000 });
          return null;
      }
  }, [toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (isImpersonating) return;
      setLoading(true);

      if (firebaseUser) {
        const userWithRole = await fetchUserRole(firebaseUser);

        if (userWithRole) {
            await loadCartFromFirestore(userWithRole.cart || []);
            let distributorIdToLoad: string | undefined = userWithRole.distributorId;
            let accessibleDistributorData: Distributor[] = [];
            
            if (userWithRole.role === 'viewer' && userWithRole.accessibleDistributorIds && userWithRole.accessibleDistributorIds.length > 0) {
                accessibleDistributorData = await getDistributorsByIds(userWithRole.accessibleDistributorIds);
                setAccessibleDistributors(accessibleDistributorData);
                
                const lastUsedId = localStorage.getItem(ACTIVE_DISTRIBUTOR_ID_KEY);
                if (lastUsedId && userWithRole.accessibleDistributorIds.includes(lastUsedId)) {
                    distributorIdToLoad = lastUsedId;
                } else if (accessibleDistributorData.length > 0) {
                    distributorIdToLoad = accessibleDistributorData[0].id;
                } else {
                    distributorIdToLoad = undefined;
                }
            } else if (userWithRole.distributorId) {
                accessibleDistributorData = [await getDistributorById(userWithRole.distributorId)].filter(Boolean) as Distributor[];
                setAccessibleDistributors(accessibleDistributorData);
            }
             else {
                setAccessibleDistributors([]);
            }

            if (distributorIdToLoad) {
                const fullDistributorData = await loadActiveDistributorData(distributorIdToLoad, accessibleDistributorData);
                if (fullDistributorData) {
                    setActiveDistributor(fullDistributorData);
                    _setActiveDistributorId(distributorIdToLoad);
                } else {
                    // Handle case where distributor data fails to load
                    await firebaseSignOut(auth);
                    setUser(null);
                    setActiveDistributor(null);
                    setActiveDistributorId(null);
                    setLoading(false);
                    return;
                }
            } else {
                 setActiveDistributor(null);
                 setActiveDistributorId(null);
            }

            setUser(userWithRole);
             try {
              const userDocRefForLoginUpdate = doc(db, "users", firebaseUser.uid);
              const userDocSnap = await getDoc(userDocRefForLoginUpdate);
              const currentHistory = userDocSnap.data()?.loginHistory || [];
              const newTimestamp = Timestamp.now();
              const updatedHistory = [newTimestamp, ...currentHistory].slice(0, 10);
              
              await updateDoc(userDocRefForLoginUpdate, {
                  lastLoginAt: newTimestamp,
                  loginHistory: updatedHistory
              });
              
              setUser(prevUser => prevUser ? {
                  ...prevUser, 
                  lastLoginAt: newTimestamp.toDate().toISOString(),
                  loginHistory: updatedHistory.map(ts => ts.toDate().toISOString())
              } : null);
            } catch (loginUpdateError) {
              console.error("AuthContext: Failed to update lastLoginAt for user", firebaseUser.email, loginUpdateError);
            }

            if (userWithRole.role === 'viewer') {
              const fetchPendingOrdersCount = async (uid: string) => {
                  try {
                      const orders = await getOrdersByViewerId(uid);
                      const pendingCount = orders.filter(o => o.status !== 'paid' && o.status !== 'cancelled').length;
                      setClientPendingOrdersCount(pendingCount);
                  } catch (error) {
                      setClientPendingOrdersCount(0);
                  }
              };
              fetchPendingOrdersCount(firebaseUser.uid);
            }

        } else {
          toast({ title: "Access Issue", description: "Could not retrieve your user profile after login. You may need to be assigned permissions.", variant: "destructive", duration: 7000 });
          await firebaseSignOut(auth);
          setUser(null);
          setActiveDistributor(null);
          setActiveDistributorId(null);
        }
      } else {
        setUser(null);
        setActiveDistributor(null);
        setActiveDistributorId(null);
        setAccessibleDistributors([]);
        setClientPendingOrdersCount(0);
        setNotifications([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserRole, toast, isImpersonating, setActiveDistributorId, loadCartFromFirestore, loadActiveDistributorData]);

  const login = async (email: string, password?: string) => {
    if (!password) {
      toast({ title: "Login Failed", description: "Password is required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message || "Invalid email or password.", variant: "destructive" });
      setUser(null);
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast({ title: "Google Sign-In Failed", description: error.message || "Could not sign in with Google.", variant: "destructive" });
      setUser(null);
      setLoading(false);
    }
  };

  const register = async (email: string, password_DO_NOT_USE_EVER?: string) => {
    if (!password_DO_NOT_USE_EVER) {
      toast({ title: "Registration Failed", description: "Password is required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password_DO_NOT_USE_EVER);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
         toast({ title: "Registration Failed", description: "This email address is already in use.", variant: "destructive" });
      } else {
        toast({ title: "Registration Failed", description: error.message || "Could not create account.", variant: "destructive" });
      }
      setUser(null);
      setLoading(false); 
    }
  };


  const logout = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error: any) {
      toast({ title: "Logout Error", description: error.message || "Failed to log out.", variant: "destructive" });
      setLoading(false);
    }
  };

  const addUser = async (email: string, temporaryPassword_DO_NOT_USE_EVER: string, role: UserRole = 'worker', distributorId?: string, details?: Partial<User>): Promise<string | null> => {
    const actingDistributorId = distributorId || user?.distributorId;
    if (!actingDistributorId && role !== 'viewer') {
        throw new Error("Distributor context is missing for operator creation.");
    }

    const usersCollectionRef = collection(db, "users");
    const q = query(usersCollectionRef, where("email", "==", email), limit(1));
    const existingUserSnapshot = await getDocs(q);

    if (!existingUserSnapshot.empty) {
       throw new Error(`The email address "${email}" is already registered. Users must have a unique email.`);
    }

    const secondaryAppName = `user-creation-${Date.now()}`;
    let secondaryApp: FirebaseApp | undefined;
    try {
      secondaryApp = initializeApp(auth.app.options, secondaryAppName);
      const secondaryAuth = getAuthInstance(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, temporaryPassword_DO_NOT_USE_EVER);
      const newUserId = userCredential.user.uid;

      const userDocRef = doc(db, "users", newUserId);
      const newTimestamp = Timestamp.now();
      const newUserFirestoreData: FirestoreUser = { 
        email, 
        role, 
        distributorId: actingDistributorId,
        accessibleDistributorIds: role === 'viewer' && actingDistributorId ? [actingDistributorId] : [],
        favorites: [], 
        cart: [],
        createdAt: newTimestamp,
        lastLoginAt: newTimestamp,
        loginHistory: [newTimestamp],
        profileComplete: role === 'viewer' && !!details?.addressLine1, // Profile is complete if address is provided
        ...(details ? {
            firstName: details.firstName || '',
            lastName: details.lastName || '',
            companyName: details.companyName || '',
            phoneNumber: details.phoneNumber || '',
            addressLine1: details.addressLine1 || '',
            addressLine2: details.addressLine2 || '',
            postcode: details.postcode || '',
            city: details.city || '',
            country: details.country || '',
            chamberOfCommerce: details.chamberOfCommerce || '',
            vatNumber: details.vatNumber || '',
        } : {})
      };
      await setDoc(userDocRef, newUserFirestoreData);
      
      return newUserId;
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error(`The email ${email} is already registered in Firebase Authentication, but not associated with a user profile in the app. Please contact support or use a different email.`);
      }
      throw error;
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error("Error deleting secondary app, it might have already been deleted.", e);
        }
      }
    }
  };
  
  const deleteUser = async (uid: string): Promise<boolean> => {
    if (!user) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
        return false;
    }
    
    // Authorization checks
    const isMasterDeletingOwnOperator = user.role === 'master' && user.distributorId;
    const isSuperAdmin = user.role === 'superadmin';

    if (!isMasterDeletingOwnOperator && !isSuperAdmin) {
        toast({ title: "Permission Denied", description: "You do not have permission to delete users.", variant: "destructive" });
        return false;
    }
    if (uid === user.uid) {
        toast({ title: "Action Not Allowed", description: "You cannot delete your own account.", variant: "destructive" });
        return false;
    }

    try {
        // Step 1: Call the Cloud Function to delete the auth user
        const functions = getFunctions(app, 'europe-west4');
        const deleteAuthUserCallable = httpsCallable(functions, 'deleteAuthUser');
        await deleteAuthUserCallable({ uidToDelete: uid });

        // Step 2: Delete the Firestore document
        const userDocRef = doc(db, "users", uid);
        await deleteDoc(userDocRef);
        
        return true;
    } catch (error: any) {
        console.error("Failed to delete user:", error);
        toast({ title: "Deletion Failed", description: `Could not delete user: ${error.message}`, variant: "destructive", duration: 10000 });
        return false;
    }
  };

  const toggleFavorite = async (recordId: string) => {
    if (!user || user.role !== 'viewer') {
      toast({ title: "Action Not Allowed", description: "Only Clients can manage favorites.", variant: "destructive" });
      return;
    }
    if (!user.uid) return;

    const userDocRef = doc(db, "users", user.uid);
    try {
      const currentFavorites = user.favorites || [];
      let updatedFavorites: string[];

      if (currentFavorites.includes(recordId)) {
        updatedFavorites = currentFavorites.filter(id => id !== recordId);
        toast({ title: "Removed from Favorites"});
      } else {
        updatedFavorites = [...currentFavorites, recordId];
        toast({ title: "Added to Favorites" });
      }
      
      await updateDoc(userDocRef, { favorites: updatedFavorites });
      setUser(prevUser => {
        if (!prevUser) return null;
        return { ...prevUser, favorites: updatedFavorites };
      });
    } catch (error) {
      toast({ title: "Favorite Error", description: "Could not update favorites. Check console.", variant: "destructive" });
    }
  };

  const updateUserProfile = async (data: Partial<User>, uid?: string): Promise<boolean> => {
    const targetUid = uid || user?.uid;
    if (!targetUid) {
        toast({ title: "Not Authenticated", description: "You must be logged in to update your profile.", variant: "destructive" });
        return false;
    }

    if (uid && user?.role !== 'master' && user?.role !== 'superadmin') {
      toast({ title: "Permission Denied", description: "You do not have permission to edit other users.", variant: "destructive" });
      return false;
    }

    const allowedUpdates: { [key: string]: any } = {};
    if (data.firstName !== undefined) allowedUpdates.firstName = data.firstName;
    if (data.lastName !== undefined) allowedUpdates.lastName = data.lastName;
    if (data.companyName !== undefined) allowedUpdates.companyName = data.companyName;
    if (data.phoneNumber !== undefined) allowedUpdates.phoneNumber = data.phoneNumber;
    if (data.mobileNumber !== undefined) allowedUpdates.mobileNumber = data.mobileNumber;
    if (data.addressLine1 !== undefined) allowedUpdates.addressLine1 = data.addressLine1;
    if (data.addressLine2 !== undefined) allowedUpdates.addressLine2 = data.addressLine2;
    if (data.postcode !== undefined) allowedUpdates.postcode = data.postcode;
    if (data.city !== undefined) allowedUpdates.city = data.city;
    if (data.country !== undefined) allowedUpdates.country = data.country;
    if (data.billingAddress !== undefined) allowedUpdates.billingAddress = data.billingAddress;
    if (data.useDifferentBillingAddress !== undefined) allowedUpdates.useDifferentBillingAddress = data.useDifferentBillingAddress;
    if (data.chamberOfCommerce !== undefined) allowedUpdates.chamberOfCommerce = data.chamberOfCommerce;
    if (data.vatNumber !== undefined) allowedUpdates.vatNumber = data.vatNumber;
    if (data.eoriNumber !== undefined) allowedUpdates.eoriNumber = data.eoriNumber;
    if (data.notes !== undefined) allowedUpdates.notes = data.notes;
    if (data.profileComplete !== undefined) allowedUpdates.profileComplete = data.profileComplete;
    if (data.role !== undefined && (user?.role === 'master' || user?.role === 'superadmin') && targetUid !== user.uid) { 
        allowedUpdates.role = data.role;
    }
    if (data.permissions !== undefined && user?.role === 'master') {
        allowedUpdates.permissions = data.permissions;
    }
    if (data.disabledForDistributors !== undefined) allowedUpdates.disabledForDistributors = data.disabledForDistributors;
    if (data.status !== undefined && (user?.role === 'master' || user?.role === 'superadmin')) allowedUpdates.status = data.status;
    
    if (Object.keys(allowedUpdates).length === 0) {
        toast({ title: "No Changes", description: "No information was provided to update.", variant: "default" });
        return true; 
    }

    const userDocRef = doc(db, "users", targetUid);
    try {
        await updateDoc(userDocRef, allowedUpdates);
        
        if (targetUid === user?.uid) { // Update current user state
           setUser(prev => prev ? { ...prev, ...allowedUpdates } : null);
        }

        toast({ title: "Profile Updated", description: "User information has been saved." });
        return true;
    } catch (error) {
        toast({ title: "Update Failed", description: "Could not save profile changes. Please try again.", variant: "destructive" });
        return false;
    }
  };

  const sendPasswordReset = async (email: string) => {
    if (!email) {
      toast({ title: "Error", description: "No email provided.", variant: "destructive" });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: "Password Reset Email Sent", description: `An email has been sent to ${email} with instructions to reset the password.` });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not send password reset email: ${error.message}`, variant: "destructive" });
    }
  };

  const updateUserAccess = async (viewerEmail: string, distributorId: string, action: 'grant' | 'revoke') => {
    await updateUserDistributorAccess(viewerEmail, distributorId, action);
  };


  const impersonate = async (distributorId: string) => {
    if (!user || user.role !== 'superadmin') {
        toast({ title: "Permission Denied", description: "Only superadmins can impersonate.", variant: "destructive" });
        return;
    }
    const masterUser = await getMasterUserByDistributorId(distributorId);
    if (!masterUser) {
        toast({ title: "Impersonation Failed", description: "Could not find a master user for this distributor.", variant: "destructive" });
        return;
    }
    setOriginalUser(user);
    setUser(masterUser);
    setIsImpersonating(true);
    router.push('/dashboard');
  };

  const stopImpersonating = () => {
    if (!originalUser) return;
    setUser(originalUser);
    setOriginalUser(null);
    setIsImpersonating(false);
    router.push('/admin/dashboard');
  };

  const updateMyDistributorSettings = async (settings: Partial<Distributor>) => {
    if (!user) return;

    if (user.role === 'superadmin') {
      await setDoc(doc(db, 'settings', 'branding'), settings, { merge: true });
      if (settings.weightOptions) {
        setActiveDistributor(prev => prev ? { ...prev, weightOptions: settings.weightOptions } : null);
      }
      setPlatformBranding(prev => ({...(prev || {companyName: '', logoUrl: ''}), ...settings}));
      toast({ title: "Platform Settings Updated" });
    } else if (user.role === 'master' && activeDistributorId) {
      try {
        await updateDistributor(activeDistributorId, settings, user);
        const updatedDistributor = await getDistributorById(activeDistributorId);
        setActiveDistributor(prev => ({...(prev as Distributor), ...updatedDistributor, weightOptions: prev?.weightOptions, suppliers: prev?.suppliers}));
        toast({ title: "Settings Updated", description: "Your distributor settings have been saved." });
      } catch (error) {
          const err = error as Error;
          toast({ title: "Update Failed", description: `Could not save your settings: ${err.message}`, variant: "destructive" });
      }
    } else {
       toast({ title: "Permission Denied", description: "You do not have permission to change these settings.", variant: "destructive" });
    }
  };

  const connectToDiscogs = async (username: string) => {
    if (!user) return;
    if (!username || username.trim() === "") {
        toast({ title: "Cancelled", description: "Username cannot be empty.", variant: "destructive" });
        return;
    }

    try {
        const discogsUser = await verifyDiscogsUser(username, user.distributorId);
        if (!discogsUser) {
            toast({ title: "User Not Found", description: `Could not find a Discogs user with the username "${username}".`, variant: "destructive" });
            return;
        }

        const dataToSave = {
          discogsUsername: username,
          discogsUserId: discogsUser.id,
        };

        const userDocRef = doc(db, "users", user.uid);
        await updateDoc(userDocRef, dataToSave);
        setUser(prev => prev ? { ...prev, ...dataToSave } : null);
        toast({ title: "Discogs Connected", description: `Successfully connected as ${username}.`});

    } catch(error) {
        toast({ title: "Connection Failed", description: `Could not connect to Discogs. ${(error as Error).message}`, variant: "destructive" });
    }
  };

  const disconnectFromDiscogs = async () => {
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        discogsUsername: null,
        discogsUserId: null,
      });
      setUser(prev => prev ? { ...prev, discogsUsername: undefined, discogsUserId: undefined } : null);
      toast({ title: "Discogs Disconnected" });
    } catch (error) {
       toast({ title: "Disconnection Failed", description: "Could not disconnect from Discogs.", variant: "destructive" });
    }
  };


  useEffect(() => {
    if (loading || isImpersonating) return;

    const publicRoutes = ['/', '/login', '/register/client', '/register', '/features', '/pricing'];
    const isPublicRoute = publicRoutes.includes(pathname) || pathname.startsWith('/register');
    const isAuthRoute = ['/login', '/register/client', '/register'].includes(pathname) || pathname.startsWith('/register');
    
    if (user) {
        if (user.status === 'on_hold') {
            logout();
            return;
        }
        if (user.role === 'viewer' && user.disabledForDistributors?.includes(activeDistributorId || '')) {
            toast({ title: "Access Suspended", description: "Your access to this catalog has been put on hold.", variant: "destructive" });
            logout();
            return;
        }
        
        let targetDashboard = '/dashboard';
        if (user.role === 'superadmin') targetDashboard = '/admin/dashboard';
        
        if (isAuthRoute) {
            router.replace(targetDashboard);
        }
    } else if (!user && !isPublicRoute) {
        router.replace('/login');
    }
  }, [user, loading, pathname, router, isImpersonating, activeDistributorId, toast, logout]);
  
  const syncDiscogsInventory = async () => {
    if (user && ['master', 'worker'].includes(user.role) && user.discogsUsername) {
        setIsFetchingDiscogsInventory(true);
        try {
            const inventory = await fetchAllDiscogsInventory(user.discogsUsername, user.distributorId);
            setDiscogsInventory(inventory);
            toast({ title: "Sync Complete", description: `Found ${inventory.length} listings in your Discogs inventory.` });
        } catch (error) {
            console.error("AuthContext: Failed to fetch discogs inventory", error);
            toast({ title: "Sync Failed", description: (error as Error).message, variant: "destructive" });
        } finally {
            setIsFetchingDiscogsInventory(false);
        }
    } else {
        toast({ title: "Cannot Sync", description: "You must be an operator with a connected Discogs account.", variant: "destructive" });
    }
  };

  const discogsInventoryReleaseIds = useMemo(() => {
    return new Set(discogsInventory.map(listing => listing.release.id));
  }, [discogsInventory]);

  const getDiscogsListing = useCallback((releaseId: number): DiscogsListing | undefined => {
    return discogsInventory.find(listing => listing.release.id === releaseId);
  }, [discogsInventory]);


  // Effect to handle post-Stripe registration
  const finalizeRegistration = useCallback(async (sessionId: string) => {
    setIsFinalizing(true);
    setRegistrationError(null);
    try {
        const response = await fetch(`/api/stripe/retrieve-session?session_id=${sessionId}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to retrieve Stripe session');
        }
        const session = await response.json();
        const onboardingDataString = localStorage.getItem('onboarding_data');
        
        if (!onboardingDataString) {
            throw new Error("Onboarding data not found in your browser. Please try registering again.");
        }
        
        const onboardingData: OnboardingFormValues = JSON.parse(onboardingDataString);

        if (session.customer_details?.email !== onboardingData.email) {
            throw new Error("Session email does not match registration email. Please try registering again.");
        }

        // Create the distributor
        const distributor = await addDistributorService({
            name: onboardingData.companyName,
            companyName: onboardingData.companyName,
            contactEmail: onboardingData.email,
            status: 'active',
            website: onboardingData.website,
            vatNumber: onboardingData.vatNumber,
            chamberOfCommerce: onboardingData.kvkNumber,
            isSubscriptionExempt: false,
            stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
            subscriptionId: typeof session.subscription === 'string' ? session.subscription : undefined,
        });

        // Create the Master user
        const newMasterUid = await addUser(
            onboardingData.email, 
            onboardingData.password || 'defaultPassword', 
            'master', 
            distributor.id,
            { 
              firstName: onboardingData.firstName,
              lastName: onboardingData.lastName,
              companyName: onboardingData.companyName,
            }
        );

        if (!newMasterUid) {
            throw new Error("Failed to create master user account.");
        }

        // Link master user to distributor
        await updateDistributor(distributor.id, { masterUserUid: newMasterUid }, user!);

        // Clean up
        localStorage.removeItem('onboarding_data');

        // Log the new user in
        await login(onboardingData.email, onboardingData.password);
        toast({ title: "Registration Successful!", description: `Welcome, ${onboardingData.companyName}! Your account is ready.`});

    } catch (error) {
        setRegistrationError((error as Error).message);
    } finally {
        setIsFinalizing(false);
    }
  }, [toast, addUser, user, login]);


  useEffect(() => {
    const sessionId = searchParams.get('stripe_session_id');
    if (sessionId && !user && !loading) {
      finalizeRegistration(sessionId);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [searchParams, finalizeRegistration, user, loading]);


  const contextValue = {
    user,
    login,
    loginWithGoogle,
    register,
    logout,
    loading,
    addUser,
    deleteUser,
    toggleFavorite,
    updateUserProfile,
    sendPasswordReset,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartCount,
    cartTotal,
    clientPendingOrdersCount,
    operatorPendingOrdersCount,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    platformBranding,
    displayBranding,
    activeDistributor,
    activeDistributorId,
    setActiveDistributorId,
    accessibleDistributors,
    updateMyDistributorSettings,
    isImpersonating,
    impersonate,
    stopImpersonating,
    connectToDiscogs,
    disconnectFromDiscogs,
    syncDiscogsInventory,
    discogsInventoryReleaseIds,
    isFetchingDiscogsInventory,
    getDiscogsListing,
    globalSearchTerm,
    setGlobalSearchTerm,
    globalSearchResults,
    isGlobalSearching,
    theme,
    setTheme,
    refreshAuthToken,
    isFinalizing,
    registrationError,
    updateUserAccess,
    setOpenMobile: setIsMobileSidebarOpen,
  };

  return (
    <AuthContext.Provider value={contextValue as AuthContextType}>
      {children}
    </AuthContext.Provider>
  );
};
