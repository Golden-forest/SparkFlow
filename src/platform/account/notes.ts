import { requestJson, RequestError } from '@/platform/request';
import { NOTE_MAX_LENGTH } from './config';

export interface AccountNote {
  id: string;
  body: string;
  createdAt: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function decodeNote(value: unknown): AccountNote {
  if (!record(value) || typeof value.id !== 'string' || !value.id || value.id.length > 128
    || typeof value.body !== 'string' || !value.body.trim() || value.body.length > NOTE_MAX_LENGTH
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new RequestError('The server returned an unexpected response.');
  }
  return { id: value.id, body: value.body, createdAt: value.createdAt };
}

export function decodeNotes(value: unknown): AccountNote[] {
  if (!record(value) || !Array.isArray(value.notes)) throw new RequestError('The server returned an unexpected response.');
  const notes = value.notes.map(decodeNote);
  if (new Set(notes.map(note => note.id)).size !== notes.length) throw new RequestError('The server returned an unexpected response.');
  return notes;
}

export function decodeCreatedNote(value: unknown): AccountNote {
  if (!record(value)) throw new RequestError('The server returned an unexpected response.');
  return decodeNote(value.note);
}

export function listNotes(apiURL: string, signal: AbortSignal): Promise<AccountNote[]> {
  return requestJson(`${apiURL}/api/notes`, decodeNotes, { credentials: 'include', cache: 'no-store', signal });
}

export function addNote(apiURL: string, body: string, signal: AbortSignal): Promise<AccountNote> {
  return requestJson(`${apiURL}/api/notes`, decodeCreatedNote, {
    method: 'POST', credentials: 'include', signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: body.trim() }),
  });
}

export async function deleteNote(apiURL: string, id: string, signal: AbortSignal): Promise<void> {
  const response = await fetch(`${apiURL}/api/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE', credentials: 'include', signal,
  });
  if (response.status !== 204) throw new RequestError('The request failed. Please try again.', response.status);
}
