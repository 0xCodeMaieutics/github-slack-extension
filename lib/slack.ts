export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

export interface SlackMember {
  id: string;
  name: string;
  realName: string;
  displayName: string;
  avatar: string;
}

export interface SlackIdentity {
  user: string;
  userId: string;
  team: string;
}

export class SlackApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: string,
  ) {
    super(describeSlackError(code));
  }
}

function describeSlackError(code: string): string {
  switch (code) {
    case 'not_authed':
    case 'invalid_auth':
    case 'token_revoked':
    case 'account_inactive':
      return 'Slack rejected the token. Paste a valid user token (xoxp-…) in the extension settings.';
    case 'missing_scope':
      return 'The Slack token is missing a required scope. Reinstall the Slack app using slack-app-manifest.json.';
    case 'not_in_channel':
    case 'channel_not_found':
      return 'You are not a member of that channel.';
    case 'ratelimited':
      return 'Slack is rate limiting requests. Try again in a minute.';
    default:
      return `Slack error: ${code}`;
  }
}

type Params = Record<string, string | number | boolean | undefined>;

async function call<T>(token: string, method: string, params: Params = {}): Promise<T> {
  if (!token) throw new SlackApiError(method, 'not_authed');
  const body = new URLSearchParams({ token });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) body.set(key, String(value));
  }
  const response = await fetch(`https://slack.com/api/${method}`, { method: 'POST', body });
  if (response.status === 429) throw new SlackApiError(method, 'ratelimited');
  const json = await response.json();
  if (!json.ok) throw new SlackApiError(method, json.error ?? 'unknown_error');
  return json as T;
}

async function paginate<T>(
  token: string,
  method: string,
  params: Params,
  pick: (page: any) => T[],
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await call<any>(token, method, { ...params, limit: 200, cursor });
    items.push(...pick(page));
    cursor = page.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return items;
}

export async function testConnection(token: string): Promise<SlackIdentity> {
  const result = await call<any>(token, 'auth.test');
  return { user: result.user, userId: result.user_id, team: result.team };
}

/** Channels the token's user belongs to, since a user token can only post where its user is a member. */
export async function listChannels(token: string): Promise<SlackChannel[]> {
  const channels = await paginate(
    token,
    'conversations.list',
    { types: 'public_channel,private_channel', exclude_archived: true },
    (page) => page.channels as any[],
  );
  return channels
    .filter((c) => c.is_member)
    .map((c) => ({ id: c.id, name: c.name, isPrivate: Boolean(c.is_private) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listMembers(token: string): Promise<SlackMember[]> {
  const members = await paginate(token, 'users.list', {}, (page) => page.members as any[]);
  return members
    .filter((m) => !m.deleted && !m.is_bot && m.id !== 'USLACKBOT')
    .map((m) => ({
      id: m.id,
      name: m.name,
      realName: m.profile?.real_name || m.real_name || m.name,
      displayName: m.profile?.display_name || '',
      avatar: m.profile?.image_48 || '',
    }))
    .sort((a, b) => a.realName.localeCompare(b.realName));
}

export function matchesMember(member: SlackMember, query: string): boolean {
  const q = query.toLowerCase();
  return [member.realName, member.displayName, member.name].some((value) => value.toLowerCase().includes(q));
}

export async function postMessage(token: string, channel: string, text: string): Promise<void> {
  await call(token, 'chat.postMessage', { channel, text, unfurl_links: false, unfurl_media: false });
}

export async function openDirectMessage(token: string, userId: string): Promise<string> {
  const result = await call<any>(token, 'conversations.open', { users: userId });
  return result.channel.id;
}
