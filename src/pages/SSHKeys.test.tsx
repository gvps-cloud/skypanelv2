import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SSHKeys from '@/pages/SSHKeys';
import { renderWithAuth } from '@/test-utils';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const sshKeysResponse = {
  keys: [
    {
      id: 'ssh-1',
      name: 'Deploy Key',
      fingerprint: 'SHA256:deploy-key',
      linode_key_id: 'provider-1',
      created_at: '2026-03-01T10:00:00.000Z',
      updated_at: '2026-03-01T10:00:00.000Z',
      creator: {
        id: 'user-1',
        name: 'Storm Moran',
        email: 'storm@example.com',
      },
    },
    {
      id: 'ssh-2',
      name: 'Root Access',
      fingerprint: 'SHA256:root-access',
      linode_key_id: null,
      created_at: '2026-03-02T10:00:00.000Z',
      updated_at: '2026-03-02T10:00:00.000Z',
      creator: null,
    },
  ],
};

const fetchMock = vi.fn();

function renderPage(initialEntry: string = '/ssh-keys') {
  return renderWithAuth(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SSHKeys />
    </MemoryRouter>
  );
}

describe('SSHKeys page', () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/ssh-keys' && (!init?.method || init.method === 'GET')) {
        return new Response(JSON.stringify(sshKeysResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (url === '/api/ssh-keys/ssh-1' && init?.method === 'DELETE') {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'SSH key deleted successfully',
            description: 'The key has been removed from all cloud providers.',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      throw new Error(`Unhandled fetch request: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('loads keys, preserves selected highlighting, and renders creator details', async () => {
    renderPage('/ssh-keys?keyId=ssh-2');

    expect(await screen.findByText('Organization SSH Keys')).toBeTruthy();
    expect(screen.getByText('Storm Moran')).toBeTruthy();
    expect(screen.getByText('Unknown user')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();
    expect(screen.getByTestId('ssh-key-card-ssh-2').getAttribute('data-selected')).toBe('true');
    expect(screen.getByTestId('ssh-key-card-ssh-1').getAttribute('data-selected')).toBe('false');
  });

  it('uses the shared destructive delete action and deletes a key through the dialog', async () => {
    renderPage();

    const deleteButton = await screen.findByRole('button', { name: 'Delete Deploy Key' });
    expect(deleteButton.className.includes('bg-destructive')).toBe(true);

    fireEvent.click(deleteButton);

    const dialog = await screen.findByRole('alertdialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete SSH Key' });
    expect(confirmButton.className.includes('bg-destructive')).toBe(true);

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/ssh-keys/ssh-1',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });
  });
});