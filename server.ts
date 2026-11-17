import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';

dotenv.config();

const execFileAsync = promisify(execFile);
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = process.cwd();
const STORAGE_DIR = path.resolve(ROOT_DIR, 'storage');
const VIDEO_DIR = path.resolve(STORAGE_DIR, 'videos');
const CONTACT_FILE = path.resolve(STORAGE_DIR, 'contact_messages.json');

fs.mkdirSync(VIDEO_DIR, { recursive: true });

const firebaseConfigPath = path.resolve(ROOT_DIR, 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) as {
  projectId: string;
  apiKey: string;
  firestoreDatabaseId: string;
};

// Ephemeral process secret for short-lived HMAC playback tokens (non-shareable URLs)
const STREAM_SECRET = process.env.STREAM_SECRET || crypto.randomBytes(32).toString('hex');

interface SeedVideoSpec {
  videoId: string;
  waveColor: string;
  freqHz: number;
  durationSec: number;
}

const SEED_VIDEOS: SeedVideoSpec[] = [
  { videoId: 'seed_intro_constitutional', waveColor: '0xD4AF37', freqHz: 220, durationSec: 12 },
  { videoId: 'seed_lesson_constitutional_1', waveColor: '0x60A5FA', freqHz: 261, durationSec: 16 },
  { videoId: 'seed_intro_contract', waveColor: '0xD4AF37', freqHz: 246, durationSec: 12 },
  { videoId: 'seed_lesson_contract_1', waveColor: '0x38BDF8', freqHz: 293, durationSec: 16 },
  { videoId: 'seed_intro_criminal_lit', waveColor: '0xF59E0B', freqHz: 196, durationSec: 12 },
  { videoId: 'seed_lesson_criminal_1', waveColor: '0x93C5FD', freqHz: 329, durationSec: 16 },
  { videoId: 'seed_intro_corporate', waveColor: '0xD4AF37', freqHz: 277, durationSec: 12 },
  { videoId: 'seed_lesson_corporate_1', waveColor: '0x60A5FA', freqHz: 349, durationSec: 16 },
];

let seedVideosPromise: Promise<void> | null = null;

function ensureSeedVideosExist(): Promise<void> {
  if (seedVideosPromise) return seedVideosPromise;
  seedVideosPromise = (async () => {
    for (const spec of SEED_VIDEOS) {
      const outPath = path.join(VIDEO_DIR, `${spec.videoId}.mp4`);
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 4096) {
        continue;
      }
      try {
        await execFileAsync('/usr/bin/ffmpeg', [
          '-y',
          '-f', 'lavfi',
          '-i', `sine=frequency=${spec.freqHz}:sample_rate=44100:duration=${spec.durationSec}`,
          '-filter_complex',
          `[0:a]showwaves=s=640x360:mode=cline:rate=15:colors=${spec.waveColor},format=yuv420p[v]`,
          '-map', '[v]',
          '-map', '0:a',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '30',
          '-c:a', 'aac',
          '-b:a', '64k',
          '-movflags', '+faststart',
          outPath,
        ]);
      } catch (err) {
        console.error(`Could not synthesize seed video ${spec.videoId}:`, err);
      }
    }
  })();
  return seedVideosPromise;
}

