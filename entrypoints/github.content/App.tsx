import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SlackIcon } from '@/components/SlackIcon';
import { request, type SendResult } from '@/lib/messaging';
import { readPullRequest, type PullRequest } from '@/lib/pull-request';
import { formatReviewRequest, type Destination } from '@/lib/review-request';
import { matchesMember, type SlackChannel, type SlackMember } from '@/lib/slack';

type Load =
  | { status: 'loading' }
  | { status: 'unconfigured' }
  | { status: 'error'; error: string }
  | { status: 'ready'; channels: SlackChannel[]; members: SlackMember[]; defaultChannelId: string | null };

type Send = { status: 'idle' } | { status: 'sending' } | { status: 'sent'; result: SendResult } | { status: 'error'; error: string };

const MAX_SUGGESTIONS = 8;

/** Slack mrkdwn shown as plain text, with mentions and links resolved to names. */
function toPreview(text: string, members: SlackMember[]): string {
  return text
    .replace(/<@(\w+)>/g, (_, id) => `@${members.find((m) => m.id === id)?.realName ?? id}`)
    .replace(/<([^|>]+)\|([^>]+)>/g, '$2')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(':eyes:', '👀')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function App({ floating }: { floating: boolean }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !event.composedPath().includes(rootRef.current)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointerDown, true);
    rootRef.current?.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      rootRef.current?.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} class="root">
      <button
        ref={buttonRef}
        type="button"
        class={floating ? 'trigger trigger--floating' : 'trigger'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <SlackIcon />
        <span>Request PR review</span>
      </button>
      {open && <Panel anchor={buttonRef.current} floating={floating} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Panel({ anchor, floating, onClose }: { anchor: HTMLElement | null; floating: boolean; onClose: () => void }) {
  const pullRequest = useMemo<PullRequest | null>(() => readPullRequest(), []);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [destinationType, setDestinationType] = useState<Destination['type']>('channel');
  const [channelId, setChannelId] = useState('');
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [send, setSend] = useState<Send>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const setup = await request('getSetup');
        if (!setup.configured) return !cancelled && setLoad({ status: 'unconfigured' });
        const [channels, members] = await Promise.all([request('listChannels'), request('listMembers')]);
        if (cancelled) return;
        const defaultChannelId = channels.some((c) => c.id === setup.defaultChannel?.id) ? setup.defaultChannel!.id : null;
        setChannelId(defaultChannelId ?? '');
        setReviewerIds(setup.defaultReviewers.map((r) => r.id).filter((id) => members.some((m) => m.id === id)));
        setLoad({ status: 'ready', channels, members, defaultChannelId });
      } catch (error) {
        if (!cancelled) setLoad({ status: 'error', error: String((error as Error).message ?? error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const position = useMemo(() => {
    const rect = anchor?.getBoundingClientRect();
    if (!rect) return {};
    const right = `${Math.max(8, window.innerWidth - rect.right)}px`;
    return floating ? { right, bottom: `${window.innerHeight - rect.top + 8}px` } : { right, top: `${rect.bottom + 8}px` };
  }, [anchor, floating]);

  const members = load.status === 'ready' ? load.members : [];
  const reviewers = reviewerIds.map((id) => members.find((m) => m.id === id)!).filter(Boolean);
  const suggestions = query.trim()
    ? members.filter((m) => !reviewerIds.includes(m.id) && matchesMember(m, query.trim())).slice(0, MAX_SUGGESTIONS)
    : [];

  const destination: Destination | null =
    destinationType === 'direct' ? { type: 'direct' } : channelId ? { type: 'channel', channelId } : null;
  const reviewRequest = pullRequest && destination ? { pullRequest, destination, reviewerIds, note } : null;
  const canSend = reviewRequest !== null && reviewerIds.length > 0 && send.status !== 'sending';

  const addReviewer = (id: string) => {
    setReviewerIds([...reviewerIds, id]);
    setQuery('');
  };

  const submit = async () => {
    if (!reviewRequest || !canSend) return;
    setSend({ status: 'sending' });
    try {
      const result = await request('sendReviewRequest', { reviewRequest });
      setSend({ status: 'sent', result });
      if (result.failures.length === 0) {
        setReviewerIds([]);
        setNote('');
      }
    } catch (error) {
      setSend({ status: 'error', error: String((error as Error).message ?? error) });
    }
  };

  return (
    <div class="panel" role="dialog" aria-label="Request PR review on Slack" style={position}>
      <header class="panel__header">
        <SlackIcon size={18} />
        <strong>Request PR review</strong>
        <button type="button" class="icon-button" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>

      {load.status === 'loading' && <p class="muted">Loading Slack channels and members…</p>}

      {load.status === 'unconfigured' && (
        <div class="notice">
          <p>Connect Slack first: paste your Slack user token in the extension settings.</p>
          <button type="button" class="btn btn--primary" onClick={() => request('openSettings')}>
            Open settings
          </button>
        </div>
      )}

      {load.status === 'error' && (
        <div class="notice notice--error">
          <p>{load.error}</p>
          <button type="button" class="btn" onClick={() => request('openSettings')}>
            Open settings
          </button>
        </div>
      )}

      {load.status === 'ready' && (
        <form
          class="panel__body"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div class="segmented" role="radiogroup" aria-label="Destination">
            {(['channel', 'direct'] as const).map((type) => (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={destinationType === type}
                class={destinationType === type ? 'segmented__option is-selected' : 'segmented__option'}
                onClick={() => setDestinationType(type)}
              >
                {type === 'channel' ? 'Channel' : 'Direct messages'}
              </button>
            ))}
          </div>

          {destinationType === 'channel' && (
            <label class="field">
              <span class="field__label">Channel</span>
              <select value={channelId} onChange={(e) => setChannelId(e.currentTarget.value)}>
                <option value="">Choose a channel…</option>
                {load.channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.isPrivate ? '🔒 ' : '#'}
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div class="field">
            <span class="field__label">Reviewers</span>
            {reviewers.length > 0 && (
              <ul class="chips">
                {reviewers.map((r) => (
                  <li key={r.id} class="chip">
                    {r.avatar && <img src={r.avatar} alt="" />}
                    {r.realName}
                    <button
                      type="button"
                      aria-label={`Remove ${r.realName}`}
                      onClick={() => setReviewerIds(reviewerIds.filter((id) => id !== r.id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input
              type="search"
              placeholder="Search Slack members…"
              value={query}
              autoFocus
              onInput={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (suggestions[0]) addReviewer(suggestions[0].id);
              }}
            />
            {suggestions.length > 0 && (
              <ul class="suggestions" role="listbox">
                {suggestions.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => addReviewer(m.id)}>
                      {m.avatar && <img src={m.avatar} alt="" />}
                      <span>{m.realName}</span>
                      {m.displayName && m.displayName !== m.realName && <span class="muted">@{m.displayName}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label class="field">
            <span class="field__label">Note (optional)</span>
            <textarea rows={2} value={note} placeholder="e.g. small one, ~50 lines" onInput={(e) => setNote(e.currentTarget.value)} />
          </label>

          {reviewRequest && reviewerIds.length > 0 && (
            <div class="field">
              <span class="field__label">Preview</span>
              <pre class="preview">{toPreview(formatReviewRequest(reviewRequest), members)}</pre>
            </div>
          )}

          {send.status === 'sent' && (
            <p class={send.result.failures.length ? 'notice notice--error' : 'notice notice--success'}>
              {describeResult(send.result, destinationType, members)}
            </p>
          )}
          {send.status === 'error' && <p class="notice notice--error">{send.error}</p>}

          <button type="submit" class="btn btn--primary" disabled={!canSend}>
            {send.status === 'sending'
              ? 'Sending…'
              : destinationType === 'direct' && reviewerIds.length > 1
                ? `Send ${reviewerIds.length} direct messages`
                : 'Send review request'}
          </button>
        </form>
      )}
    </div>
  );
}

function describeResult(result: SendResult, destinationType: Destination['type'], members: SlackMember[]): string {
  if (result.failures.length === 0) {
    return destinationType === 'channel'
      ? 'Review request posted.'
      : `Review request sent to ${result.delivered} ${result.delivered === 1 ? 'Reviewer' : 'Reviewers'}.`;
  }
  const failed = result.failures
    .map((f) => `${members.find((m) => m.id === f.reviewerId)?.realName ?? 'Unknown'}: ${f.error}`)
    .join('; ');
  return `Sent ${result.delivered}, failed ${result.failures.length}. ${failed}`;
}
