import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import VpsSshConsole from '@/pages/VpsSshConsole';
import { renderWithAuth } from '@/test-utils';

vi.mock('@/components/VPS/SSHTerminal', () => ({
  default: () => <div data-testid="ssh-terminal-mock" />,
}));

const fetchMock = vi.fn();

const instanceId = '9455c0a2-d07d-496f-a7c4-1e53ac9d6047';

function renderConsole(search = '') {
  const path = `/vps/${instanceId}/ssh${search}`;
  return renderWithAuth(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/vps/:id/ssh" element={<VpsSshConsole />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('VpsSshConsole access gate', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('renders SSH terminal only when GET /api/vps/:id succeeds with an instance', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/api/vps/${instanceId}`) {
        return new Response(JSON.stringify({ instance: { id: instanceId, notes: '' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    renderConsole();

    await waitFor(() => {
      expect(screen.getByTestId('ssh-terminal-mock')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /close window/i })).toBeTruthy();
  });

  it('does not render SSH terminal when GET /api/vps/:id returns 403', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/api/vps/${instanceId}`) {
        return new Response(JSON.stringify({ error: 'Insufficient permissions' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    renderConsole();

    await waitFor(() => {
      expect(screen.getByText(/unable to open this ssh console/i)).toBeTruthy();
    });
    expect(screen.queryByTestId('ssh-terminal-mock')).toBeNull();
  });

  it('does not render SSH terminal when GET /api/vps/:id returns 404', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/api/vps/${instanceId}`) {
        return new Response(JSON.stringify({ error: 'Instance not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    renderConsole();

    await waitFor(() => {
      expect(screen.getByText(/unable to open this ssh console/i)).toBeTruthy();
    });
    expect(screen.queryByTestId('ssh-terminal-mock')).toBeNull();
  });

  it('does not set document title from label query until access is allowed', async () => {
    const label = 'used-for-development-only';
    document.title = 'InitialTitle';

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === `/api/vps/${instanceId}`) {
        return new Response(JSON.stringify({ instance: { id: instanceId } }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unhandled fetch: ${url}`);
    });

    renderConsole(`?label=${encodeURIComponent(label)}`);

    await waitFor(() => {
      expect(screen.getByText(/unable to open this ssh console/i)).toBeTruthy();
    });

    expect(document.title).toBe('InitialTitle');
  });
});
