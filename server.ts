import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { SEEDED_CATALOG } from './src/data/seededCatalog.ts';

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