const SEEDED_CATALOG = {
  courses: [
    {
      id: 'lawstead_uni_constitutional',
      tutorId: 'lawstead_faculty_01',
      tutorName: 'Prof. Alistair Vance, LL.D.',
      title: 'Constitutional & Administrative Law',
      subtitle: 'Parliamentary sovereignty, judicial review, separation of powers, and fundamental rights jurisprudence.',
      description:
        'Designed for University Law undergraduates (LL.B. Year 1 & 2). Covers foundational constitutional doctrines, ultra vires judicial review, proportionality analysis, and structured problem-question answering techniques for university examinations.',
      section: 'university',
      subject: 'Public Law',
      price: 15000,
      thumbnailUrl: '/src/assets/images/course_constitutional_law_1794933669849.jpg',
      introVideoId: 'seed_intro_constitutional',
      introDurationLabel: '00:12',
      lessonCount: 4,
      status: 'published',
      isSeeded: true,
    },
    {
      id: 'lawstead_uni_contract',
      tutorId: 'lawstead_faculty_02',
      tutorName: 'Dr. Clara Mensah, Ph.D.',
      title: 'Contract Law & Commercial Remedies',
      subtitle: 'Offer, acceptance, consideration, misrepresentation, frustration, and expectation damages.',
      description:
        'A rigorous University Law module dissecting formation of contracts, battle of the forms, exclusion clauses under statutory controls, breach remedies, and equitable relief with annotated leading appellate authorities.',
      section: 'university',
      subject: 'Obligations',
      price: 18000,
      thumbnailUrl: '/src/assets/images/course_contract_law_1794933670041.jpg',
      introVideoId: 'seed_intro_contract',
      introDurationLabel: '00:12',
      lessonCount: 4,
      status: 'published',
      isSeeded: true,
    },
    {
      id: 'lawstead_uni_torts',
      tutorId: 'lawstead_faculty_01',
      tutorName: 'Prof. Alistair Vance, LL.D.',
      title: 'Law of Torts & Negligence Liability',
      subtitle: 'Duty of care, breach, causation, remoteness, nuisance, and economic loss.',
      description:
        'Master tortious liability for University Law assessments. Examines Donoghue v Stevenson through modern three-stage duty tests, vicarious liability, occupiers liability, and psychiatric harm claims.',
      section: 'university',
      subject: 'Obligations',
      price: 14000,
      thumbnailUrl: '/src/assets/images/course_constitutional_law_1794933669849.jpg',
      introVideoId: 'seed_intro_constitutional',
      introDurationLabel: '00:12',
      lessonCount: 3,
      status: 'published',
      isSeeded: true,
    },
    {
      id: 'lawstead_bar_criminal_lit',
      tutorId: 'lawstead_counsel_03',
      tutorName: 'Barrister Kofi Adeyemi, KC',
      title: 'Criminal Litigation & Trial Advocacy',
      subtitle: 'Indictments, bail applications, examination-in-chief, cross-examination, and sentencing.',
      description:
        'Built specifically for Law School bar candidates. Bridges procedural rules with practical courtroom advocacy, drafting charges, evidentiary objections, no-case submissions, and appellate procedure.',
      section: 'law_school',
      subject: 'Litigation',
      price: 30000,
      thumbnailUrl: '/src/assets/images/course_criminal_litigation_1794933670886.jpg',
      introVideoId: 'seed_intro_criminal_lit',
      introDurationLabel: '00:12',
      lessonCount: 4,
      status: 'published',
      isSeeded: true,
    },
    {
      id: 'lawstead_bar_corporate',
      tutorId: 'lawstead_counsel_04',
      tutorName: 'Evelyn Thorne, Esq.',
      title: 'Corporate Law Practice & M&A Drafting',
      subtitle: 'Incorporation filings, shareholder agreements, board resolutions, and due diligence.',
      description:
        'Vocational Law School mastery covering corporate governance, capital maintenance, directors fiduciary duties, regulatory compliance filings, and commercial acquisition checklists.',
      section: 'law_school',
      subject: 'Corporate Practice',
      price: 35000,
      thumbnailUrl: '/src/assets/images/course_corporate_practice_1794933670422.jpg',
      introVideoId: 'seed_intro_corporate',
      introDurationLabel: '00:12',
      lessonCount: 4,
      status: 'published',
      isSeeded: true,
    },
    {
      id: 'lawstead_bar_civil_lit',
      tutorId: 'lawstead_counsel_03',
      tutorName: 'Barrister Kofi Adeyemi, KC',
      title: 'Civil Litigation, Pleadings & Injunctions',
      subtitle: 'Originating processes, statements of claim, summary judgment, and interim injunctions.',
      description:
        'Comprehensive Law School preparation for civil procedure finals. Includes line-by-line drafting walkthroughs for statements of defence, Mareva injunctions, and trial bundle organization.',
      section: 'law_school',
      subject: 'Litigation',
      price: 28000,
      thumbnailUrl: '/src/assets/images/course_criminal_litigation_1794933670886.jpg',
      introVideoId: 'seed_intro_criminal_lit',
      introDurationLabel: '00:12',
      lessonCount: 3,
      status: 'published',
      isSeeded: true,
    },
  ],
  lessonsByCourse: {
    lawstead_uni_constitutional: [
      {
        id: 'lesson_const_intro',
        courseId: 'lawstead_uni_constitutional',
        tutorId: 'lawstead_faculty_01',
        courseStatus: 'published',
        title: 'Course Introduction: Structure of Constitutional Arguments',
        summary: 'Free orientation on approaching public law essay and problem questions.',
        order: 1,
        durationLabel: '00:12',
        isFreeIntro: true,
        videoId: 'seed_intro_constitutional',
      },
      {
        id: 'lesson_const_2',
        courseId: 'lawstead_uni_constitutional',
        tutorId: 'lawstead_faculty_01',
        courseStatus: 'published',
        title: 'Parliamentary Sovereignty & Implied Repeal',
        summary: 'Core constitutional cases and statutory hierarchy analysis.',
        order: 2,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_constitutional_1',
      },
      {
        id: 'lesson_const_3',
        courseId: 'lawstead_uni_constitutional',
        tutorId: 'lawstead_faculty_01',
        courseStatus: 'published',
        title: 'Grounds of Judicial Review: Illegality & Irrationality',
        summary: 'GCHQ framework, Wednesbury unreasonableness, and fettering discretion.',
        order: 3,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_constitutional_1',
      },
      {
        id: 'lesson_const_4',
        courseId: 'lawstead_uni_constitutional',
        tutorId: 'lawstead_faculty_01',
        courseStatus: 'published',
        title: 'Procedural Impropriety & Natural Justice',
        summary: 'Rule against bias, right to be heard, and legitimate expectations.',
        order: 4,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_constitutional_1',
      },
    ],
    lawstead_uni_contract: [
      {
        id: 'lesson_contract_intro',
        courseId: 'lawstead_uni_contract',
        tutorId: 'lawstead_faculty_02',
        courseStatus: 'published',
        title: 'Course Introduction: Anatomy of an Enforceable Agreement',
        summary: 'Free preview outlining offer, acceptance, and objective intention.',
        order: 1,
        durationLabel: '00:12',
        isFreeIntro: true,
        videoId: 'seed_intro_contract',
      },
      {
        id: 'lesson_contract_2',
        courseId: 'lawstead_uni_contract',
        tutorId: 'lawstead_faculty_02',
        courseStatus: 'published',
        title: 'Consideration, Promissory Estoppel & Practical Benefit',
        summary: 'Williams v Roffey Bros and High Trees House synthesis.',
        order: 2,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_contract_1',
      },
      {
        id: 'lesson_contract_3',
        courseId: 'lawstead_uni_contract',
        tutorId: 'lawstead_faculty_02',
        courseStatus: 'published',
        title: 'Exclusion Clauses & Statutory Unfair Terms Control',
        summary: 'Incorporation by signature, notice, and construction principles.',
        order: 3,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_contract_1',
      },
      {
        id: 'lesson_contract_4',
        courseId: 'lawstead_uni_contract',
        tutorId: 'lawstead_faculty_02',
        courseStatus: 'published',
        title: 'Remoteness of Damage & Mitigation Duties',
        summary: 'Hadley v Baxendale two-limb rule and commercial certainty.',
        order: 4,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_contract_1',
      },
    ],
    lawstead_uni_torts: [
      {
        id: 'lesson_torts_intro',
        courseId: 'lawstead_uni_torts',
        tutorId: 'lawstead_faculty_01',
        courseStatus: 'published',
        title: 'Course Introduction: Duty of Care Architecture',
        summary: 'Free overview of Caparo three-stage duty analysis.',
        order: 1,
        durationLabel: '00:12',
        isFreeIntro: true,
        videoId: 'seed_intro_constitutional',
      },
      {
        id: 'lesson_torts_2',
        courseId: 'lawstead_uni_torts',
        tutorId: 'lawstead_faculty_01',
        courseStatus: 'published',
        title: 'Factual & Legal Causation: But-For and Novus Actus',
        summary: 'Material contribution to risk and intervening acts.',
        order: 2,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_constitutional_1',
      },
      {
        id: 'lesson_torts_3',
        courseId: 'lawstead_uni_torts',
        tutorId: 'lawstead_faculty_01',
        courseStatus: 'published',
        title: 'Pure Economic Loss & Negligent Misstatement',
        summary: 'Hedley Byrne assumptions of responsibility.',
        order: 3,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_constitutional_1',
      },
    ],
    lawstead_bar_criminal_lit: [
      {
        id: 'lesson_crim_intro',
        courseId: 'lawstead_bar_criminal_lit',
        tutorId: 'lawstead_counsel_03',
        courseStatus: 'published',
        title: 'Course Introduction: From Arrest to Arraignment',
        summary: 'Free orientation on criminal litigation bar exam scoring.',
        order: 1,
        durationLabel: '00:12',
        isFreeIntro: true,
        videoId: 'seed_intro_criminal_lit',
      },
      {
        id: 'lesson_crim_2',
        courseId: 'lawstead_bar_criminal_lit',
        tutorId: 'lawstead_counsel_03',
        courseStatus: 'published',
        title: 'Drafting Valid Charges & Avoiding Duplicity',
        summary: 'Rule against duplicity, misjoinder, and statutory amendment.',
        order: 2,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_criminal_1',
      },
      {
        id: 'lesson_crim_3',
        courseId: 'lawstead_bar_criminal_lit',
        tutorId: 'lawstead_counsel_03',
        courseStatus: 'published',
        title: 'Bail Applications & Burden of Proof on Remand',
        summary: 'Structuring persuasive bail motions and surety verification.',
        order: 3,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_criminal_1',
      },
      {
        id: 'lesson_crim_4',
        courseId: 'lawstead_bar_criminal_lit',
        tutorId: 'lawstead_counsel_03',
        courseStatus: 'published',
        title: 'Cross-Examination Technique & No-Case Submissions',
        summary: 'Impeaching prior inconsistent statements cleanly at trial.',
        order: 4,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_criminal_1',
      },
    ],
    lawstead_bar_corporate: [
      {
        id: 'lesson_corp_intro',
        courseId: 'lawstead_bar_corporate',
        tutorId: 'lawstead_counsel_04',
        courseStatus: 'published',
        title: 'Course Introduction: Corporate Practice Workflows',
        summary: 'Free preview of company formation and board advisory practice.',
        order: 1,
        durationLabel: '00:12',
        isFreeIntro: true,
        videoId: 'seed_intro_corporate',
      },
      {
        id: 'lesson_corp_2',
        courseId: 'lawstead_bar_corporate',
        tutorId: 'lawstead_counsel_04',
        courseStatus: 'published',
        title: 'Drafting Articles & Minority Shareholder Protections',
        summary: 'Pre-emption rights, drag-along/tag-along, and deadlock clauses.',
        order: 2,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_corporate_1',
      },
      {
        id: 'lesson_corp_3',
        courseId: 'lawstead_bar_corporate',
        tutorId: 'lawstead_counsel_04',
        courseStatus: 'published',
        title: 'Due Diligence Reports & Regulatory Filings',
        summary: 'Conducting corporate searches and identifying encumbrances.',
        order: 3,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_corporate_1',
      },
      {
        id: 'lesson_corp_4',
        courseId: 'lawstead_bar_corporate',
        tutorId: 'lawstead_counsel_04',
        courseStatus: 'published',
        title: 'Mergers, Share Purchase Agreements & Warranties',
        summary: 'Completion mechanics, disclosure letters, and indemnities.',
        order: 4,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_corporate_1',
      },
    ],
    lawstead_bar_civil_lit: [
      {
        id: 'lesson_civ_intro',
        courseId: 'lawstead_bar_civil_lit',
        tutorId: 'lawstead_counsel_03',
        courseStatus: 'published',
        title: 'Course Introduction: Jurisdiction & Pre-Action Protocols',
        summary: 'Free introduction to civil litigation bar exam strategy.',
        order: 1,
        durationLabel: '00:12',
        isFreeIntro: true,
        videoId: 'seed_intro_criminal_lit',
      },
      {
        id: 'lesson_civ_2',
        courseId: 'lawstead_bar_civil_lit',
        tutorId: 'lawstead_counsel_03',
        courseStatus: 'published',
        title: 'Drafting Statements of Claim & Witness Statements',
        summary: 'Pleading material facts vs evidence with precision.',
        order: 2,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_criminal_1',
      },
      {
        id: 'lesson_civ_3',
        courseId: 'lawstead_bar_civil_lit',
        tutorId: 'lawstead_counsel_03',
        courseStatus: 'published',
        title: 'Interim Injunctions & Anton Piller Orders',
        summary: 'American Cyanamid balance of convenience and undertakings.',
        order: 3,
        durationLabel: '00:16',
        isFreeIntro: false,
        videoId: 'seed_lesson_criminal_1',
      },
    ],
  } as Record<string, Array<{
    id: string;
    courseId: string;
    tutorId: string;
    courseStatus: 'published' | 'draft';
    title: string;
    summary: string;
    order: number;
    durationLabel: string;
    isFreeIntro: boolean;
    videoId: string;
  }>>,
};

