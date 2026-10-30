export interface PullRequest {
  url: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  author: string | null;
  additions: number | null;
  deletions: number | null;
}

export type PullRequestState = 'open' | 'draft' | 'closed' | 'merged' | 'unknown';

const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/;

export function isPrPagePath(pathname: string): boolean {
  return PR_PATH.test(pathname);
}

function text(selectors: string[]): string | null {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return null;
}

function count(selectors: string[]): number | null {
  const value = text(selectors);
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

/** GitHub ships both a classic and a React PR header, so every lookup tries both. */
export function readPullRequestState(): PullRequestState {
  // React header: data-status is e.g. "pullOpened", "pullMerged", "draft". Classic header: label text.
  const label = (
    document.querySelector('[data-component="StateLabel"][data-status]')?.getAttribute('data-status') ??
    text(['.gh-header-meta .State', 'span.State[title^="Status"]'])
  )?.toLowerCase();
  if (!label) return 'unknown';
  if (label.includes('draft')) return 'draft';
  if (label.includes('merged')) return 'merged';
  if (label.includes('closed')) return 'closed';
  if (label.includes('open') || label.includes('queued')) return 'open';
  return 'unknown';
}

export function readPullRequest(): PullRequest | null {
  const match = location.pathname.match(PR_PATH);
  if (!match) return null;
  const [, owner = '', repo = '', number = ''] = match;

  // e.g. "Fix login redirect by octocat · Pull Request #42 · acme/web"
  const fromTitle = document.title.match(/^(.*) by (\S+) · Pull Request #\d+ · /);

  const title =
    text(['.gh-header-title .js-issue-title', 'bdi.js-issue-title', '[data-testid="issue-title"]', 'h1 .markdown-title']) ??
    fromTitle?.[1] ??
    `Pull request #${number}`;
  const author = fromTitle?.[2] ?? text(['.gh-header-meta .author', '[data-testid="author-link"]']);

  return {
    url: `https://github.com/${owner}/${repo}/pull/${number}`,
    owner,
    repo,
    number: Number(number),
    title,
    author,
    additions: count(['#diffstat .color-fg-success', '[data-testid="diffstat"] .fgColor-success']),
    deletions: count(['#diffstat .color-fg-danger', '[data-testid="diffstat"] .fgColor-danger']),
  };
}
