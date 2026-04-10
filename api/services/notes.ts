import { transaction, query } from '../lib/database.js';

export type NoteScope = 'personal' | 'organization';

interface NoteInput {
  title: string;
  content: string;
}

interface OrganizationNoteInput extends NoteInput {
  organizationId: string;
}

interface NoteActor {
  id: string | null;
  name: string | null;
  email: string | null;
}

export interface NoteRecord {
  id: string;
  scope: NoteScope;
  organizationId: string | null;
  organizationName: string | null;
  ownerUserId: string | null;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  createdBy: NoteActor | null;
  updatedBy: NoteActor | null;
}

export interface OrganizationNoteMembership {
  organizationId: string;
  organizationName: string;
  canManage: boolean;
}

interface OrganizationMembershipCheck extends OrganizationNoteMembership {
  isMember: boolean;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TITLE_LENGTH = 160;
const MAX_CONTENT_LENGTH = 50000;

export class NotesError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function assertUuid(value: string, fieldName: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new NotesError(400, `Invalid ${fieldName}`);
  }
}

function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function validateNoteInput(input: NoteInput): NoteInput {
  if (typeof input.title !== 'string') {
    throw new NotesError(400, 'Title is required');
  }

  const title = input.title.trim();
  if (!title) {
    throw new NotesError(400, 'Title is required');
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw new NotesError(
      400,
      `Title must be ${MAX_TITLE_LENGTH} characters or fewer`,
    );
  }

  if (typeof input.content !== 'string') {
    throw new NotesError(400, 'Content must be a string');
  }

  const content = normalizeContent(input.content);
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new NotesError(
      400,
      `Content must be ${MAX_CONTENT_LENGTH} characters or fewer`,
    );
  }

  return { title, content };
}

function mapNoteRow(row: any): NoteRecord {
  return {
    id: row.id,
    scope: row.scope,
    organizationId: row.organization_id ?? null,
    organizationName: row.organization_name ?? null,
    ownerUserId: row.owner_user_id ?? null,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by_id
      ? {
          id: row.created_by_id,
          name: row.created_by_name ?? null,
          email: row.created_by_email ?? null,
        }
      : null,
    updatedBy: row.updated_by_id
      ? {
          id: row.updated_by_id,
          name: row.updated_by_name ?? null,
          email: row.updated_by_email ?? null,
        }
      : null,
  };
}

const NOTE_SELECT = `
  SELECT
    n.id,
    n.scope,
    n.organization_id,
    o.name AS organization_name,
    n.owner_user_id,
    n.title,
    n.content,
    n.created_at,
    n.updated_at,
    created_user.id AS created_by_id,
    created_user.name AS created_by_name,
    created_user.email AS created_by_email,
    updated_user.id AS updated_by_id,
    updated_user.name AS updated_by_name,
    updated_user.email AS updated_by_email
  FROM notes n
  LEFT JOIN organizations o ON o.id = n.organization_id
  LEFT JOIN users created_user ON created_user.id = n.created_by_user_id
  LEFT JOIN users updated_user ON updated_user.id = n.updated_by_user_id
`;

async function getOrganizationMembership(
  userId: string,
  organizationId: string,
): Promise<OrganizationMembershipCheck> {
  assertUuid(organizationId, 'organization ID');

  const result = await query(
    `SELECT
       o.id AS organization_id,
       o.name AS organization_name,
       om.role AS legacy_role,
       role.name AS role_name,
       role.permissions
     FROM organizations o
     JOIN organization_members om
       ON om.organization_id = o.id
     LEFT JOIN organization_roles role
       ON role.id = om.role_id
     WHERE o.id = $1 AND om.user_id = $2`,
    [organizationId, userId],
  );

  if (result.rows.length === 0) {
    throw new NotesError(403, 'Not a member of this organization');
  }

  const row = result.rows[0];
  const permissions = Array.isArray(row.permissions)
    ? row.permissions
    : JSON.parse(row.permissions || '[]');
  const roleName = row.role_name || row.legacy_role || '';
  const canManage =
    roleName === 'owner' ||
    roleName === 'admin' ||
    permissions.includes('notes_manage');

  return {
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    isMember: true,
    canManage,
  };
}