async function verifyFirebaseUser(idToken: string): Promise<{ uid: string; email?: string } | null> {
  if (!idToken) return null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as { users?: Array<{ localId: string; email?: string }> };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    return { uid: user.localId, email: user.email };
  } catch {
    return null;
  }
}

async function readFirestoreDocWithToken(
  docPath: string,
  idToken: string
): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${docPath}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      fields?: Record<string, { stringValue?: string; booleanValue?: boolean; integerValue?: string; doubleValue?: number }>;
    };
    if (!json.fields) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(json.fields)) {
      if (v.stringValue !== undefined) out[k] = v.stringValue;
      else if (v.booleanValue !== undefined) out[k] = v.booleanValue;
      else if (v.integerValue !== undefined) out[k] = Number(v.integerValue);
      else if (v.doubleValue !== undefined) out[k] = Number(v.doubleValue);
    }
    return out;
  } catch {
    return null;
  }
}

function signStreamToken(payload: { videoId: string; uid: string; exp: number }): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', STREAM_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyStreamToken(token: string): { videoId: string; uid: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', STREAM_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      videoId: string;
      uid: string;
      exp: number;
    };
    if (!parsed.videoId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function resolveSafeVideoPath(videoId: string): string | null {
  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(videoId)) return null;
  for (const ext of ['.mp4', '.webm', '.mov']) {
    const candidate = path.join(VIDEO_DIR, `${videoId}${ext}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, VIDEO_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.mp4', '.webm', '.mov'].includes(ext) ? ext : '.mp4';
    const videoId = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    cb(null, `${videoId}${safeExt}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMime = file.mimetype.startsWith('video/');
    const allowedExt = ['.mp4', '.webm', '.mov'].includes(ext);
    if (allowedMime || allowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Only MP4, WebM, or MOV video files are permitted.'));
    }
  },
});

