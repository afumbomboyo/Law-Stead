import React, { useState } from 'react';
import { BookOpen, Play } from 'lucide-react';
import { Course, formatNaira } from '../types';

interface CourseCardProps {
  course: Course;
  isEnrolled: boolean;
  onOpenCourse: (course: Course) => void;
}

export const CourseCard: React.FC<CourseCardProps> = ({
  course,
  isEnrolled,
  onOpenCourse,
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div
        onClick={() => onOpenCourse(course)}
        className="relative aspect-[4/3] w-full bg-slate-900 overflow-hidden cursor-pointer"
      >
        {!imgFailed && course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={course.title}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] flex flex-col items-center justify-center p-6 text-center text-white">
            <BookOpen className="w-8 h-8 text-amber-300 mb-2" />
            <span className="font-display text-sm font-medium">{course.subject}</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span>{course.section === 'university' ? 'University Law' : 'Law School'}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate max-w-[160px]">{course.subject}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular shrink-0">{course.lessonCount} Lessons</span>
          </div>

          <h3
            onClick={() => onOpenCourse(course)}
            className="font-display text-lg font-semibold text-slate-900 leading-snug cursor-pointer group-hover:text-[#1E3A5F] transition-colors"
          >
            {course.title}
          </h3>

          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
            {course.subtitle}
          </p>

          <p className="text-xs font-medium text-slate-700 pt-0.5">
            {course.tutorName}
          </p>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="font-mono-tabular">
            {isEnrolled ? (
              <span className="text-xs font-semibold text-emerald-800">Enrolled</span>
            ) : (
              <span className="text-base font-bold text-slate-900">
                {formatNaira(course.price)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onOpenCourse(course)}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E3A5F] transition-colors whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5" />
            {isEnrolled ? 'Continue Course' : 'View Course'}
          </button>
        </div>
      </div>
    </article>
  );
};
