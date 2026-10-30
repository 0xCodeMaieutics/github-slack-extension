import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import type { Envelope, RequestMessage, SendResult } from '@/lib/messaging';
import { formatReviewRequest, type ReviewRequest } from '@/lib/review-request';
import { defaultChannel, defaultReviewers, slackToken } from '@/lib/settings';
import { listChannels, listMembers, openDirectMessage, postMessage } from '@/lib/slack';

async function sendReviewRequest(token: string, reviewRequest: ReviewRequest): Promise<SendResult> {
  if (reviewRequest.reviewerIds.length === 0) throw new Error('Pick at least one Reviewer.');
  const text = formatReviewRequest(reviewRequest);
  const { destination } = reviewRequest;

  if (destination.type === 'channel') {
    await postMessage(token, destination.channelId, text);
    return { delivered: 1, failures: [] };
  }

  const results = await Promise.allSettled(
    reviewRequest.reviewerIds.map(async (reviewerId) => {
      const channel = await openDirectMessage(token, reviewerId);
      await postMessage(token, channel, text);
    }),
  );
  const failures = reviewRequest.reviewerIds.flatMap((reviewerId, i) => {
    const result = results[i];
    return result?.status === 'rejected' ? [{ reviewerId, error: String(result.reason?.message ?? result.reason) }] : [];
  });
  return { delivered: results.length - failures.length, failures };
}

async function handle(message: RequestMessage): Promise<unknown> {
  switch (message.type) {
    case 'getSetup':
      return {
        configured: Boolean(await slackToken.getValue()),
        defaultChannel: await defaultChannel.getValue(),
        defaultReviewers: await defaultReviewers.getValue(),
      };
    case 'listChannels':
      return listChannels(await slackToken.getValue());
    case 'listMembers':
      return listMembers(await slackToken.getValue());
    case 'sendReviewRequest':
      return sendReviewRequest(await slackToken.getValue(), message.reviewRequest);
    case 'openSettings':
      await browser.runtime.openOptionsPage();
      return null;
  }
}

export default defineBackground(() => {
  browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());

  browser.runtime.onMessage.addListener((message: RequestMessage, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
    handle(message).then(
      (data) => sendResponse({ ok: true, data } satisfies Envelope<unknown>),
      (error) => sendResponse({ ok: false, error: String(error?.message ?? error) } satisfies Envelope<unknown>),
    );
    return true;
  });
});
