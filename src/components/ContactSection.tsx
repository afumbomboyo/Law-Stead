import React, { useState } from 'react';
import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { VisitorTrack } from '../types';

interface ContactSectionProps {
  currentTrack: VisitorTrack;
  defaultName?: string;
  defaultEmail?: string;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  currentTrack,
  defaultName = '',
  defaultEmail = '',
}) => {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [visitorTrack, setVisitorTrack] = useState<string>(
    currentTrack === 'all' ? 'university' : currentTrack
  );
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          visitorTrack,
          subject,
          message,
        }),
      });
      const data = (await resp.json()) as { ok?: boolean; referenceId?: string; error?: string };
      if (!resp.ok || !data.ok) {
        setError(data.error || 'Unable to send your message.');
        return;
      }
      setReferenceId(data.referenceId || 'SENT');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error sending message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        <div className="lg:col-span-5 space-y-5 sm:space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500">Contact Us</p>
            <h1 className="font-display text-2xl sm:text-4xl font-semibold text-slate-900 text-balance">
              Academic Support &amp; Tutor Admissions
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Reach our academic registry for University Law or Law School enrollment questions, institutional access, or verified tutor onboarding.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 sm:space-y-5 text-sm">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[#1E3A5F] mt-1 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">Academic Registry</p>
                <p className="text-slate-600 break-all">admissions@lawstead.edu</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="w-4 h-4 text-[#1E3A5F] mt-1 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Student &amp; Tutor Desk</p>
                <p className="text-slate-600 font-mono-tabular">+44 20 7946 0821</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#1E3A5F] mt-1 shrink-0" />
              <div>
                <p className="font-semibold text-slate-900">Chambers Office</p>
                <p className="text-slate-600">14 Lincoln&apos;s Inn Fields, Legal Quarter</p>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-8 space-y-5"
        >
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-slate-900">
            Send an Inquiry
          </h2>

          {referenceId && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Inquiry received (Reference <span className="font-mono-tabular font-semibold">{referenceId}</span>). Our registry team will respond shortly.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                placeholder="Your full name"
                className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={200}
                placeholder="you@university.edu"
                className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Visiting As
              </label>
              <select
                value={visitorTrack}
                onChange={(e) => setVisitorTrack(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-[#0F172A]"
              >
                <option value="university">University Law Student</option>
                <option value="law_school">Law School Student</option>
                <option value="general">General Inquiry</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={140}
                placeholder="e.g. Course access or tutor application"
                className="w-full min-h-[44px] sm:min-h-0 px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message
            </label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              placeholder="Write your message to the LAW STEAD academic team..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#0F172A]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-lg bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E3A5F] disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Sending Message...' : 'Submit Inquiry'}
          </button>
        </form>
      </div>
    </section>
  );
};
