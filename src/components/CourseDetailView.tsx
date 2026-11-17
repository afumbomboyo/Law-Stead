import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Course, Enrollment, Lesson, UserProfile, formatNaira } from '../types';
import { ProtectedVideoPlayer } from './ProtectedVideoPlayer';

interface CourseDetailViewProps {
  course: Course;
  seededLessons?: Lesson[];
  userProfile: UserProfile | null;
  viewerEmail: string | null;
  enrollment: Enrollment | null;
  sessionId: string;
  onBack: () => void;
  onRequireSignIn: () => void;
  onSessionInvalidated: (reason: string) => void;
}

export const CourseDetailView: React.FC<CourseDetailViewProps> = ({
  course,
  seededLessons,
  userProfile,
  viewerEmail,
  enrollment,
  sessionId,
  onBack,
  onRequireSignIn,
  onSessionInvalidated,
}) => {
  const [lessons, setLessons] = useState<Lesson[]>(seededLessons || []);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    seededLessons?.[0]?.id || ''
  );
  const [buying, setBuying] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  const isTutorOwner = Boolean(userProfile && userProfile.uid === course.tutorId);
  const hasFullAccess = Boolean(enrollment || isTutorOwner);

  useEffect(() => {
    if (course.isSeeded && seededLessons) {
      setLessons(seededLessons);
      if (seededLessons.length > 0) {
        setSelectedLessonId((prev) =>
          seededLessons.some((l) => l.id === prev) ? prev : seededLessons[0].id
        );
      }
      return;
    }

    const lessonsPath = `courses/${course.id}/lessons`;
    const q = query(collection(db, lessonsPath), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Lesson[] = snapshot.docs.map((d) => d.data() as Lesson);
        setLessons(list);
        if (list.length > 0) {
          setSelectedLessonId((prev) =>
            list.some((l) => l.id === prev) ? prev : list[0].id
          );
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, lessonsPath);
      }
    );

    return () => unsub();
  }, [course.id, course.isSeeded, seededLessons]);

  const activeLesson =
    lessons.find((l) => l.id === selectedLessonId) ||
    lessons[0] || {
      id: 'intro_fallback',
      courseId: course.id,
      tutorId: course.tutorId,
      courseStatus: course.status,
      title: 'Course Introduction Video',
      summary: course.subtitle,
      order: 1,
      durationLabel: course.introDurationLabel,
      isFreeIntro: true,
      videoId: course.introVideoId,
    };

  const handleBuyCourse = async () => {
    setPurchaseError(null);
    const user = auth.currentUser;
    if (!user || !userProfile) {
      onRequireSignIn();
      return;
    }

    if (hasFullAccess) return;

    setBuying(true);
    const enrollmentId = `${user.uid}_${course.id}`;
    const docPath = `enrollments/${enrollmentId}`;
    try {
      await setDoc(doc(db, 'enrollments', enrollmentId), {
        id: enrollmentId,
        studentId: user.uid,
        courseId: course.id,
        tutorId: course.tutorId,
        courseTitle: course.title.slice(0, 140),
        amountPaid: course.price,
        purchasedAt: serverTimestamp(),
      });
      setPurchaseSuccess(true);
    } catch (err) {
      setPurchaseError(
        err instanceof Error ? err.message : 'Unable to complete course enrollment.'
      );
      handleFirestoreError(err, OperationType.CREATE, docPath);
    } finally {
      setBuying(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-0 self-start text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Course Catalog
        </button>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span>{course.section === 'university' ? 'University Law' : 'Law School'}</span>
          <span aria-hidden="true">·</span>
          <span>{course.subject}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">{lessons.length || course.lessonCount} Lessons</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Video Theater (1st on mobile, top-left on desktop) */}
        <div className="lg:col-span-8 min-w-0">
          <ProtectedVideoPlayer
            courseId={course.id}
            lessonId={activeLesson.id}
            lessonTitle={activeLesson.title}
            videoId={activeLesson.videoId}
            isFreeIntro={activeLesson.isFreeIntro}
            hasAccess={hasFullAccess}
            coursePrice={course.price}
            sessionId={sessionId}
            viewerLabel={viewerEmail || userProfile?.displayName || 'LAW STEAD Preview'}
            onPurchaseClick={() => void handleBuyCourse()}
            onSessionInvalidated={onSessionInvalidated}
          />
        </div>

        {/* Purchase & Lesson List (2nd on mobile, sticky right column on desktop) */}
        <aside className="lg:col-span-4 lg:row-span-2 space-y-5 sm:space-y-6 lg:sticky lg:top-20 min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 sm:space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">Full Course Access</p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono-tabular mt-1">
                  {formatNaira(course.price)}
                </p>
              </div>
              <span className="text-xs font-medium text-slate-600 font-mono-tabular">
                {lessons.length || course.lessonCount} Lectures
              </span>
            </div>

            {purchaseError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                {purchaseError}
              </p>
            )}

            {hasFullAccess ? (
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-900 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isTutorOwner
                    ? 'Instructor Access · You own this course'
                    : purchaseSuccess
                    ? 'Purchase Complete · All lessons unlocked'
                    : 'Enrolled · Full Course Unlocked'}
                </span>
              </div>
            ) : (
              <button
                type="button"
                disabled={buying}
                onClick={() => void handleBuyCourse()}
                className="w-full min-h-[44px] py-3 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors"
              >
                {buying
                  ? 'Confirming Enrollment...'
                  : userProfile
                  ? `Buy Course · ${formatNaira(course.price)}`
                  : 'Sign In to Buy Course'}
              </button>
            )}

            <div className="flex items-start gap-2 text-xs text-slate-500 pt-1">
              <ShieldCheck className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5" />
              <span>
                Free introduction video included. Stream-only playback protects tutor IP against phone downloads.
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Course Lessons</h3>
              <span className="text-xs text-slate-500 font-mono-tabular">
                {lessons.length} total
              </span>
            </div>

            <div className="divide-y divide-slate-100 max-h-[380px] sm:max-h-[460px] overflow-y-auto">
              {lessons.length === 0 ? (
                <div className="p-5 text-xs text-slate-500">
                  No lessons uploaded yet.
                </div>
              ) : (
                lessons.map((lesson) => {
                  const isSelected = lesson.id === activeLesson.id;
                  const unlocked = lesson.isFreeIntro || hasFullAccess;

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => setSelectedLessonId(lesson.id)}
                      className={`w-full min-h-[52px] text-left px-4 sm:px-5 py-3.5 flex items-start gap-3 transition-colors ${
                        isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {unlocked ? (
                          <PlayCircle
                            className={`w-4 h-4 ${
                              isSelected ? 'text-[#0F172A]' : 'text-[#1E3A5F]'
                            }`}
                          />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p
                          className={`text-sm leading-snug ${
                            isSelected ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'
                          }`}
                        >
                          {lesson.order}. {lesson.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span>{lesson.isFreeIntro ? 'Free Intro' : unlocked ? 'Unlocked' : 'Paid Lesson'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{lesson.durationLabel}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Course Description & Syllabus Overview (3rd on mobile, bottom-left on desktop) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-5 sm:space-y-6 min-w-0">
          <div className="space-y-2 border-b border-slate-100 pb-5 sm:pb-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{activeLesson.isFreeIntro ? 'Free Introduction Video' : `Lesson ${activeLesson.order}`}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">{activeLesson.durationLabel}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 text-balance">
              {course.title}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {course.subtitle}
            </p>
            <p className="text-xs font-medium text-slate-700 pt-1">
              Instructed by {course.tutorName}
            </p>
          </div>

          <div className="space-y-2.5 sm:space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Currently Selected Lesson
            </h2>
            <p className="text-sm font-medium text-slate-800">{activeLesson.title}</p>
            {activeLesson.summary && (
              <p className="text-sm text-slate-600 leading-relaxed">{activeLesson.summary}</p>
            )}
          </div>

          <div className="space-y-2.5 sm:space-y-3 pt-4 border-t border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">
              Course Syllabus Overview
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
              {course.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
