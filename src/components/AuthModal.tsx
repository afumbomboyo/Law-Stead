import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  ContactLoginMethod,
  LegalSection,
  RegistrationIntake,
} from '../types';

interface AuthModalProps {
  open: boolean;
  mode: 'signin' | 'onboarding';
  initialTrack: LegalSection;
  defaultDisplayName?: string;
  defaultEmail?: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onEmailPasswordLogin: (
    method: ContactLoginMethod,
    identifier: string,
    password: string
  ) => void;
  onEmailPasswordSignUp: (intake: RegistrationIntake) => void;
  onGoogleSignIn: (roleForNewUser: 'student') => void;
  onCompleteOnboarding: (intake: RegistrationIntake) => void;
}

const GoogleIcon: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.3 0 6.08-1.09 8.11-2.96l-3.88-3.05c-1.08.72-2.46 1.16-4.23 1.16-3.25 0-6-2.19-6.98-5.15H1.01v3.14C3.05 21.2 7.21 24 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.02 14c-.25-.72-.39-1.49-.39-2.28s.14-1.56.39-2.28V6.3H1.01A11.98 11.98 0 0 0 0 11.72c0 1.93.46 3.76 1.01 5.42L5.02 14Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.8 0 3.41.62 4.68 1.83l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.8 1.01 6.86l4.01 3.14c.98-2.96 3.73-5.25 6.98-5.25Z"
    />
  </svg>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  mode,
  initialTrack,
  defaultDisplayName = '',
  defaultEmail = '',
  busy,
  error,
  onClose,
  onEmailPasswordLogin,
  onEmailPasswordSignUp,
  onGoogleSignIn,
  onCompleteOnboarding,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');

  // Sign In state
  const [loginMethod, setLoginMethod] = useState<ContactLoginMethod>('email');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Create Account / Onboarding state
  const [fullName, setFullName] = useState(defaultDisplayName);
  const [dob, setDob] = useState('');
  const [track, setTrack] = useState<LegalSection>(initialTrack);
  const [signupMethod, setSignupMethod] = useState<ContactLoginMethod>('email');
  const [signupIdentifier, setSignupIdentifier] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultDisplayName && !fullName) setFullName(defaultDisplayName);
    if (defaultEmail && !signupIdentifier && signupMethod === 'email') {
      setSignupIdentifier(defaultEmail);
    }
  }, [defaultDisplayName, defaultEmail, fullName, signupIdentifier, signupMethod]);

  if (!open) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (loginMethod === 'email') {
      if (!loginIdentifier.trim().includes('@')) {
        setLocalError('Please enter a valid email address.');
        return;
      }
    } else if (loginIdentifier.replace(/\D/g, '').length < 7) {
      setLocalError('Please enter a valid phone number.');
      return;
    }
    if (loginPassword.length < 6) {
      setLocalError('Please enter your password.');
      return;
    }
    onEmailPasswordLogin(loginMethod, loginIdentifier.trim(), loginPassword);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (fullName.trim().length < 2) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!dob) {
      setLocalError('Please select your date of birth.');
      return;
    }

    if (mode === 'onboarding') {
      onCompleteOnboarding({
        fullName: fullName.trim(),
        dob,
        contactMethod: signupMethod,
        contactValue: signupIdentifier.trim() || defaultEmail || 'user@lawstead.edu',
        track,
        role: 'student',
      });
      return;
    }

    if (signupMethod === 'email') {
      if (!signupIdentifier.trim().includes('@') || signupIdentifier.trim().length < 5) {
        setLocalError('Please enter a valid email address.');
        return;
      }
    } else if (signupIdentifier.replace(/\D/g, '').length < 7) {
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

    onEmailPasswordSignUp({
      fullName: fullName.trim(),
      dob,
      contactMethod: signupMethod,
      contactValue: signupIdentifier.trim(),
      track,
      role: 'student',
      password,
    });
  };

  const displayError = localError || error;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md max-h-[calc(100vh-1.5rem)] flex flex-col bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {mode === 'onboarding' ? 'Complete Profile' : 'LAW STEAD Account'}
          </h2>
          {mode === 'signin' && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="w-10 h-10 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {mode === 'signin' && (
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setAuthTab('login');
                  setLocalError(null);
                }}
                className={`min-h-[40px] sm:min-h-0 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  authTab === 'login'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab('signup');
                  setLocalError(null);
                }}
                className={`min-h-[40px] sm:min-h-0 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  authTab === 'signup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {displayError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 leading-snug">
              {displayError}
            </div>
          )}

          {mode === 'signin' && authTab === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {loginMethod === 'email' ? 'Email Address' : 'Phone Number'}
                  </label>
                  <div className="inline-flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginMethod('email');
                        setLoginIdentifier('');
                      }}
                      className={`px-1.5 py-1 rounded ${
                        loginMethod === 'email'
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
                        setLoginMethod('phone');
                        setLoginIdentifier('');
                      }}
                      className={`px-1.5 py-1 rounded ${
                        loginMethod === 'phone'
                          ? 'font-semibold text-[#0F172A] underline'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Phone
                    </button>
                  </div>
                </div>
                <input
                  type={loginMethod === 'email' ? 'email' : 'tel'}
                  required
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder={
                    loginMethod === 'email' ? 'name@university.edu' : '+234 800 000 0000'
                  }
                  className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full min-h-[44px] sm:min-h-0 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors"
              >
                {busy ? 'Logging In...' : 'Log In'}
              </button>

              <div className="relative py-1">
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
                onClick={() => onGoogleSignIn('student')}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUpSubmit} className="space-y-3">
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
                  placeholder="Enter your full name"
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
                    Student Track
                  </label>
                  <select
                    value={track}
                    onChange={(e) => setTrack(e.target.value as LegalSection)}
                    className="w-full min-h-[42px] sm:min-h-0 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#0F172A]"
                  >
                    <option value="university">University Student</option>
                    <option value="law_school">Law School Student</option>
                  </select>
                </div>
              </div>

              {mode !== 'onboarding' && (
                <>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-700">
                        {signupMethod === 'email' ? 'Email Address' : 'Phone Number'}
                      </label>
                      <div className="inline-flex items-center gap-1 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setSignupMethod('email');
                            setSignupIdentifier('');
                          }}
                          className={`px-1.5 py-1 rounded ${
                            signupMethod === 'email'
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
                            setSignupMethod('phone');
                            setSignupIdentifier('');
                          }}
                          className={`px-1.5 py-1 rounded ${
                            signupMethod === 'phone'
                              ? 'font-semibold text-[#0F172A] underline'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Phone
                        </button>
                      </div>
                    </div>
                    <input
                      type={signupMethod === 'email' ? 'email' : 'tel'}
                      required
                      value={signupIdentifier}
                      onChange={(e) => setSignupIdentifier(e.target.value)}
                      maxLength={signupMethod === 'email' ? 200 : 30}
                      placeholder={
                        signupMethod === 'email'
                          ? 'student@university.edu'
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
                </>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors"
              >
                {busy
                  ? 'Creating Account...'
                  : mode === 'onboarding'
                  ? 'Save Profile'
                  : 'Create Account'}
              </button>

              {mode !== 'onboarding' && (
                <>
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
                    onClick={() => onGoogleSignIn('student')}
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-2.5 py-2 px-4 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
                  >
                    <GoogleIcon />
                    Sign in with Google
                  </button>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
