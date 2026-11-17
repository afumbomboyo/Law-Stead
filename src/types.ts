export type UserRole = 'student' | 'tutor';
export type LegalSection = 'university' | 'law_school';
export type VisitorTrack = 'all' | 'university' | 'law_school';
export type ActiveTab = 'home' | 'about' | 'contact' | 'course' | 'tutor_studio' | 'my_learning';
export type ContactLoginMethod = 'email' | 'phone';

export interface RegistrationIntake {
  fullName: string;
  dob: string;
  contactMethod: ContactLoginMethod;
  contactValue: string;
  track: LegalSection;
  role: UserRole;
  institution?: string;
  password?: string;
}

export function toAuthIdentifier(method: ContactLoginMethod, rawValue: string): string {
  if (method === 'email') {
    return rawValue.trim().toLowerCase();
  }
  const digits = rawValue.replace(/\D/g, '');
  return `phone_${digits}@users.lawstead.internal`;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  track: LegalSection;
  institution?: string;
  bio?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Course {
  id: string;
  tutorId: string;
  tutorName: string;
  title: string;
  subtitle: string;
  description: string;
  section: LegalSection;
  subject: string;
  price: number;
  thumbnailUrl: string;
  introVideoId: string;
  introDurationLabel: string;
  lessonCount: number;
  status: 'published' | 'draft';
  isSeeded?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Lesson {
  id: string;
  courseId: string;
  tutorId: string;
  courseStatus: 'published' | 'draft';
  title: string;
  summary?: string;
  order: number;
  durationLabel: string;
  isFreeIntro: boolean;
  videoId: string;
  createdAt?: unknown;
}

export interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  tutorId: string;
  courseTitle: string;
  amountPaid: number;
  purchasedAt?: unknown;
}

export interface ActiveSession {
  uid: string;
  sessionId: string;
  deviceLabel: string;
  updatedAt?: unknown;
}

// Synchronized verbatim with firebase-blueprint.json schema bounds
export const BLUEPRINT_LIMITS = {
  idRegex: /^[a-zA-Z0-9_-]+$/,
  idMax: 128,
  displayNameMin: 2,
  displayNameMax: 100,
  institutionMax: 120,
  bioMax: 500,
  titleMin: 3,
  titleMax: 140,
  subtitleMin: 3,
  subtitleMax: 240,
  descriptionMin: 10,
  descriptionMax: 3000,
  subjectMin: 2,
  subjectMax: 80,
  priceMin: 0,
  priceMax: 10000000,
  summaryMax: 600,
  durationMax: 32,
  lessonTitleMin: 2,
  lessonTitleMax: 140,
  lessonMaxCount: 200,
} as const;

export const CURATED_COURSE_THUMBNAILS = [
  {
    label: 'Constitutional Chambers',
    url: '/src/assets/images/course_constitutional_law_1794933669849.jpg',
  },
  {
    label: 'Contract & Case Files',
    url: '/src/assets/images/course_contract_law_1794933670041.jpg',
  },
  {
    label: 'Appellate Advocacy',
    url: '/src/assets/images/course_criminal_litigation_1794933670886.jpg',
  },
  {
    label: 'Corporate Law Practice',
    url: '/src/assets/images/course_corporate_practice_1794933670422.jpg',
  },
] as const;

export function sanitizeIdSegment(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return cleaned.length >= 3 ? cleaned : `id_${Date.now()}`;
}

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
