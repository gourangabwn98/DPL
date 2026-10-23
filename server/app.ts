import express, { type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import argon2 from 'argon2';
import { z, ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { db, locked } from './db.js';
import { hash, accessToken, randomToken, config, invitation } from './config.js';
import { cleanImage, putProof, getProof, deleteProof } from './storage.js';
import { playerSchema, settingsSchema, optionalFields } from '../shared/validation.js';
import { csvCell } from './security.js';
import { rateStore } from './rate-store.js';
import { rulesDocumentSchema } from '../shared/rules.js';
import { readRules, publicRules, reviewNotes, validatePublication } from './tournament-rules.js';
export { csvCell } from './security.js';
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new ApiError(status, message);
};
const bearer = (req: Request) => {
  const v = req.headers.authorization?.replace(/^Bearer /, '');
  return v && /^[a-f0-9]{64}$/.test(v) ? v : fail(401, 'A valid private status token is required');
};
async function player(req: Request) {
  const r = await db.registration.findUnique({
    where: {
      tokenHash: hash(bearer(req))
    }
  });
  return r || fail(404, 'Registration not found');
}
async function admin(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies.dpl_session;
    if (!token || typeof token !== 'string') return fail(401, 'Please sign in');
    const session = await db.session.findUnique({
      where: {
        tokenHash: hash(token)
      },
      include: {
        admin: true
      }
    });
    if (!session || session.expiresAt < new Date()) return fail(401, 'Session expired. Please sign in');
    res.locals.admin = session.admin;
    next();
  } catch (e) {
    next(e);
  }
}
const publicSettings = async () => {
  const s = await db.settings.findUniqueOrThrow({
    where: {
      id: '1'
    }
  });
  const accepted = await db.registration.count({
    where: {
      status: 'APPROVED'
    }
  });
  const now = new Date();
  return {
    ...s,
    rules: undefined,
    lockVersion: undefined,
    tournamentRules: publicRules(s.rules),
    accepted,
    available: Math.max(0, s.capacity - accepted),
    accepting: s.open && (!s.opensAt || s.opensAt <= now) && (!s.closesAt || s.closesAt > now) && accepted < s.capacity,
    qrReady: process.env.PAYMENT_QR_READY === 'true' && existsSync(path.resolve('public/images/payment-qr.png')),
    qrPath: '/images/payment-qr.png',
    upiId: process.env.UPI_ID || '',
    payeeName: process.env.PAYEE_NAME || '',
    retentionDays: config.retention
  };
};
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'blob:'],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"]
    }
  }
}));
app.use(express.json({
  limit: '64kb'
}));
app.use(cookieParser());
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', rateLimit({
  store: rateStore('public'),
  windowMs: 60000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'Too many requests. Try again shortly.'
  }
}));
app.use('/api', (req, _res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== config.origin) return next(new ApiError(403, 'Request origin is not allowed'));
  next();
});
app.get('/api/health', async (_req, res) => {
  await db.$runCommandRaw({ ping: 1 });
  res.json({
    ok: true
  });
});
app.get('/api/tournament', async (_req, res) => res.json(await publicSettings()));
app.post('/api/registrations', rateLimit({
  store: rateStore('registration'),
  windowMs: 3600000,
  limit: 20,
  message: {
    error: 'Registration attempt limit reached. Please try later.'
  }
}), async (req, res) => {
  const data = playerSchema.parse(req.body);
  const key = z.uuid().parse(req.headers['idempotency-key']);
  const digest = hash(JSON.stringify(data));
  const token = accessToken(key);
  const result = await locked(async tx => {
    const existing = await tx.registration.findUnique({
      where: {
        requestKey: key
      }
    });
    if (existing) {
      if (existing.requestHash !== digest || existing.tokenHash !== hash(token)) fail(409, 'This submission key cannot be reused. Use your existing private status token.');
      return existing;
    }
    const s = await tx.settings.findUniqueOrThrow({
      where: {
        id: '1'
      }
    });
    const now = new Date();
    if (!s.open || s.opensAt && s.opensAt > now || s.closesAt && s.closesAt <= now) fail(409, 'Registration is currently closed');
    if ((await tx.registration.count({
      where: {
        status: 'APPROVED'
      }
    })) >= s.capacity) fail(409, 'All accepted registration places are filled');
    const fields = s.fields as Record<string, string>;
    for (const field of optionalFields) {
      if (fields[field] === 'required' && !data[field]?.trim()) fail(400, `${field} is required`);
      if ((fields[field] || 'hidden') === 'hidden' && data[field]) fail(400, `${field} is not being collected`);
    }
    return tx.registration.create({
      data: {
        reference: `DPL-${randomToken().slice(0, 10).toUpperCase()}`,
        fullName: data.fullName,
        mobile: data.mobile,
        team: data.team || '',
        data,
        fee: s.fee,
        requestKey: key,
        requestHash: digest,
        tokenHash: hash(token)
      }
    });
  });
  res.status(201).json({
    reference: result.reference,
    token,
    status: result.status
  });
});
app.get('/api/status', async (req, res) => {
  const r = await player(req);
  const history = await db.verification.findMany({
    where: {
      registrationId: r.id
    },
    select: {
      status: true,
      reason: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  });
  res.json({
    reference: r.reference,
    fullName: r.fullName,
    status: r.status,
    fee: r.fee,
    hasPhoto: !!r.photoKey,
    createdAt: r.createdAt,
    history,
    ...(r.status === 'APPROVED' ? {
      invitation: invitation()
    } : {})
  });
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024,
    files: 1,
    fields: 2,
    fieldSize: 200
  }
}).single('proof');
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 0 } }).single('photo');