export class NotesService {
  static async listPersonalNotes(userId: string): Promise<NoteRecord[]> {
    const result = await query(
      `${NOTE_SELECT}
       WHERE n.scope = 'personal' AND n.owner_user_id = $1
       ORDER BY n.updated_at DESC, n.created_at DESC`,
      [userId],
    );

    return result.rows.map(mapNoteRow);
  }

  static async getPersonalNote(noteId: string, userId: string): Promise<NoteRecord> {
    assertUuid(noteId, 'note ID');

    const result = await query(
      `${NOTE_SELECT}
       WHERE n.id = $1 AND n.scope = 'personal' AND n.owner_user_id = $2`,
      [noteId, userId],
    );

    if (result.rows.length === 0) {
      throw new NotesError(404, 'Personal note not found');
    }

    return mapNoteRow(result.rows[0]);
  }

  static async createPersonalNote(
    userId: string,
    input: NoteInput,
  ): Promise<NoteRecord> {
    const { title, content } = validateNoteInput(input);

    return transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO notes (
           scope,
           owner_user_id,
           created_by_user_id,
           updated_by_user_id,
           title,
           content
         )
         VALUES ('personal', $1, $1, $1, $2, $3)
         RETURNING id`,
        [userId, title, content],
      );

      const created = await client.query(
        `${NOTE_SELECT}
         WHERE n.id = $1`,
        [result.rows[0].id],
      );

      return mapNoteRow(created.rows[0]);
    });
  }

  static async updatePersonalNote(
    noteId: string,
    userId: string,
    input: NoteInput,
  ): Promise<NoteRecord> {
    assertUuid(noteId, 'note ID');
    const { title, content } = validateNoteInput(input);

    return transaction(async (client) => {
      const updated = await client.query(
        `UPDATE notes
         SET title = $1,
             content = $2,
             updated_by_user_id = $3,
             updated_at = NOW()
         WHERE id = $4
           AND scope = 'personal'
           AND owner_user_id = $3
         RETURNING id`,
        [title, content, userId, noteId],
      );

      if (updated.rows.length === 0) {
        throw new NotesError(404, 'Personal note not found');
      }

      const note = await client.query(
        `${NOTE_SELECT}
         WHERE n.id = $1`,
        [noteId],
      );

      return mapNoteRow(note.rows[0]);
    });
  }

  static async deletePersonalNote(noteId: string, userId: string): Promise<void> {
    assertUuid(noteId, 'note ID');

    const result = await query(
      `DELETE FROM notes
       WHERE id = $1 AND scope = 'personal' AND owner_user_id = $2`,
      [noteId, userId],
    );

    if (result.rowCount === 0) {
      throw new NotesError(404, 'Personal note not found');
    }
  }

  static async listOrganizationMemberships(
    userId: string,
  ): Promise<OrganizationNoteMembership[]> {
    const result = await query(
      `SELECT
         o.id AS organization_id,
         o.name AS organization_name,
         om.role AS legacy_role,
         role.name AS role_name,
         role.permissions
       FROM organizations o
       JOIN organization_members om
         ON om.organization_id = o.id
       LEFT JOIN organization_roles role
         ON role.id = om.role_id
       WHERE om.user_id = $1
       ORDER BY o.name ASC`,
      [userId],
    );

    return result.rows.map((row: any) => {
      const permissions = Array.isArray(row.permissions)
        ? row.permissions
        : JSON.parse(row.permissions || '[]');
      const roleName = row.role_name || row.legacy_role || '';
      const canManage =
        roleName === 'owner' ||
        roleName === 'admin' ||
        permissions.includes('notes_manage');

      return {
        organizationId: row.organization_id,
        organizationName: row.organization_name,
        canManage,
      };
    });
  }

  static async listAllOrganizationNotes(
    userId: string,
    organizationId?: string,
  ): Promise<{
    organizations: OrganizationNoteMembership[];
    notes: NoteRecord[];
  }> {
    const organizations = await this.listOrganizationMemberships(userId);
    const allowedOrganizationIds = organizations.map((org) => org.organizationId);

    if (organizationId) {
      assertUuid(organizationId, 'organization ID');
      if (!allowedOrganizationIds.includes(organizationId)) {
        throw new NotesError(403, 'Not a member of this organization');
      }
    }

    if (allowedOrganizationIds.length === 0) {
      return { organizations: [], notes: [] };
    }

    const filteredOrganizationIds = organizationId
      ? [organizationId]
      : allowedOrganizationIds;

    const result = await query(
      `${NOTE_SELECT}
       WHERE n.scope = 'organization'
         AND n.organization_id = ANY($1::uuid[])
       ORDER BY n.updated_at DESC, n.created_at DESC`,
      [filteredOrganizationIds],
    );

    return {
      organizations,
      notes: result.rows.map(mapNoteRow),
    };
  }

  static async listOrganizationNotes(
    organizationId: string,
    userId: string,
  ): Promise<{
    organization: OrganizationNoteMembership;
    notes: NoteRecord[];
  }> {
    const organization = await getOrganizationMembership(userId, organizationId);
    const result = await query(
      `${NOTE_SELECT}
       WHERE n.scope = 'organization'
         AND n.organization_id = $1
       ORDER BY n.updated_at DESC, n.created_at DESC`,
      [organizationId],
    );

    return {
      organization,
      notes: result.rows.map(mapNoteRow),
    };
  }

  static async getOrganizationNote(
    organizationId: string,
    noteId: string,
    userId: string,
  ): Promise<{
    organization: OrganizationNoteMembership;
    note: NoteRecord;
  }> {
    const organization = await getOrganizationMembership(userId, organizationId);
    assertUuid(noteId, 'note ID');

    const result = await query(
      `${NOTE_SELECT}
       WHERE n.id = $1
         AND n.scope = 'organization'
         AND n.organization_id = $2`,
      [noteId, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotesError(404, 'Organization note not found');
    }

    return {
      organization,
      note: mapNoteRow(result.rows[0]),
    };
  }

  static async createOrganizationNote(
    userId: string,
    input: OrganizationNoteInput,
  ): Promise<{
    organization: OrganizationNoteMembership;
    note: NoteRecord;
  }> {
    const { organizationId } = input;
    const organization = await getOrganizationMembership(userId, organizationId);
    if (!organization.canManage) {
      throw new NotesError(403, 'Insufficient permissions to manage organization notes');
    }

    const { title, content } = validateNoteInput(input);

    const note = await transaction(async (client) => {
      const created = await client.query(
        `INSERT INTO notes (
           scope,
           organization_id,
           created_by_user_id,
           updated_by_user_id,
           title,
           content
         )
         VALUES ('organization', $1, $2, $2, $3, $4)
         RETURNING id`,
        [organizationId, userId, title, content],
      );

      const result = await client.query(
        `${NOTE_SELECT}
         WHERE n.id = $1`,
        [created.rows[0].id],
      );

      return mapNoteRow(result.rows[0]);
    });

    return { organization, note };
  }

  static async updateOrganizationNote(
    organizationId: string,
    noteId: string,
    userId: string,
    input: NoteInput,
  ): Promise<{
    organization: OrganizationNoteMembership;
    note: NoteRecord;
  }> {
    assertUuid(noteId, 'note ID');
    const organization = await getOrganizationMembership(userId, organizationId);
    if (!organization.canManage) {
      throw new NotesError(403, 'Insufficient permissions to manage organization notes');
    }

    const { title, content } = validateNoteInput(input);

    const note = await transaction(async (client) => {
      const updated = await client.query(
        `UPDATE notes
         SET title = $1,
             content = $2,
             updated_by_user_id = $3,
             updated_at = NOW()
         WHERE id = $4
           AND scope = 'organization'
           AND organization_id = $5
         RETURNING id`,
        [title, content, userId, noteId, organizationId],
      );

      if (updated.rows.length === 0) {
        throw new NotesError(404, 'Organization note not found');
      }

      const result = await client.query(
        `${NOTE_SELECT}
         WHERE n.id = $1`,
        [noteId],
      );

      return mapNoteRow(result.rows[0]);
    });

    return { organization, note };
  }

  static async deleteOrganizationNote(
    organizationId: string,
    noteId: string,
    userId: string,
  ): Promise<OrganizationNoteMembership> {
    assertUuid(noteId, 'note ID');
    const organization = await getOrganizationMembership(userId, organizationId);
    if (!organization.canManage) {
      throw new NotesError(403, 'Insufficient permissions to manage organization notes');
    }

    const result = await query(
      `DELETE FROM notes
       WHERE id = $1
         AND scope = 'organization'
         AND organization_id = $2`,
      [noteId, organizationId],
    );

    if (result.rowCount === 0) {
      throw new NotesError(404, 'Organization note not found');
    }

    return organization;
  }
}
