import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  ContactLoginMethod,
  LegalSection,
  RegistrationIntake,
} from '../types';

interface TutorRegistrationPageProps {
  busy: boolean;
  error: string | null;
  alreadySignedInEmail?: string | null;
  onCreateTutorPasswordAccount: (intake: RegistrationIntake) => void;
  onContinueTutorWithGoogle: (intake: Omit<RegistrationIntake, 'password'> | null) => void;
  onBackToHome: () => void;
}

export const TutorRegistrationPage: React.FC<TutorRegistrationPageProps> = ({
  busy,
  error,
  alreadySignedInEmail,
  onCreateTutorPasswordAccount,
  onContinueTutorWithGoogle,
  onBackToHome,
}) => {
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [track, setTrack] = useState<LegalSection>('university');
  const [institution, setInstitution] = useState('');
  const [contactMethod, setContactMethod] = useState<ContactLoginMethod>('email');
  const [contactValue, setContactValue] = useState(alreadySignedInEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (fullName.trim().length < 2) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!dob) {
      setLocalError('Please enter your date of birth.');
      return;
    }
    if (contactMethod === 'email') {
      if (!contactValue.trim().includes('@') || contactValue.trim().length < 5) {
        setLocalError('Please enter a valid email address.');
        return;
      }
    } else if (contactValue.replace(/\D/g, '').length < 7) {
      setLocalError('Please enter a valid phone number.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Password and Confirm Password do not match.');
      return;
    }

    onCreateTutorPasswordAccount({
      fullName: fullName.trim(),
      dob,
      contactMethod,
      contactValue: contactValue.trim(),
      track,
      role: 'tutor',
      institution: institution.trim() || undefined,
      password,
    });
  };

  const handleGoogleTutor = () => {
    setLocalError(null);
    if (fullName.trim().length >= 2 && dob) {
      onContinueTutorWithGoogle({
        fullName: fullName.trim(),
        dob,
        contactMethod,
        contactValue: contactValue.trim() || alreadySignedInEmail || 'tutor@lawstead.edu',
        track,
        role: 'tutor',
        institution: institution.trim() || undefined,
      });
    } else {
      onContinueTutorWithGoogle(null);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <span className="font-display text-lg font-bold tracking-tight text-[#0F172A] whitespace-nowrap shrink-0">
            LAW STEAD
          </span>
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-0 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Platform
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-4 sm:px-6 py-5 sm:py-6 flex items-center">
        <div className="w-full bg-white border border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
          <div className="space-y-1 border-b border-slate-100 pb-3">
            <p className="text-xs font-medium text-[#1E3A5F]">Faculty Onboarding</p>
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-slate-900">
              Tutor Registration
            </h1>
            <p className="text-xs text-slate-600">
              Register to open your Tutoring Studio. Use the main Sign In page anytime to log back in.
            </p>
          </div>

          {displayError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-snug">
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Dr. Clara Mensah"
                className="w-full min-h-[42px] sm:min-h-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth
                </label>
                <input
                  type="date"
                  required
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full min-h-[42px] sm:min-h-0 px-2.5 py-1.5 text-sm font-mono-tabular border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Teaching Section
                </label>
                <select
                  value={track}
                  onChange={(e) => setTrack(e.target.value as LegalSection)}
                  className="w-full min-h-[42px] sm:min-h-0 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#0F172A]"
                >
                  <option value="university">University Law</option>
                  <option value="law_school">Law School</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chambers / University (Optional)
              </label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                maxLength={120}
                placeholder="e.g. Faculty of Law or Chambers"
                className="w-full min-h-[42px] sm:min-h-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold text-slate-700">
                  {contactMethod === 'email' ? 'Email Address' : 'Phone Number'}
                </label>
                <div className="inline-flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setContactMethod('email');
                      setContactValue('');
                    }}
                    className={`px-1.5 py-1 rounded ${
                      contactMethod === 'email'
                        ? 'font-semibold text-[#0F172A] underline'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Email
                  </button>
                  <span className="text-slate-300">/</span>
                  <button
                    type="button"
                    onClick={() => {
                      setContactMethod('phone');
                      setContactValue('');
                    }}
                    className={`px-1.5 py-1 rounded ${
                      contactMethod === 'phone'
                        ? 'font-semibold text-[#0F172A] underline'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Phone
                  </button>
                </div>
              </div>
              <input
                type={contactMethod === 'email' ? 'email' : 'tel'}
                required
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                maxLength={contactMethod === 'email' ? 200 : 30}
                placeholder={
                  contactMethod === 'email'
                    ? 'tutor@chambers.org'
                    : '+234 800 000 0000'
                }
                className="w-full min-h-[42px] sm:min-h-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 chars"
                  className="w-full min-h-[42px] sm:min-h-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full min-h-[42px] sm:min-h-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors"
            >
              {busy ? 'Creating Tutor Account...' : 'Create Account'}
            </button>

            <div className="relative py-0.5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-[11px]">
                <span className="bg-white px-2.5 text-slate-400">Other options</span>
              </div>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={handleGoogleTutor}
              className="w-full min-h-[44px] py-2 px-4 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              Sign in with Google
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