function adminPhoto(r: { id: string; photoKey?: string | null; photoUpdatedAt?: Date | null }) {
  return { hasPhoto: !!r.photoKey, photoUrl: r.photoKey ? `/api/admin/players/${encodeURIComponent(r.id)}/photo?v=${r.photoUpdatedAt?.getTime() || 0}` : null };
}
async function savePhoto(id: string, buffer: Buffer | undefined, adminId?: string) {
  if (!buffer) fail(400, 'Choose a player photo');
  let image: Buffer;
  try { image = await cleanImage(buffer!); } catch (error) { return fail(400, (error as Error).message); }
  const key = `${randomToken()}.jpg`;
  await putProof(key, image);
  let previous: string | null = null;
  try {
    const saved = await locked(async tx => {
      const existing = await tx.registration.findUnique({ where: { id } });
      if (!existing) return fail(404, 'Player not found');
      previous = existing.photoKey;
      const updated = await tx.registration.update({ where: { id }, data: { photoKey: key, photoUpdatedAt: new Date() } });
      if (adminId) await tx.audit.create({ data: { adminId, action: 'UPDATE_PLAYER_PHOTO', target: id } });
      return updated;
    });
    if (previous) await deleteProof(previous).catch(() => console.error('Previous player photo cleanup failed'));
    return saved;
  } catch (error) {
    await deleteProof(key).catch(() => console.error('Player photo cleanup failed'));
    throw error;
  }
}
app.get('/api/profile-photo', async (req, res) => {
  const r = await player(req);
  if (!r.photoKey) return fail(404, 'No player photo has been uploaded');
  res.type('jpeg').set('Content-Disposition', 'inline; filename="player-photo.jpg"').send(await getProof(r.photoKey));
});
app.post('/api/profile-photo', async (req, res, next) => {
  try { res.locals.registration = await player(req); next(); } catch (error) { next(error); }
}, photoUpload, async (req, res) => {
  await savePhoto(res.locals.registration.id, req.file?.buffer);
  res.json({ hasPhoto: true });
});
app.post('/api/payment', async (req, res, next) => {
  try {
    res.locals.registration = await player(req);
    next();
  } catch (e) {
    next(e);
  }
}, upload, async (req, res) => {
  const details = z.object({
    transactionId: z.string().trim().regex(/^[A-Za-z0-9_-]{6,80}$/),
    declaration: z.literal('true')
  }).strict().parse(req.body);
  if (!req.file) fail(400, 'Choose a payment screenshot');
  let image: Buffer;
  try {
    image = await cleanImage(req.file!.buffer);
  } catch (e) {
    return fail(400, (e as Error).message);
  }
  const key = `${randomToken()}.jpg`;
  await putProof(key, image);
  try {
    await locked(async tx => {
      const r = await tx.registration.findUniqueOrThrow({
        where: {
          id: res.locals.registration.id
        }
      });
      if (!['AWAITING_PAYMENT', 'REJECTED'].includes(r.status)) fail(409, 'This payment is already under review or approved');
      await tx.payment.create({
        data: {
          registrationId: r.id,
          transactionId: details.transactionId,
          storageKey: key
        }
      });
      await tx.registration.update({
        where: {
          id: r.id
        },
        data: {
          status: 'UNDER_REVIEW'
        }
      });
    });
  } catch (e) {
    await deleteProof(key).catch(() => console.error('Orphan proof cleanup failed'));
    throw e;
  }
  res.json({
    status: 'UNDER_REVIEW'
  });
});
const loginLimit = rateLimit({
  store: rateStore('login'),
  windowMs: 15 * 60000,
  limit: 8,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many login attempts. Wait 15 minutes.'
  }
});
app.post('/api/admin/login', loginLimit, async (req, res) => {
  const {
    email,
    password
  } = z.object({
    email: z.email().max(254),
    password: z.string().min(1).max(200)
  }).parse(req.body);
  const a = await db.admin.findUnique({
    where: {
      email: email.toLowerCase()
    }
  });
  const valid = a ? await argon2.verify(a.passwordHash, password) : await argon2.verify('$argon2id$v=19$m=65536,t=3,p=4$MDEyMzQ1Njc4OWFiY2RlZg$fyGzoD8RoN4HkQdQTHfxF/gQNCZdkHmA3a2pFZVtPnY', password).catch(() => false);
  if (!a || !valid) fail(401, 'Incorrect email or password');
  const token = randomToken();
  await db.$transaction([db.session.create({
    data: {
      tokenHash: hash(token),
      adminId: a!.id,
      expiresAt: new Date(Date.now() + 8 * 3600000)
    }
  }), db.audit.create({
    data: {
      adminId: a!.id,
      action: 'LOGIN',
      target: a!.id
    }
  })]);
  res.cookie('dpl_session', token, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict',
    maxAge: 8 * 3600000,
    path: '/api/admin'
  }).json({
    ok: true
  });
});
app.use('/api/admin', admin);
app.get('/api/admin/me', (_req, res) => res.json({
  email: res.locals.admin.email
}));
app.get('/api/admin/rules', async (_req, res) => {
  const settings = await db.settings.findUniqueOrThrow({ where: { id: '1' } });
  res.json({ document: readRules(settings.rules), reviewNotes, posterAvailable: false });
});
app.put('/api/admin/rules', async (req, res) => {
  const document = rulesDocumentSchema.parse(req.body);
  try { validatePublication(document); } catch (error) { return fail(400, (error as Error).message); }
  await locked(async tx => {
    await tx.settings.update({ where: { id: '1' }, data: { rules: JSON.stringify(document) } });
    await tx.audit.create({ data: { adminId: res.locals.admin.id, action: 'UPDATE_RULES', target: '1' } });
  });
  res.json({ ok: true });
});
app.post('/api/admin/logout', async (req, res) => {
  await db.session.deleteMany({
    where: {
      tokenHash: hash(req.cookies.dpl_session)
    }
  });
  res.clearCookie('dpl_session', {
    path: '/api/admin',
    httpOnly: true,
    secure: config.production,
    sameSite: 'strict'
  }).json({
    ok: true
  });
});
app.get('/api/admin/dashboard', async (_req, res) => {
  const counts = await db.registration.groupBy({
    by: ['status'],
    _count: true
  });
  res.json({
    settings: await publicSettings(),
    counts
  });
});
const querySchema = z.object({
  q: z.string().max(100).default(''),
  status: z.enum(['', 'AWAITING_PAYMENT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).default(''),
  page: z.coerce.number().int().min(1).max(100000).default(1)
});
function filter(q: string, status: string): Prisma.RegistrationWhereInput {
  return {
    ...(status ? {
      status: status as 'APPROVED'
    } : {}),
    ...(q ? {
      OR: [{
        reference: {
          contains: q,
          mode: 'insensitive'
        }
      }, {
        fullName: {
          contains: q,
          mode: 'insensitive'
        }
      }, {
        mobile: {
          contains: q
        }
      }, {
        team: {
          contains: q,
          mode: 'insensitive'
        }
      }]
    } : {})
  };
}
app.get('/api/admin/players', async (req, res) => {
  const {
    q,
    status,
    page
  } = querySchema.parse(req.query);
  const where = filter(q, status);
  const [items, total] = await db.$transaction([db.registration.findMany({
    where,
    skip: (page - 1) * 20,
    take: 20,
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      reference: true,
      fullName: true,
      mobile: true,
      team: true,
      status: true,
      createdAt: true,
      data: true,
      fee: true,
      photoKey: true,
      photoUpdatedAt: true
    }
  }), db.registration.count({
    where
  })]);
  res.json({
    items: items.map(({ photoKey, photoUpdatedAt, ...r }) => ({ ...r, ...adminPhoto({ ...r, photoKey, photoUpdatedAt }) })),
    total,
    page
  });
});
app.get('/api/admin/players/:id', async (req, res) => {
  const r = await db.registration.findUnique({
    where: {
      id: String(req.params.id)
    },
    select: {
      id: true,
      reference: true,
      fullName: true,
      status: true,
      data: true,
      fee: true,
      createdAt: true,
      mobile: true,
      team: true,
      photoKey: true,
      photoUpdatedAt: true,
      payments: {
        select: {
          id: true,
          transactionId: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      },
      history: {
        include: {
          admin: {
            select: {
              email: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    }
  });
  if (!r) fail(404, 'Player not found');
  await db.audit.create({
    data: {
      adminId: res.locals.admin.id,
      action: 'VIEW_PLAYER',
      target: r!.id
    }
  });
  const { photoKey, photoUpdatedAt, ...details } = r!;
  res.json({ ...details, ...adminPhoto({ ...details, photoKey, photoUpdatedAt }) });
});
app.get('/api/admin/players/:id/photo', async (req, res) => {
  const r = await db.registration.findUnique({ where: { id: String(req.params.id) }, select: { id: true, photoKey: true } });
  if (!r?.photoKey) return fail(404, 'Player photo not found');
  const image = await getProof(r.photoKey);
  await db.audit.create({ data: { adminId: res.locals.admin.id, action: 'VIEW_PLAYER_PHOTO', target: r.id } });
  res.type('jpeg').set('Content-Disposition', 'inline; filename="player-photo.jpg"').send(image);
});
app.post('/api/admin/players/:id/photo', photoUpload, async (req, res) => {
  const saved = await savePhoto(String(req.params.id), req.file?.buffer, res.locals.admin.id);
  res.json(adminPhoto(saved));
});
app.get('/api/admin/proofs/:id', async (req, res) => {
  const p = await db.payment.findUnique({
    where: {
      id: String(req.params.id)
    }
  });
  if (!p) fail(404, 'Proof not found');
  const data = await getProof(p!.storageKey);
  await db.audit.create({
    data: {
      adminId: res.locals.admin.id,
      action: 'VIEW_PROOF',
      target: p!.id
    }
  });
  res.type('jpeg').set('Content-Disposition', 'inline; filename="payment-proof.jpg"').send(data);
});
app.post('/api/admin/players/:id/review', async (req, res) => {
  const {
    status,
    reason
  } = z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reason: z.string().trim().max(1000).default('')
  }).strict().parse(req.body);
  await locked(async tx => {
    const r = await tx.registration.findUnique({
      where: {
        id: String(req.params.id)
      }
    });
    if (!r) fail(404, 'Player not found');
    if (r!.status !== 'UNDER_REVIEW') fail(409, 'Only payments under review can be decided');
    const s = await tx.settings.findUniqueOrThrow({
      where: {
        id: '1'
      }
    });
    if (status === 'APPROVED' && (await tx.registration.count({
      where: {
        status: 'APPROVED'
      }
    })) >= s.capacity) fail(409, 'Accepted registration capacity has been reached');
    await tx.registration.update({
      where: {
        id: r!.id
      },
      data: {
        status
      }
    });
    await tx.verification.create({
      data: {
        registrationId: r!.id,
        adminId: res.locals.admin.id,
        status,
        reason
      }
    });
    await tx.audit.create({
      data: {
        adminId: res.locals.admin.id,
        action: status,
        target: r!.id
      }
    });
  });
  res.json({
    status
  });
});
app.put('/api/admin/settings', async (req, res) => {
  const data = settingsSchema.parse(req.body);
  if (data.rules !== undefined) fail(400, 'Use the dedicated rules editor to update and confirm both languages');
  await locked(async tx => {
    if (data.capacity < (await tx.registration.count({
      where: {
        status: 'APPROVED'
      }
    }))) fail(409, 'Capacity cannot be lower than the approved count');
    await tx.settings.update({
      where: {
        id: '1'
      },
      data: {
        ...data,
        opensAt: data.opensAt ? new Date(data.opensAt) : null,
        closesAt: data.closesAt ? new Date(data.closesAt) : null
      }
    });
    await tx.audit.create({
      data: {
        adminId: res.locals.admin.id,
        action: 'UPDATE_SETTINGS',
        target: '1'
      }
    });
  });
  res.json({
    ok: true
  });
});
app.get('/api/admin/export', async (req, res) => {
  const rows = await db.registration.findMany({
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      reference: true,
      fullName: true,
      mobile: true,
      team: true,
      status: true,
      fee: true,
      createdAt: true,
      data: true
    }
  });
  await db.audit.create({
    data: {
      adminId: res.locals.admin.id,
      action: 'EXPORT_CSV',
      target: String(rows.length)
    }
  });
  const columns = ['reference', 'fullName', 'mobile', 'team', 'status', 'fee', 'createdAt', ...optionalFields.filter(f => f !== 'team')];
  const csv = [columns.map(csvCell).join(','), ...rows.map(r => columns.map(k => csvCell(k in r ? r[k as keyof typeof r] : (r.data as Record<string, unknown>)[k])).join(','))].join('\r\n');
  res.type('text/csv').attachment('dpl-registrations.csv').send('\uFEFF' + csv);
});
app.get('/api/admin/audit', async (req, res) => {
  const page = z.coerce.number().int().min(1).default(1).parse(req.query.page);
  res.json(await db.audit.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    skip: (page - 1) * 50,
    take: 50
  }));
});
app.use('/api', (_req, _res, next) => next(new ApiError(404, 'API route not found')));
app.use('/images', express.static(path.resolve('public/images')));
if (config.production && !process.env.VERCEL) {
  app.use(express.static(path.resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
}
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({
    error: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
  });
  if (err instanceof multer.MulterError) return res.status(400).json({
    error: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 4 MB or smaller' : 'Invalid upload: ' + err.message
  });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return res.status(409).json({
    error: 'Mobile number or transaction reference is already registered. Use your existing private status token.'
  });
  if (err instanceof ApiError) return res.status(err.status).json({
    error: err.message
  });
  if (err instanceof SyntaxError) return res.status(400).json({
    error: 'Invalid JSON request'
  });
  console.error('Request failed', err instanceof Error ? err.name : 'Unknown error');
  return res.status(500).json({
    error: 'The operation failed. Please try again; if it persists, contact the organiser.'
  });
});
