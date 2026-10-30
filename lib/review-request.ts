import type { PullRequest } from './pull-request';

export type Destination = { type: 'channel'; channelId: string } | { type: 'direct' };

export interface ReviewRequest {
  pullRequest: PullRequest;
  destination: Destination;
  reviewerIds: string[];
  note: string;
}

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Slack mrkdwn for a Review Request. Mentions are only included for channel Destinations. */
export function formatReviewRequest(request: ReviewRequest): string {
  const { pullRequest: pr, destination, reviewerIds, note } = request;

  const meta = [`${pr.owner}/${pr.repo}#${pr.number}`];
  if (pr.additions !== null && pr.deletions !== null) meta.push(`+${pr.additions} −${pr.deletions}`);

  const lines = [`:github-pull-request: *<${pr.url}|${escape(pr.title)}>*`, meta.join(' · ')];
  if (destination.type === 'channel') lines.unshift(reviewerIds.map((id) => `<@${id}>`).join(' '));
  const trimmedNote = note.trim();
  if (trimmedNote) lines.push(...trimmedNote.split('\n').map((line) => `> ${escape(line)}`));
  return lines.join('\n');
}
