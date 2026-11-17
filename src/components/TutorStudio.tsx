import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  Film,
  Plus,
  Upload,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  BLUEPRINT_LIMITS,
  CURATED_COURSE_THUMBNAILS,
  Course,
  Enrollment,
  LegalSection,
  Lesson,
  UserProfile,
  formatNaira,
  sanitizeIdSegment,
} from '../types';

interface TutorStudioProps {
  userProfile: UserProfile;
  sessionId: string;
  onOpenCourse: (course: Course) => void;
  onSessionInvalidated: (reason: string) => void;
}

function readVideoDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const secs = Math.max(1, Math.round(video.duration || 10));
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      URL.revokeObjectURL(url);
      resolve(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('01:00');
    };
    video.src = url;
  });
}

export const TutorStudio: React.FC<TutorStudioProps> = ({
  userProfile,
  sessionId,
  onOpenCourse,
  onSessionInvalidated,
}) => {
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseLessons, setCourseLessons] = useState<Lesson[]>([]);
  const [mySales, setMySales] = useState<Enrollment[]>([]);

  // Course creation state
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [section, setSection] = useState<LegalSection>('university');
  const [subject, setSubject] = useState('Constitutional Law');
  const [price, setPrice] = useState('15000');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>(CURATED_COURSE_THUMBNAILS[0].url);
  const [introTitle, setIntroTitle] = useState('Course Introduction & Exam Strategy');
  const [introFile, setIntroFile] = useState<File | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Add lesson state
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSummary, setLessonSummary] = useState('');
  const [lessonFile, setLessonFile] = useState<File | null>(null);
  const [addingLesson, setAddingLesson] = useState(false);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load tutor's courses
  useEffect(() => {
    if (userProfile.role !== 'tutor') return;
    const q = query(
      collection(db, 'courses'),
      where('tutorId', '==', userProfile.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Course);
        setMyCourses(list);
        if (list.length > 0 && !selectedCourseId) {
          setSelectedCourseId(list[0].id);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'courses');
      }
    );
    return () => unsub();
  }, [userProfile.uid, userProfile.role, selectedCourseId]);

  // Load lessons for selected course
  useEffect(() => {
    if (!selectedCourseId) {
      setCourseLessons([]);
      return;
    }
    const lessonsPath = `courses/${selectedCourseId}/lessons`;
    const q = query(collection(db, lessonsPath), orderBy('order', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCourseLessons(snap.docs.map((d) => d.data() as Lesson));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, lessonsPath);
      }
    );
    return () => unsub();
  }, [selectedCourseId]);

  // Load tutor sales
  useEffect(() => {
    if (userProfile.role !== 'tutor') return;
    const q = query(
      collection(db, 'enrollments'),
      where('tutorId', '==', userProfile.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMySales(snap.docs.map((d) => d.data() as Enrollment));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'enrollments');
      }
    );
    return () => unsub();
  }, [userProfile.uid, userProfile.role]);


  const uploadVideoFile = async (file: File): Promise<{ videoId: string; durationLabel: string }> => {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be signed in to upload video files.');
    const idToken = await user.getIdToken();
    const durationLabel = await readVideoDuration(file);

    const formData = new FormData();
    formData.append('video', file);

    const resp = await fetch('/api/videos/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'x-session-id': sessionId,
      },
      body: formData,
    });

    const data = (await resp.json()) as { videoId?: string; error?: string };
    if (resp.status === 409) {
      onSessionInvalidated(data.error || 'Another device logged into this account.');
      throw new Error(data.error || 'Session replaced');
    }
    if (!resp.ok || !data.videoId) {
      throw new Error(data.error || 'Video upload failed.');
    }

    return { videoId: data.videoId, durationLabel };
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    if (title.trim().length < BLUEPRINT_LIMITS.titleMin) {
      setErrorMessage('Course title must be at least 3 characters.');
      return;
    }
    if (subtitle.trim().length < BLUEPRINT_LIMITS.subtitleMin) {
      setErrorMessage('Course subtitle must be at least 3 characters.');
      return;
    }
    if (description.trim().length < BLUEPRINT_LIMITS.descriptionMin) {
      setErrorMessage('Course description must be at least 10 characters.');
      return;
    }
    const parsedPrice = Number(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0 || parsedPrice > BLUEPRINT_LIMITS.priceMax) {
      setErrorMessage('Please enter a valid course price between ₦0 and ₦10,000,000.');
      return;
    }
    if (!introFile) {
      setErrorMessage('Please attach a free Introduction Video (.mp4 or .webm) for students to preview.');
      return;
    }

    setCreatingCourse(true);
    try {
      const { videoId, durationLabel } = await uploadVideoFile(introFile);
      const courseId = `crs_${sanitizeIdSegment(title)}_${Date.now().toString(36)}`;
      const introLessonId = `les_intro_${Date.now().toString(36)}`;

      const coursePayload: Course = {
        id: courseId,
        tutorId: userProfile.uid,
        tutorName: userProfile.displayName.slice(0, BLUEPRINT_LIMITS.displayNameMax),
        title: title.trim().slice(0, BLUEPRINT_LIMITS.titleMax),
        subtitle: subtitle.trim().slice(0, BLUEPRINT_LIMITS.subtitleMax),
        description: description.trim().slice(0, BLUEPRINT_LIMITS.descriptionMax),
        section,
        subject: subject.trim().slice(0, BLUEPRINT_LIMITS.subjectMax),
        price: parsedPrice,
        thumbnailUrl,
        introVideoId: videoId,
        introDurationLabel: durationLabel,
        lessonCount: 1,
        status: 'published',
      };

      await setDoc(doc(db, 'courses', courseId), {
        ...coursePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'courses', courseId, 'lessons', introLessonId), {
        id: introLessonId,
        courseId,
        tutorId: userProfile.uid,
        courseStatus: 'published',
        title: (introTitle.trim() || 'Free Course Introduction').slice(0, BLUEPRINT_LIMITS.lessonTitleMax),
        summary: 'Complimentary course introduction video.',
        order: 1,
        durationLabel,
        isFreeIntro: true,
        videoId,
        createdAt: serverTimestamp(),
      });

      setSelectedCourseId(courseId);
      setTitle('');
      setSubtitle('');
      setDescription('');
      setIntroFile(null);
      setStatusMessage('Course and free introduction video published to LAW STEAD.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to create course.');
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setStatusMessage(null);

    const targetCourse = myCourses.find((c) => c.id === selectedCourseId);
    if (!targetCourse) {
      setErrorMessage('Select one of your courses first.');
      return;
    }
    if (lessonTitle.trim().length < BLUEPRINT_LIMITS.lessonTitleMin) {
      setErrorMessage('Lesson title must be at least 2 characters.');
      return;
    }
    if (!lessonFile) {
      setErrorMessage('Please select a lesson video file (.mp4 or .webm) to upload.');
      return;
    }

    setAddingLesson(true);
    try {
      const { videoId, durationLabel } = await uploadVideoFile(lessonFile);
      const nextOrder = courseLessons.length + 1;
      const lessonId = `les_${Date.now().toString(36)}`;

      await setDoc(doc(db, 'courses', targetCourse.id, 'lessons', lessonId), {
        id: lessonId,
        courseId: targetCourse.id,
        tutorId: userProfile.uid,
        courseStatus: targetCourse.status,
        title: lessonTitle.trim().slice(0, BLUEPRINT_LIMITS.lessonTitleMax),
        summary: lessonSummary.trim().slice(0, BLUEPRINT_LIMITS.summaryMax),
        order: nextOrder,
        durationLabel,
        isFreeIntro: false,
        videoId,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'courses', targetCourse.id), {
        lessonCount: nextOrder,
        updatedAt: serverTimestamp(),
      });

      setLessonTitle('');
      setLessonSummary('');
      setLessonFile(null);
      setStatusMessage(`Paid lesson "${lessonTitle.trim()}" uploaded and added to "${targetCourse.title}".`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to upload paid lesson.');
    } finally {
      setAddingLesson(false);
    }
  };

  if (userProfile.role !== 'tutor') {
    return (
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Access Restricted
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            This workspace is reserved for registered LAW STEAD tutors.
          </p>
        </div>
      </section>
    );
  }

  const totalRevenue = mySales.reduce((acc, s) => acc + (s.amountPaid || 0), 0);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-5 sm:pb-6">
        <div>
          <p className="text-xs font-medium text-slate-500">Tutor Workspace</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 mt-1">
            Instructor Course Studio
          </h1>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:gap-6 text-xs sm:text-sm">
          <div>
            <p className="text-[11px] sm:text-xs text-slate-500">Published</p>
            <p className="font-semibold text-slate-900 font-mono-tabular mt-0.5">{myCourses.length}</p>
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-slate-500">Enrollments</p>
            <p className="font-semibold text-slate-900 font-mono-tabular mt-0.5">{mySales.length}</p>
          </div>
          <div>
            <p className="text-[11px] sm:text-xs text-slate-500">Revenue</p>
            <p className="font-semibold text-slate-900 font-mono-tabular mt-0.5 truncate">{formatNaira(totalRevenue)}</p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Create New Course & Upload Free Intro */}
        <form
          onSubmit={(e) => void handleCreateCourse(e)}
          className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-5 min-w-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900">
              Publish New Course
            </h2>
            <span className="text-xs text-slate-500">Includes Free Intro Video</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setSection('university')}
              className={`min-h-[44px] sm:min-h-0 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                section === 'university'
                  ? 'border-[#0F172A] bg-[#0F172A] text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              1. University Law
            </button>
            <button
              type="button"
              onClick={() => setSection('law_school')}
              className={`min-h-[44px] sm:min-h-0 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                section === 'law_school'
                  ? 'border-[#0F172A] bg-[#0F172A] text-white'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              2. Law School
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Course Title
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.titleMax}
                placeholder="e.g. Equity, Trusts & Fiduciary Remedies"
                className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal Subject
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.subjectMax}
                  placeholder="e.g. Property Law"
                  className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Course Price (₦ Naira)
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  max={BLUEPRINT_LIMITS.priceMax}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subtitle
              </label>
              <input
                type="text"
                required
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.subtitleMax}
                placeholder="Concise summary of topics covered"
                className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Detailed Syllabus Description
              </label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={BLUEPRINT_LIMITS.descriptionMax}
                placeholder="Explain learning outcomes, statutory focus, and examination readiness..."
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Cover Artwork
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {CURATED_COURSE_THUMBNAILS.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => setThumbnailUrl(item.url)}
                    className={`min-h-[40px] sm:min-h-0 px-3 py-2 rounded-lg border text-xs text-left truncate transition-colors ${
                      thumbnailUrl === item.url
                        ? 'border-[#0F172A] bg-slate-50 font-semibold text-slate-900'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Free Introduction Video Title
                </label>
                <input
                  type="text"
                  value={introTitle}
                  onChange={(e) => setIntroTitle(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.lessonTitleMax}
                  className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Upload Free Introduction Video (.mp4 / .webm)
                </label>
                <label className="min-h-[48px] flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0F172A] transition-colors">
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 min-w-0">
                    <Upload className="w-4 h-4 shrink-0 text-[#1E3A5F]" />
                    <span className="truncate">
                      {introFile ? introFile.name : 'Choose MP4 or WebM intro video file'}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[#0F172A] shrink-0">Browse</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setIntroFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingCourse}
            className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors"
          >
            {creatingCourse ? 'Uploading Intro & Publishing Course...' : 'Publish Course with Free Intro'}
          </button>
        </form>

        {/* Manage Courses & Upload Paid Lessons */}
        <div className="lg:col-span-6 space-y-6 min-w-0">
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="font-display text-lg sm:text-xl font-semibold text-slate-900">
              Your Courses
            </h2>
            {myCourses.length === 0 ? (
              <p className="text-sm text-slate-500">
                You have not published a course yet. Use the form to upload your first course and free introduction video.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {myCourses.map((c) => {
                  const isSelected = c.id === selectedCourseId;
                  return (
                    <div
                      key={c.id}
                      className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 ${
                        isSelected ? 'bg-slate-50 -mx-2 sm:-mx-3 px-2 sm:px-3 rounded-lg' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedCourseId(c.id)}
                        className="text-left min-w-0 flex-1"
                      >
                        <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {c.section === 'university' ? 'University Law' : 'Law School'} ·{' '}
                          <span className="font-mono-tabular">{formatNaira(c.price)}</span> ·{' '}
                          <span className="font-mono-tabular">{c.lessonCount} lessons</span>
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => onOpenCourse(c)}
                        className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto min-h-[40px] sm:min-h-0 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-white transition-colors whitespace-nowrap shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedCourseId && (
            <form
              onSubmit={(e) => void handleAddLesson(e)}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <h3 className="font-display text-lg font-semibold text-slate-900">
                  Upload Paid Lesson
                </h3>
                <span className="text-xs text-slate-500 font-mono-tabular">
                  {courseLessons.length} lessons in course
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lesson Title
                </label>
                <input
                  type="text"
                  required
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.lessonTitleMax}
                  placeholder="e.g. Lecture 2: Resulting & Constructive Trusts"
                  className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lesson Notes / Summary (Optional)
                </label>
                <textarea
                  rows={2}
                  value={lessonSummary}
                  onChange={(e) => setLessonSummary(e.target.value)}
                  maxLength={BLUEPRINT_LIMITS.summaryMax}
                  placeholder="Key authorities and statutory sections covered"
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Lesson Video File (.mp4 / .webm)
                </label>
                <label className="min-h-[48px] flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-[#0F172A] transition-colors">
                  <div className="flex items-center gap-2.5 text-xs text-slate-600 min-w-0">
                    <Film className="w-4 h-4 shrink-0 text-[#1E3A5F]" />
                    <span className="truncate">
                      {lessonFile ? lessonFile.name : 'Select MP4 or WebM lesson video'}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[#0F172A] shrink-0">Browse</span>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={(e) => setLessonFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={addingLesson}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-[#1E3A5F] text-white text-sm font-semibold hover:bg-[#0F172A] disabled:opacity-60 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {addingLesson ? 'Uploading Paid Lesson...' : 'Upload & Attach Paid Lesson'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};
