import express, { Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { createCustomRateLimiter } from '../middleware/rateLimiting.js';
import { logActivity } from '../services/activityLogger.js';
import {
  NotesError,
  NotesService,
} from '../services/notes.js';

const router = express.Router();
const notesMutationRateLimiter = createCustomRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 120,
  userType: 'authenticated',
});

function handleNotesError(res: Response, error: unknown, fallbackMessage: string) {
  if (error instanceof NotesError) {
    return res.status(error.status).json({ error: error.message });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({ error: fallbackMessage });
}

router.use(authenticateToken);
router.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    notesMutationRateLimiter(req, res, next);
    return;
  }

  next();
});

router.get('/notes/personal', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const notes = await NotesService.listPersonalNotes(req.user.id);
    res.json({ notes });
  } catch (error) {
    handleNotesError(res, error, 'Failed to load personal notes');
  }
});

router.get('/notes/personal/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const note = await NotesService.getPersonalNote(req.params.noteId, req.user.id);
    res.json({ note });
  } catch (error) {
    handleNotesError(res, error, 'Failed to load personal note');
  }
});

router.post('/notes/personal', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if ('organizationId' in (req.body || {}) || 'scope' in (req.body || {})) {
    return res.status(400).json({
      error: 'Personal notes cannot include organization context or custom scope',
    });
  }

  try {
    const note = await NotesService.createPersonalNote(req.user.id, {
      title: req.body?.title,
      content: req.body?.content ?? '',
    });
    res.status(201).json({ note });
  } catch (error) {
    handleNotesError(res, error, 'Failed to create personal note');
  }
});

router.put('/notes/personal/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if ('organizationId' in (req.body || {}) || 'scope' in (req.body || {})) {
    return res.status(400).json({
      error: 'Personal notes cannot include organization context or custom scope',
    });
  }

  try {
    const note = await NotesService.updatePersonalNote(
      req.params.noteId,
      req.user.id,
      {
        title: req.body?.title,
        content: req.body?.content ?? '',
      },
    );
    res.json({ note });
  } catch (error) {
    handleNotesError(res, error, 'Failed to update personal note');
  }
});

router.delete('/notes/personal/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await NotesService.deletePersonalNote(req.params.noteId, req.user.id);
    res.json({ success: true });
  } catch (error) {
    handleNotesError(res, error, 'Failed to delete personal note');
  }
});

router.get('/notes/organizations', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const data = await NotesService.listAllOrganizationNotes(
      req.user.id,
      typeof req.query.organizationId === 'string'
        ? req.query.organizationId
        : undefined,
    );

    res.json(data);
  } catch (error) {
    handleNotesError(res, error, 'Failed to load organization notes');
  }
});

router.get('/organizations/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const data = await NotesService.listOrganizationNotes(req.params.id, req.user.id);
    res.json(data);
  } catch (error) {
    handleNotesError(res, error, 'Failed to load organization notes');
  }
});

router.get('/organizations/:id/notes/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const data = await NotesService.getOrganizationNote(
      req.params.id,
      req.params.noteId,
      req.user.id,
    );
    res.json(data);
  } catch (error) {
    handleNotesError(res, error, 'Failed to load organization note');
  }
});

router.post('/organizations/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if ('scope' in (req.body || {})) {
    return res.status(400).json({ error: 'Organization notes cannot override scope' });
  }

  const bodyOrganizationId =
    typeof req.body?.organizationId === 'string'
      ? req.body.organizationId
      : req.params.id;

  if (bodyOrganizationId !== req.params.id) {
    return res.status(400).json({ error: 'Organization note scope mismatch' });
  }

  try {
    const data = await NotesService.createOrganizationNote(req.user.id, {
      organizationId: req.params.id,
      title: req.body?.title,
      content: req.body?.content ?? '',
    });

    await logActivity({
      userId: req.user.id,
      organizationId: req.params.id,
      eventType: 'notes.created',
      entityType: 'note',
      entityId: data.note.id,
      message: `Created note "${data.note.title}"`,
      status: 'success',
      metadata: {
        noteId: data.note.id,
        title: data.note.title,
        scope: data.note.scope,
      },
    });

    res.status(201).json(data);
  } catch (error) {
    handleNotesError(res, error, 'Failed to create organization note');
  }
});

router.put('/organizations/:id/notes/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if ('organizationId' in (req.body || {}) || 'scope' in (req.body || {})) {
    return res.status(400).json({
      error: 'Organization note scope cannot be changed',
    });
  }

  try {
    const data = await NotesService.updateOrganizationNote(
      req.params.id,
      req.params.noteId,
      req.user.id,
      {
        title: req.body?.title,
        content: req.body?.content ?? '',
      },
    );

    await logActivity({
      userId: req.user.id,
      organizationId: req.params.id,
      eventType: 'notes.updated',
      entityType: 'note',
      entityId: data.note.id,
      message: `Updated note "${data.note.title}"`,
      status: 'info',
      metadata: {
        noteId: data.note.id,
        title: data.note.title,
        scope: data.note.scope,
      },
    });

    res.json(data);
  } catch (error) {
    handleNotesError(res, error, 'Failed to update organization note');
  }
});

router.delete('/organizations/:id/notes/:noteId', async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { noteId, id } = req.params;
    const organization = await NotesService.deleteOrganizationNote(id, noteId, req.user.id);

    await logActivity({
      userId: req.user.id,
      organizationId: id,
      eventType: 'notes.deleted',
      entityType: 'note',
      entityId: noteId,
      message: `Deleted an organization note in ${organization.organizationName}`,
      status: 'warning',
      metadata: {
        noteId,
        scope: 'organization',
      },
    });

    res.json({ success: true });
  } catch (error) {
    handleNotesError(res, error, 'Failed to delete organization note');
  }
});

export default router;
