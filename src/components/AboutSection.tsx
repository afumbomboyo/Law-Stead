import React from 'react';
import { BookOpen, GraduationCap, Lock, ShieldCheck } from 'lucide-react';

interface AboutSectionProps {
  onExploreSection: (section: 'university' | 'law_school') => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onExploreSection }) => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 sm:space-y-12">
      <div className="max-w-3xl space-y-3 sm:space-y-4">
        <p className="text-xs font-medium text-slate-500">About LAW STEAD</p>
        <h1 className="font-display text-2xl sm:text-4xl font-semibold text-slate-900 text-balance">
          A Dedicated Legal Curriculum Platform Built for Rigor and Academic Integrity
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          LAW STEAD bridges academic jurisprudence and practical courtroom advocacy. Verified legal scholars and practicing barristers publish structured video modules across two focused tracks, letting students preview every course introduction free before enrolling.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-[#1E3A5F]">
            <BookOpen className="w-5 h-5" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900">
            01. University Law Track
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Built for LL.B. and undergraduate law candidates studying Constitutional Law, Contract Law, Torts, Equity &amp; Trusts, Criminal Law, and Jurisprudence with problem-question walkthroughs.
          </p>
          <button
            type="button"
            onClick={() => onExploreSection('university')}
            className="inline-flex items-center min-h-[44px] sm:min-h-0 text-sm font-semibold text-[#1E3A5F] hover:text-[#0F172A] transition-colors"
          >
            Browse University Law Courses
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-4">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-[#1E3A5F]">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900">
            02. Law School Track
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Tailored for vocational bar finals and legal practice preparation covering Criminal Litigation, Civil Litigation, Corporate Law Practice, Property Drafting, and Advocacy Ethics.
          </p>
          <button
            type="button"
            onClick={() => onExploreSection('law_school')}
            className="inline-flex items-center min-h-[44px] sm:min-h-0 text-sm font-semibold text-[#1E3A5F] hover:text-[#0F172A] transition-colors"
          >
            Browse Law School Courses
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 border-t border-slate-200 pt-8 sm:pt-10">
        <div className="flex items-start gap-4">
          <ShieldCheck className="w-5 h-5 text-[#1E3A5F] shrink-0 mt-1" />
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-900">
              Protected Stream-Only Lectures
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Every lesson is delivered via short-lived tokenized streams with disabled browser downloads, disabled phone save menus, and personalized viewer watermarks to safeguard tutor intellectual property.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Lock className="w-5 h-5 text-[#1E3A5F] shrink-0 mt-1" />
          <div className="space-y-1.5">
            <h3 className="text-base font-semibold text-slate-900">
              Single Active Session Enforcement
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              LAW STEAD permits only one person to log into an account at any time. Logging in from a new device detects active sessions and immediately terminates duplicate playback elsewhere.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
