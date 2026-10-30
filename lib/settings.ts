import { storage } from 'wxt/utils/storage';

export interface ChannelRef {
  id: string;
  name: string;
}

export interface MemberRef {
  id: string;
  name: string;
}

// `local:` keeps the token on this device only; `sync:` would copy it to every signed-in browser.
export const slackToken = storage.defineItem<string>('local:slackToken', { fallback: '' });

export const defaultChannel = storage.defineItem<ChannelRef | null>('local:defaultChannel', {
  fallback: null,
});

export const defaultReviewers = storage.defineItem<MemberRef[]>('local:defaultReviewers', { fallback: [] });
