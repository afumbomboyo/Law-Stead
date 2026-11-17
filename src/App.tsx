import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  GraduationCap,
  Home,
  LogOut,
  Mail,
  Menu,
  Scale,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  ActiveSession,
  ActiveTab,
  ContactLoginMethod,
  Course,
  Enrollment,
  Lesson,
  RegistrationIntake,
  UserProfile,
  VisitorTrack,
  toAuthIdentifier,
} from './types';
import { CourseCard } from './components/CourseCard';
import { CourseDetailView } from './components/CourseDetailView';
import { TutorStudio } from './components/TutorStudio';
import { TutorRegistrationPage } from './components/TutorRegistrationPage';
import { AboutSection } from './components/AboutSection';
import { ContactSection } from './components/ContactSection';
import { AuthModal } from './components/AuthModal';
import { SingleSessionModal } from './components/SingleSessionModal';
import { SEEDED_CATALOG } from './data/seededCatalog';

const HERO_IMAGE_URL = '/src/assets/images/hero_law_library_1794933669409.jpg';

function getTabSessionId(): string {
  const key = 'lawstead_tab_session_id';
  let existing = sessionStorage.getItem(key);
  if (!existing) {
    existing = `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, existing);
  }
  return existing;
}

function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS Mobile Browser';
  if (/Android/i.test(ua)) return 'Android Mobile Browser';
  if (/Mac/i.test(ua)) return 'macOS Desktop Browser';
  if (/Windows/i.test(ua)) return 'Windows Desktop Browser';
  return 'Web Browser Session';
}

export default function App() {
  const sessionId = useMemo(() => getTabSessionId(), []);
  const deviceLabel = useMemo(() => getDeviceLabel(), []);

  // Hidden /register/tutor route detection (zero public links on main platform)
  const [isTutorRegisterRoute, setIsTutorRegisterRoute] = useState(
    () => window.location.pathname.replace(/\/+$/, '') === '/register/tutor'
  );

  useEffect(() => {
    const handlePopState = () => {
      setIsTutorRegisterRoute(
        window.location.pathname.replace(/\/+$/, '') === '/register/tutor'
      );
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation & Visitor Track
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [visitorTrack, setVisitorTrack] = useState<VisitorTrack>('all');
  const [visitingMenuOpen, setVisitingMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auth & Single-Session State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [sessionConfirmed, setSessionConfirmed] = useState(false);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'onboarding'>('signin');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const pendingIntakeRef = useRef<RegistrationIntake | null>(null);

  const [sessionConflict, setSessionConflict] = useState<{
    uid: string;
    deviceLabel: string;
    user: User;
  } | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const intentionalSignOutRef = useRef(false);

  // Catalog & Enrollments (bundled fallback ensures catalog renders on static hosts like Vercel)
  const [seededCourses, setSeededCourses] = useState<Course[]>(SEEDED_CATALOG.courses);
  const [seededLessonsByCourse, setSeededLessonsByCourse] = useState<Record<string, Lesson[]>>(
    SEEDED_CATALOG.lessonsByCourse
  );
  const [firestoreCourses, setFirestoreCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  // Refresh foundational catalog from Express when running full-stack server
  useEffect(() => {
    fetch('/api/catalog')
      .then((r) => {
        const contentType = r.headers.get('content-type') || '';
        if (!r.ok || !contentType.includes('application/json')) return null;
        return r.json();
      })
      .then((data: { courses?: Course[]; lessonsByCourse?: Record<string, Lesson[]> } | null) => {
        if (!data) return;
        if (Array.isArray(data.courses) && data.courses.length > 0) setSeededCourses(data.courses);
        if (data.lessonsByCourse) setSeededLessonsByCourse(data.lessonsByCourse);
      })
      .catch(() => undefined);
  }, []);

  // Subscribe to published courses in Firestore
  useEffect(() => {
    const q = query(collection(db, 'courses'), where('status', '==', 'published'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setFirestoreCourses(snap.docs.map((d) => d.data() as Course));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'courses');
      }
    );
    return () => unsub();
  }, []);

  const claimSessionLock = useCallback(
    async (user: User) => {
      const sessPath = `active_sessions/${user.uid}`;
      try {
        await setDoc(doc(db, 'active_sessions', user.uid), {
          uid: user.uid,
          sessionId,
          deviceLabel,
          updatedAt: serverTimestamp(),
        });
        setSessionConfirmed(true);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, sessPath);
      }
    },
    [deviceLabel, sessionId]
  );

  const persistRegistrationIntake = useCallback(
    async (user: User, intake: RegistrationIntake, hasExistingProfile: boolean) => {
      const userPath = `users/${user.uid}`;
      const privatePath = `users/${user.uid}/private/info`;

      const profilePayload: UserProfile = {
        uid: user.uid,
        displayName: intake.fullName.slice(0, 100),
        role: intake.role,
        track: intake.track,
        ...(intake.institution ? { institution: intake.institution.slice(0, 120) } : {}),
      };

      try {
        if (hasExistingProfile) {
          await updateDoc(doc(db, 'users', user.uid), {
            displayName: profilePayload.displayName,
            role: profilePayload.role,
            track: profilePayload.track,
            ...(profilePayload.institution ? { institution: profilePayload.institution } : {}),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'users', user.uid), {
            ...profilePayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        const primaryEmail = (
          intake.contactMethod === 'email'
            ? intake.contactValue
            : user.email || 'user@lawstead.edu'
        ).slice(0, 200);

        await setDoc(doc(db, 'users', user.uid, 'private', 'info'), {
          uid: user.uid,
          email: primaryEmail,
          dob: intake.dob.slice(0, 20),
          contactMethod: intake.contactMethod,
          ...(intake.contactMethod === 'phone'
            ? { phoneNumber: intake.contactValue.slice(0, 30) }
            : {}),
          updatedAt: serverTimestamp(),
        });

        setUserProfile(profilePayload);
        setVisitorTrack(intake.track);
        setAuthModalOpen(false);
        pendingIntakeRef.current = null;

        if (intake.role === 'tutor') {
          if (window.location.pathname === '/register/tutor') {
            window.history.replaceState({}, '', '/');
            setIsTutorRegisterRoute(false);
          }
          setActiveTab('tutor_studio');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `${userPath} / ${privatePath}`);
      }
    },
    []
  );

  const hydrateUserProfile = useCallback(
    async (user: User) => {
      const userPath = `users/${user.uid}`;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const pending = pendingIntakeRef.current;

        if (pending) {
          await persistRegistrationIntake(user, pending, snap.exists());
          return;
        }

        if (snap.exists()) {
          const profile = snap.data() as UserProfile;
          setUserProfile(profile);
          setVisitorTrack(profile.track);
          setAuthModalOpen(false);

          // Registered tutors logging back in from main Sign In enter their Tutor Studio directly
          if (profile.role === 'tutor' && window.location.pathname !== '/register/tutor') {
            setActiveTab('tutor_studio');
          }
        } else {
          setAuthModalMode('onboarding');
          setAuthModalOpen(true);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, userPath);
      }
    },
    [persistRegistrationIntake]
  );

  // Firebase Auth listener + Single-Session lock verification
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);

      if (!user) {
        setUserProfile(null);
        setSessionConfirmed(false);
        setEnrollments([]);
        return;
      }

      try {
        const sessSnap = await getDoc(doc(db, 'active_sessions', user.uid));
        if (sessSnap.exists()) {
          const data = sessSnap.data() as ActiveSession & { updatedAt?: Timestamp };
          const updatedMillis = data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now();
          const isRecent = Date.now() - updatedMillis < 5 * 60 * 1000;
          if (data.sessionId && data.sessionId !== sessionId && isRecent) {
            setSessionConfirmed(false);
            setSessionConflict({
              uid: user.uid,
              deviceLabel: data.deviceLabel || 'Another Device',
              user,
            });
            return;
          }
        }
        await claimSessionLock(user);
        await hydrateUserProfile(user);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `active_sessions/${user.uid}`);
      }
    });

    return () => unsub();
  }, [claimSessionLock, hydrateUserProfile, sessionId]);

  // Real-time Single-Session Displacement Watcher + Heartbeat
  useEffect(() => {
    if (!authReady || !firebaseUser || !sessionConfirmed) return;

    const sessDocRef = doc(db, 'active_sessions', firebaseUser.uid);
    const unsub = onSnapshot(
      sessDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as ActiveSession;
        if (data.sessionId && data.sessionId !== sessionId && !intentionalSignOutRef.current) {
          setSessionConfirmed(false);
          setUserProfile(null);
          void signOut(auth);
          setKickedMessage(
            `Another login occurred from "${data.deviceLabel}". LAW STEAD allows only one person to be logged into an account at the same time.`
          );
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `active_sessions/${firebaseUser.uid}`);
      }
    );

    const heartbeat = window.setInterval(() => {
      void setDoc(
        sessDocRef,
        {
          uid: firebaseUser.uid,
          sessionId,
          deviceLabel,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch(() => undefined);
    }, 25000);

    return () => {
      unsub();
      window.clearInterval(heartbeat);
    };
  }, [authReady, firebaseUser, sessionConfirmed, sessionId, deviceLabel]);

  // Subscribe to student's enrollments
  useEffect(() => {
    if (!authReady || !firebaseUser || !sessionConfirmed) {
      setEnrollments([]);
      return;
    }
    const q = query(
      collection(db, 'enrollments'),
      where('studentId', '==', firebaseUser.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEnrollments(snap.docs.map((d) => d.data() as Enrollment));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'enrollments');
      }
    );
    return () => unsub();
  }, [authReady, firebaseUser, sessionConfirmed]);

  const formatAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('auth/operation-not-allowed')) {
      return 'Email/Password sign-in is not yet enabled in your Firebase Console (Authentication → Sign-in method → Email/Password). Enable it there or use Google Sign-In below.';
    }
    if (msg.includes('auth/email-already-in-use')) {
      return 'An account with this email or phone number already exists. Please use Sign In instead.';
    }
    if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password') || msg.includes('auth/user-not-found')) {
      return 'Invalid login credentials. Check your email/phone and password.';
    }
    return msg || 'Authentication failed.';
  };

  const handleEmailPasswordLogin = async (
    method: ContactLoginMethod,
    identifier: string,
    password: string
  ) => {
    setAuthError(null);
    setAuthBusy(true);
    pendingIntakeRef.current = null;
    try {
      const authEmail = toAuthIdentifier(method, identifier);
      await signInWithEmailAndPassword(auth, authEmail, password);
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailPasswordSignUp = async (intake: RegistrationIntake) => {
    if (!intake.password) return;
    setAuthError(null);
    setAuthBusy(true);
    pendingIntakeRef.current = { ...intake, password: undefined };
    try {
      const authEmail = toAuthIdentifier(intake.contactMethod, intake.contactValue);
      const cred = await createUserWithEmailAndPassword(auth, authEmail, intake.password);
      await updateProfile(cred.user, { displayName: intake.fullName.slice(0, 100) }).catch(
        () => undefined
      );
    } catch (err) {
      pendingIntakeRef.current = null;
      setAuthError(formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthBusy(true);
    pendingIntakeRef.current = null;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCompleteOnboarding = async (intake: RegistrationIntake) => {
    const user = auth.currentUser;
    if (!user) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      await persistRegistrationIntake(user, intake, snap.exists());
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCreateTutorPasswordAccount = async (intake: RegistrationIntake) => {
    if (!intake.password) return;
    setAuthError(null);
    setAuthBusy(true);
    pendingIntakeRef.current = { ...intake, password: undefined };
    try {
      const authEmail = toAuthIdentifier(intake.contactMethod, intake.contactValue);
      const cred = await createUserWithEmailAndPassword(auth, authEmail, intake.password);
      await updateProfile(cred.user, { displayName: intake.fullName.slice(0, 100) }).catch(
        () => undefined
      );
    } catch (err) {
      pendingIntakeRef.current = null;
      setAuthError(formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleContinueTutorWithGoogle = async (
    intake: Omit<RegistrationIntake, 'password'> | null
  ) => {
    setAuthError(null);
    setAuthBusy(true);
    pendingIntakeRef.current = intake;
    try {
      const current = auth.currentUser;
      if (current && sessionConfirmed) {
        const snap = await getDoc(doc(db, 'users', current.uid));
        if (intake) {
          await persistRegistrationIntake(current, intake, snap.exists());
        } else {
          await persistRegistrationIntake(
            current,
            {
              fullName: current.displayName || 'LAW STEAD Tutor',
              dob: '',
              contactMethod: 'email',
              contactValue: current.email || 'tutor@lawstead.edu',
              track: 'university',
              role: 'tutor',
            },
            snap.exists()
          );
        }
      } else {
        if (!intake) {
          pendingIntakeRef.current = {
            fullName: 'LAW STEAD Tutor',
            dob: '',
            contactMethod: 'email',
            contactValue: '',
            track: 'university',
            role: 'tutor',
          };
        }
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      pendingIntakeRef.current = null;
      setAuthError(formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAccountMenuOpen(false);
    intentionalSignOutRef.current = true;
    const uid = auth.currentUser?.uid;
    if (uid) {
      await deleteDoc(doc(db, 'active_sessions', uid)).catch(() => undefined);
    }
    await signOut(auth);
    setSessionConfirmed(false);
    setUserProfile(null);
    if (activeTab === 'tutor_studio' || activeTab === 'my_learning') {
      setActiveTab('home');
    }
    window.setTimeout(() => {
      intentionalSignOutRef.current = false;
    }, 500);
  };

  const handleTakeOverSession = async () => {
    if (!sessionConflict) return;
    setAuthBusy(true);
    try {
      await claimSessionLock(sessionConflict.user);
      await hydrateUserProfile(sessionConflict.user);
      setSessionConflict(null);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCancelConflict = async () => {
    setSessionConflict(null);
    pendingIntakeRef.current = null;
    await signOut(auth);
  };

  const handleSessionInvalidated = useCallback((reason: string) => {
    setSessionConfirmed(false);
    setUserProfile(null);
    void signOut(auth);
    setKickedMessage(reason);
  }, []);

  // Merge Firestore tutor-published courses + foundational catalog
  const allCourses = useMemo(() => {
    const map = new Map<string, Course>();
    for (const c of seededCourses) map.set(c.id, c);
    for (const c of firestoreCourses) map.set(c.id, c);
    return Array.from(map.values());
  }, [seededCourses, firestoreCourses]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allCourses.filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        c.tutorName.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q)
      );
    });
  }, [allCourses, searchQuery]);

  const universityCourses = useMemo(
    () => filteredCourses.filter((c) => c.section === 'university'),
    [filteredCourses]
  );

  const lawSchoolCourses = useMemo(
    () => filteredCourses.filter((c) => c.section === 'law_school'),
    [filteredCourses]
  );

  const enrolledCourseIds = useMemo(
    () => new Set(enrollments.map((e) => e.courseId)),
    [enrollments]
  );

  const enrolledCoursesList = useMemo(
    () => allCourses.filter((c) => enrolledCourseIds.has(c.id)),
    [allCourses, enrolledCourseIds]
  );

  const openCourse = (course: Course) => {
    setSelectedCourse(course);
    setActiveTab('course');
    setMobileMenuOpen(false);
    setVisitingMenuOpen(false);
    setAccountMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const visitingLabel =
    visitorTrack === 'university'
      ? 'University Student'
      : visitorTrack === 'law_school'
      ? 'Law School Student'
      : 'All Tracks';

  // Dedicated hidden /register/tutor route view
  if (isTutorRegisterRoute) {
    return (
      <>
        <TutorRegistrationPage
          busy={authBusy}
          error={authError}
          alreadySignedInEmail={firebaseUser?.email || null}
          onCreateTutorPasswordAccount={(intake) => void handleCreateTutorPasswordAccount(intake)}
          onContinueTutorWithGoogle={(intake) => void handleContinueTutorWithGoogle(intake)}
          onBackToHome={() => {
            window.history.pushState({}, '', '/');
            setIsTutorRegisterRoute(false);
            setActiveTab('home');
          }}
        />
        <SingleSessionModal
          conflictInfo={sessionConflict ? { deviceLabel: sessionConflict.deviceLabel } : null}
          kickedMessage={kickedMessage}
          busy={authBusy}
          onCancelConflict={() => void handleCancelConflict()}
          onTakeOverSession={() => void handleTakeOverSession()}
          onDismissKicked={() => setKickedMessage(null)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#0F172A]">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-3 md:gap-8">
          {/* Zone 1: Mobile Menu Toggle + Single-line Brand Wordmark */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen((prev) => !prev);
                setAccountMenuOpen(false);
              }}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden w-11 h-11 -ml-2 rounded-lg flex items-center justify-center text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('home');
                setMobileMenuOpen(false);
              }}
              className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0 cursor-pointer"
            >
              LAW STEAD
            </button>
          </div>

          {/* Zone 2: Requested 4 Navigation Links with Functional Icons */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className={`inline-flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'home'
                  ? 'text-[#0F172A] underline underline-offset-8 decoration-2 decoration-[#1E3A5F]'
                  : 'hover:text-[#0F172A]'
              }`}
            >
              <Home className="w-4 h-4" />
              Home
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`inline-flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'about'
                  ? 'text-[#0F172A] underline underline-offset-8 decoration-2 decoration-[#1E3A5F]'
                  : 'hover:text-[#0F172A]'
              }`}
            >
              <Scale className="w-4 h-4" />
              About Us
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setVisitingMenuOpen((prev) => !prev)}
                className="inline-flex items-center gap-1.5 py-1 hover:text-[#0F172A] transition-colors whitespace-nowrap shrink-0"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Visiting as: {visitingLabel}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {visitingMenuOpen && (
                <div className="absolute left-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                  <button
                    type="button"
                    onClick={() => {
                      setVisitorTrack('university');
                      setVisitingMenuOpen(false);
                      setActiveTab('home');
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                      visitorTrack === 'university' ? 'font-semibold text-[#0F172A]' : 'text-slate-700'
                    }`}
                  >
                    University Student (University Law)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVisitorTrack('law_school');
                      setVisitingMenuOpen(false);
                      setActiveTab('home');
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                      visitorTrack === 'law_school' ? 'font-semibold text-[#0F172A]' : 'text-slate-700'
                    }`}
                  >
                    Law School Student (Law School)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVisitorTrack('all');
                      setVisitingMenuOpen(false);
                      setActiveTab('home');
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${
                      visitorTrack === 'all' ? 'font-semibold text-[#0F172A]' : 'text-slate-700'
                    }`}
                  >
                    All Legal Sections
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className={`inline-flex items-center gap-1.5 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'contact'
                  ? 'text-[#0F172A] underline underline-offset-8 decoration-2 decoration-[#1E3A5F]'
                  : 'hover:text-[#0F172A]'
              }`}
            >
              <Mail className="w-4 h-4" />
              Contact Us
            </button>
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="relative shrink-0">
            {userProfile && sessionConfirmed ? (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen((prev) => !prev);
                    setMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-2 min-h-[40px] md:min-h-0 px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E3A5F] transition-colors whitespace-nowrap shrink-0"
                >
                  <UserIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="max-w-[96px] sm:max-w-[140px] truncate">{userProfile.displayName}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                </button>

                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {userProfile.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {userProfile.track === 'university' ? 'University Law' : 'Law School'}
                      </p>
                    </div>
                    {userProfile.role === 'tutor' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setActiveTab('tutor_studio');
                        }}
                        className="w-full min-h-[44px] sm:min-h-0 text-left px-4 py-2 text-sm font-medium text-[#1E3A5F] hover:bg-slate-50"
                      >
                        Tutor Studio
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        setActiveTab('my_learning');
                      }}
                      className="w-full min-h-[44px] sm:min-h-0 text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      My Learning ({enrollments.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      className="w-full min-h-[44px] sm:min-h-0 text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 inline-flex items-center gap-2 border-t border-slate-100 mt-1 pt-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setAuthModalMode('signin');
                  setAuthError(null);
                  setAuthModalOpen(true);
                }}
                className="min-h-[40px] md:min-h-0 px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-[#1E3A5F] transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Mobile Drawer (only shown when toggled) */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setActiveTab('home');
                setMobileMenuOpen(false);
              }}
              className={`w-full min-h-[44px] px-3 rounded-lg flex items-center gap-2.5 text-sm font-medium transition-colors ${
                activeTab === 'home'
                  ? 'bg-slate-100 text-[#0F172A] font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Home className="w-4 h-4 shrink-0" />
              Home
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('about');
                setMobileMenuOpen(false);
              }}
              className={`w-full min-h-[44px] px-3 rounded-lg flex items-center gap-2.5 text-sm font-medium transition-colors ${
                activeTab === 'about'
                  ? 'bg-slate-100 text-[#0F172A] font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Scale className="w-4 h-4 shrink-0" />
              About Us
            </button>

            <div className="pt-2 pb-1 px-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1.5">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Visiting as</span>
              </div>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setVisitorTrack('all');
                    setActiveTab('home');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[40px] px-3 rounded-lg text-left text-xs transition-colors ${
                    visitorTrack === 'all'
                      ? 'bg-[#0F172A] text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  All Legal Sections
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVisitorTrack('university');
                    setActiveTab('home');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[40px] px-3 rounded-lg text-left text-xs transition-colors ${
                    visitorTrack === 'university'
                      ? 'bg-[#0F172A] text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  University Student (University Law)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVisitorTrack('law_school');
                    setActiveTab('home');
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full min-h-[40px] px-3 rounded-lg text-left text-xs transition-colors ${
                    visitorTrack === 'law_school'
                      ? 'bg-[#0F172A] text-white font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Law School Student (Law School)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('contact');
                setMobileMenuOpen(false);
              }}
              className={`w-full min-h-[44px] px-3 rounded-lg flex items-center gap-2.5 text-sm font-medium border-t border-slate-100 pt-2 transition-colors ${
                activeTab === 'contact'
                  ? 'bg-slate-100 text-[#0F172A] font-semibold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Mail className="w-4 h-4 shrink-0" />
              Contact Us
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        {activeTab === 'home' && (
          <>
            {/* Hero 2-Column Split */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-6 sm:pt-10 sm:pb-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 items-stretch">
                <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5 sm:p-8 lg:p-10 flex flex-col justify-between gap-6 sm:gap-8">
                  <div className="space-y-3 sm:space-y-4">
                    <p className="text-xs font-medium text-[#1E3A5F]">
                      University Law &amp; Law School Marketplace
                    </p>
                    <h1 className="font-display text-2xl sm:text-4xl lg:text-[42px] font-semibold text-slate-900 leading-[1.15] text-balance">
                      Structured Legal Lectures from Practicing Counsel and Faculty
                    </h1>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                      Watch complimentary course introduction videos across University Law and Law School curricula, enroll in full modules, and stream lessons securely without file downloads.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                    <a
                      href="#catalog"
                      className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] transition-colors whitespace-nowrap shrink-0"
                    >
                      Explore Courses
                    </a>
                    <button
                      type="button"
                      onClick={() => setActiveTab('about')}
                      className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-slate-200 text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      About LAW STEAD
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-56 sm:h-72 lg:h-auto lg:min-h-[280px]">
                  {!heroImgFailed ? (
                    <img
                      src={HERO_IMAGE_URL}
                      alt="LAW STEAD University Law Library and Moot Courtroom"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] flex flex-col items-center justify-center p-8 sm:p-10 text-white text-center">
                      <Scale className="w-10 h-10 text-amber-300 mb-3" />
                      <p className="font-display text-2xl font-semibold">LAW STEAD</p>
                    </div>
                  )}
                </div>
              </div>

              {/* 4-Column Summary Strip Below Hero Split */}
              <div className="mt-5 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                  <p className="text-[11px] sm:text-xs text-slate-500">Section 01</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-900 mt-1">University Law</p>
                  <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                    {universityCourses.length} Available Courses
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                  <p className="text-[11px] sm:text-xs text-slate-500">Section 02</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-900 mt-1">Law School</p>
                  <p className="text-xs text-slate-600 mt-1 font-mono-tabular">
                    {lawSchoolCourses.length} Bar Practice Courses
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                  <p className="text-[11px] sm:text-xs text-slate-500">Course Previews</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-900 mt-1">Free Intro Videos</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Preview Lesson 1 before buying
                  </p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5">
                  <p className="text-[11px] sm:text-xs text-slate-500">Security Guarantee</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-900 mt-1">Single-Login Stream</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Non-downloadable playback
                  </p>
                </div>
              </div>
            </section>

            {/* Interactive Visiting As Toolbar + Dual Sections */}
            <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-10 sm:space-y-12">
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 min-w-0">
                  <span className="text-xs font-semibold text-slate-700 shrink-0">Visiting as:</span>
                  <div className="flex flex-wrap sm:inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setVisitorTrack('all')}
                      className={`flex-1 sm:flex-initial min-h-[40px] sm:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        visitorTrack === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Tracks
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitorTrack('university')}
                      className={`flex-1 sm:flex-initial min-h-[40px] sm:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        visitorTrack === 'university'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      University Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitorTrack('law_school')}
                      className={`flex-1 sm:flex-initial min-h-[40px] sm:min-h-0 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        visitorTrack === 'law_school'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Law School Student
                    </button>
                  </div>
                </div>

                <div className="relative w-full md:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search courses or tutors..."
                    className="w-full min-h-[44px] md:min-h-0 pl-9 pr-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                  />
                </div>
              </div>

              {/* Section 1: University Law */}
              {(visitorTrack === 'all' || visitorTrack === 'university') && (
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Section 01</p>
                      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-0.5">
                        University Law
                      </h2>
                    </div>
                    <p className="text-sm text-slate-600">
                      Foundational LL.B. modules and academic case analysis
                    </p>
                  </div>

                  {universityCourses.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-sm text-slate-500">
                      No University Law courses match your current search.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                      {universityCourses.map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          isEnrolled={enrolledCourseIds.has(course.id)}
                          onOpenCourse={openCourse}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section 2: Law School */}
              {(visitorTrack === 'all' || visitorTrack === 'law_school') && (
                <div className="space-y-5 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-slate-200 pb-4">
                    <div>
                      <p className="text-xs font-medium text-slate-500">Section 02</p>
                      <h2 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-0.5">
                        Law School
                      </h2>
                    </div>
                    <p className="text-sm text-slate-600">
                      Bar finals, litigation drafting, and vocational practice
                    </p>
                  </div>

                  {lawSchoolCourses.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-sm text-slate-500">
                      No Law School courses match your current search.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                      {lawSchoolCourses.map((course) => (
                        <CourseCard
                          key={course.id}
                          course={course}
                          isEnrolled={enrolledCourseIds.has(course.id)}
                          onOpenCourse={openCourse}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'course' && selectedCourse && (
          <CourseDetailView
            course={selectedCourse}
            seededLessons={seededLessonsByCourse[selectedCourse.id]}
            userProfile={sessionConfirmed ? userProfile : null}
            viewerEmail={firebaseUser?.email || null}
            enrollment={enrollments.find((e) => e.courseId === selectedCourse.id) || null}
            sessionId={sessionId}
            onBack={() => setActiveTab('home')}
            onRequireSignIn={() => {
              setAuthModalMode('signin');
              setAuthModalOpen(true);
            }}
            onSessionInvalidated={handleSessionInvalidated}
          />
        )}

        {activeTab === 'my_learning' && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div>
                <p className="text-xs font-medium text-slate-500">Student Library</p>
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-1">
                  My Enrolled Courses
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('home')}
                className="min-h-[44px] sm:min-h-0 self-start sm:self-auto inline-flex items-center text-sm font-medium text-[#1E3A5F] hover:text-[#0F172A] whitespace-nowrap"
              >
                Browse More Courses
              </button>
            </div>

            {enrolledCoursesList.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 text-center space-y-4">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm text-slate-600">
                  You have not purchased any courses yet. Preview free course introductions on the catalog and enroll anytime.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('home')}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E3A5F]"
                >
                  Explore LAW STEAD Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {enrolledCoursesList.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    isEnrolled={true}
                    onOpenCourse={openCourse}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'tutor_studio' && userProfile && sessionConfirmed && (
          <TutorStudio
            userProfile={userProfile}
            sessionId={sessionId}
            onOpenCourse={openCourse}
            onSessionInvalidated={handleSessionInvalidated}
          />
        )}

        {activeTab === 'about' && (
          <AboutSection
            onExploreSection={(sec) => {
              setVisitorTrack(sec);
              setActiveTab('home');
            }}
          />
        )}

        {activeTab === 'contact' && (
          <ContactSection
            currentTrack={visitorTrack}
            defaultName={userProfile?.displayName || ''}
            defaultEmail={firebaseUser?.email || ''}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-10 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div className="space-y-1">
            <p className="font-display text-sm font-semibold text-slate-900">LAW STEAD</p>
            <p>University Law &amp; Law School Education · Protected Stream-Only Lectures</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button
              type="button"
              onClick={() => {
                setVisitorTrack('university');
                setActiveTab('home');
              }}
              className="py-1.5 hover:text-slate-900 transition-colors"
            >
              University Law
            </button>
            <button
              type="button"
              onClick={() => {
                setVisitorTrack('law_school');
                setActiveTab('home');
              }}
              className="py-1.5 hover:text-slate-900 transition-colors"
            >
              Law School
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className="py-1.5 hover:text-slate-900 transition-colors"
            >
              About Us
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className="py-1.5 hover:text-slate-900 transition-colors"
            >
              Contact Us
            </button>
          </div>
        </div>
      </footer>

      {/* Auth / Onboarding Modal */}
      <AuthModal
        open={authModalOpen}
        mode={authModalMode}
        initialTrack={visitorTrack === 'law_school' ? 'law_school' : 'university'}
        defaultDisplayName={firebaseUser?.displayName || ''}
        defaultEmail={firebaseUser?.email || ''}
        busy={authBusy}
        error={authError}
        onClose={() => setAuthModalOpen(false)}
        onEmailPasswordLogin={(method, identifier, pwd) =>
          void handleEmailPasswordLogin(method, identifier, pwd)
        }
        onEmailPasswordSignUp={(intake) => void handleEmailPasswordSignUp(intake)}
        onGoogleSignIn={() => void handleGoogleSignIn()}
        onCompleteOnboarding={(intake) => void handleCompleteOnboarding(intake)}
      />

      {/* Single-Session Conflict / Kickout Modal */}
      <SingleSessionModal
        conflictInfo={sessionConflict ? { deviceLabel: sessionConflict.deviceLabel } : null}
        kickedMessage={kickedMessage}
        busy={authBusy}
        onCancelConflict={() => void handleCancelConflict()}
        onTakeOverSession={() => void handleTakeOverSession()}
        onDismissKicked={() => setKickedMessage(null)}
      />
    </div>
  );
}
