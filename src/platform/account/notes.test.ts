import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestError } from '@/platform/request';
import { addNote, decodeCreatedNote, decodeNotes, deleteNote, listNotes } from './notes';

const note = { id: 'note-1', body: 'Private <script>text</script>', createdAt: '2026-10-06T00:00:00.000Z' };

afterEach(() => vi.unstubAllGlobals());

describe('private note response boundaries', () => {
  it('accepts the documented list and creation responses', () => {
    expect(decodeNotes({ notes: [note] })).toEqual([note]);
    expect(decodeCreatedNote({ note })).toEqual(note);
  });

  it.each([
    null, { notes: {} }, { notes: [null] }, { notes: [{ ...note, id: '' }] },
    { notes: [{ ...note, body: ' ' }] }, { notes: [{ ...note, body: 'x'.repeat(2001) }] },
    { notes: [{ ...note, createdAt: 'bad' }] }, { notes: [note, note] },
  ])('rejects malformed notes before rendering', value => {
    expect(() => decodeNotes(value)).toThrow(RequestError);
  });

  it('sends real browser credentials, trims note text, and encodes IDs as a single path segment', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ notes: [note] }))
      .mockResolvedValueOnce(Response.json({ note }, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    await expect(listNotes('https://api.example.com', signal)).resolves.toEqual([note]);
    await expect(addNote('https://api.example.com', '  Private text  ', signal)).resolves.toEqual(note);
    await deleteNote('https://api.example.com', '../other/note', signal);
    expect(fetch.mock.calls[0][1]).toMatchObject({ credentials: 'include', cache: 'no-store', signal });
    expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: 'include', method: 'POST', body: '{"body":"Private text"}', signal });
    expect(fetch.mock.calls[2][0]).toBe('https://api.example.com/api/notes/..%2Fother%2Fnote');
    expect(fetch.mock.calls[2][1]).toMatchObject({ credentials: 'include', method: 'DELETE', signal });
  });

  it('does not treat a failed delete as success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(deleteNote('https://api.example.com', note.id, new AbortController().signal)).rejects.toMatchObject({ status: 404 });
  });
});