async function startServer(): Promise<void> {
  void ensureSeedVideosExist();

  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'LAW STEAD' });
  });

  app.get('/api/catalog', (_req, res) => {
    res.json(SEEDED_CATALOG);
  });

  // Tutor video upload endpoint (requires valid Firebase ID token + tutor role + matching active session)
  app.post('/api/videos/upload', (req, res, next) => {
    upload.single('video')(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
        return;
      }
      next();
    });
  }, async (req, res) => {
    const uploadedFile = req.file;
    try {
      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const sessionId = String(req.headers['x-session-id'] || '');
      const user = await verifyFirebaseUser(idToken);
      if (!user) {
        if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
        res.status(401).json({ error: 'Authentication required to upload videos.' });
        return;
      }

      const activeSession = await readFirestoreDocWithToken(`active_sessions/${user.uid}`, idToken);
      if (!activeSession || activeSession.sessionId !== sessionId) {
        if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
        res.status(409).json({ error: 'Your session is no longer active. Only one device may be logged in at a time.' });
        return;
      }

      const profile = await readFirestoreDocWithToken(`users/${user.uid}`, idToken);
      if (!profile || profile.role !== 'tutor') {
        if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
        res.status(403).json({ error: 'Only registered LAW STEAD tutors may upload course videos.' });
        return;
      }

      if (!uploadedFile) {
        res.status(400).json({ error: 'No video file was attached.' });
        return;
      }

      const videoId = path.basename(uploadedFile.filename, path.extname(uploadedFile.filename));
      res.json({
        videoId,
        sizeBytes: uploadedFile.size,
        mimeType: uploadedFile.mimetype,
      });
    } catch (err) {
      if (uploadedFile && fs.existsSync(uploadedFile.path)) fs.unlinkSync(uploadedFile.path);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Upload processing failed.' });
    }
  });

  // Issue short-lived non-downloadable streaming token
  app.post('/api/videos/playback-token', async (req, res) => {
    try {
      const { videoId, courseId, lessonId, isFreeIntro } = req.body as {
        videoId?: string;
        courseId?: string;
        lessonId?: string;
        isFreeIntro?: boolean;
      };

      if (videoId?.startsWith('seed_')) {
        await ensureSeedVideosExist();
      }

      if (!videoId || !resolveSafeVideoPath(videoId)) {
        res.status(404).json({ error: 'Video asset not found on stream server.' });
        return;
      }

      const authHeader = req.headers.authorization || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const sessionId = String(req.headers['x-session-id'] || '');

      // Verify free intro status cleanly against seed catalog or Firestore lesson doc
      let verifiedFreeIntro = false;
      if (isFreeIntro && courseId && lessonId) {
        const seededLessons = SEEDED_CATALOG.lessonsByCourse[courseId];
        const seededMatch = seededLessons?.find(
          (l) => l.id === lessonId && l.videoId === videoId && l.isFreeIntro
        );
        if (seededMatch) {
          verifiedFreeIntro = true;
        } else if (idToken) {
          const lessonDoc = await readFirestoreDocWithToken(
            `courses/${courseId}/lessons/${lessonId}`,
            idToken
          );
          if (lessonDoc && lessonDoc.isFreeIntro === true && lessonDoc.videoId === videoId) {
            verifiedFreeIntro = true;
          }
        } else {
          // Allow guest preview of public published course intro via unauthenticated Firestore REST GET
          const publicUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`;
          const publicResp = await fetch(publicUrl);
          if (publicResp.ok) {
            const json = (await publicResp.json()) as {
              fields?: Record<string, { booleanValue?: boolean; stringValue?: string }>;
            };
            if (
              json.fields?.isFreeIntro?.booleanValue === true &&
              json.fields?.videoId?.stringValue === videoId
            ) {
              verifiedFreeIntro = true;
            }
          }
        }
      }

      if (verifiedFreeIntro) {
        const token = signStreamToken({
          videoId,
          uid: 'preview_guest',
          exp: Date.now() + 120_000,
        });
        res.json({
          streamUrl: `/api/videos/${encodeURIComponent(videoId)}/stream?token=${encodeURIComponent(token)}`,
          expiresInSeconds: 120,
        });
        return;
      }

      // Paid lesson: strictly require authenticated user + active single session + purchase/tutor ownership
      const user = await verifyFirebaseUser(idToken);
      if (!user) {
        res.status(401).json({ error: 'Sign in and purchase this course to watch full lessons.' });
        return;
      }

      const activeSession = await readFirestoreDocWithToken(`active_sessions/${user.uid}`, idToken);
      if (!activeSession || activeSession.sessionId !== sessionId) {
        res.status(409).json({
          error: 'Session ended: Your account was logged in from another device. Only one active login is allowed.',
        });
        return;
      }

      if (!courseId) {
        res.status(400).json({ error: 'Course identifier is required.' });
        return;
      }

      const enrollmentDoc = await readFirestoreDocWithToken(
        `enrollments/${user.uid}_${courseId}`,
        idToken
      );
      const courseDoc = await readFirestoreDocWithToken(`courses/${courseId}`, idToken);
      const isTutorOwner = courseDoc?.tutorId === user.uid;

      if (!enrollmentDoc && !isTutorOwner) {
        res.status(403).json({ error: 'Purchase this course to unlock paid lessons.' });
        return;
      }

      const token = signStreamToken({
        videoId,
        uid: user.uid,
        exp: Date.now() + 120_000,
      });

      res.json({
        streamUrl: `/api/videos/${encodeURIComponent(videoId)}/stream?token=${encodeURIComponent(token)}`,
        expiresInSeconds: 120,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unable to issue stream token.' });
    }
  });

  // Protected video stream with strict anti-download headers and Range support
  app.get('/api/videos/:videoId/stream', (req, res) => {
    const videoId = String(req.params.videoId || '');
    const token = String(req.query.token || '');
    const verified = verifyStreamToken(token);

    if (!verified || verified.videoId !== videoId) {
      res.status(403).json({ error: 'Protected stream token is invalid or expired.' });
      return;
    }

    const filePath = resolveSafeVideoPath(videoId);
    if (!filePath) {
      res.status(404).json({ error: 'Video file not found.' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = ext === '.webm' ? 'video/webm' : 'video/mp4';

    // Anti-download & non-cacheable stream headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (Number.isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`).end();
        return;
      }
      const chunkSize = end - start + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', String(chunkSize));
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.status(200);
      res.setHeader('Content-Length', String(fileSize));
      fs.createReadStream(filePath).pipe(res);
    }
  });

  // Contact Us endpoint
  app.post('/api/contact', (req, res) => {
    const { name, email, visitorTrack, subject, message } = req.body as {
      name?: string;
      email?: string;
      visitorTrack?: string;
      subject?: string;
      message?: string;
    };

    if (!name || name.trim().length < 2 || !email || !email.includes('@') || !message || message.trim().length < 8) {
      res.status(400).json({ error: 'Please provide your name, a valid email address, and your message.' });
      return;
    }

    const entry = {
      id: `INQ-${Date.now().toString(36).toUpperCase()}`,
      name: name.trim().slice(0, 100),
      email: email.trim().slice(0, 200),
      visitorTrack: String(visitorTrack || 'general').slice(0, 40),
      subject: String(subject || 'General Inquiry').trim().slice(0, 140),
      message: message.trim().slice(0, 2000),
      submittedAt: new Date().toISOString(),
    };

    let existingMessages: unknown[] = [];
    if (fs.existsSync(CONTACT_FILE)) {
      try {
        existingMessages = JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8')) as unknown[];
      } catch {
        existingMessages = [];
      }
    }
    existingMessages.push(entry);
    fs.writeFileSync(CONTACT_FILE, JSON.stringify(existingMessages, null, 2), 'utf8');

    res.json({ ok: true, referenceId: entry.id });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LAW STEAD server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
