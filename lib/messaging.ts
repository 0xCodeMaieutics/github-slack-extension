import { browser } from 'wxt/browser';
import type { ReviewRequest } from './review-request';
import type { ChannelRef, MemberRef } from './settings';
import type { SlackChannel, SlackMember } from './slack';

export interface SendResult {
  delivered: number;
  failures: { reviewerId: string; error: string }[];
}

export interface Requests {
  getSetup: {
    request: {};
    response: { configured: boolean; defaultChannel: ChannelRef | null; defaultReviewers: MemberRef[] };
  };
  listChannels: { request: {}; response: SlackChannel[] };
  listMembers: { request: {}; response: SlackMember[] };
  sendReviewRequest: { request: { reviewRequest: ReviewRequest }; response: SendResult };
  openSettings: { request: {}; response: null };
}

export type RequestType = keyof Requests;

export type RequestMessage = {
  [K in RequestType]: { type: K } & Requests[K]['request'];
}[RequestType];

type Envelope<T> = { ok: true; data: T } | { ok: false; error: string };

/** Content scripts never see the Slack token; they ask the background worker to call Slack instead. */
export async function request<K extends RequestType>(
  type: K,
  payload: Requests[K]['request'] = {} as Requests[K]['request'],
): Promise<Requests[K]['response']> {
  const envelope: Envelope<Requests[K]['response']> | undefined = await browser.runtime.sendMessage({
    type,
    ...payload,
  });
  if (!envelope) throw new Error('The extension background worker did not respond. Reload the page.');
  if (!envelope.ok) throw new Error(envelope.error);
  return envelope.data;
}

export type { Envelope };
