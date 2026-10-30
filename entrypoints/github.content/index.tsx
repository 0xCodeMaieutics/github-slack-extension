import { render } from 'preact';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { isPrPagePath, readPullRequestState } from '@/lib/pull-request';
import { App } from './App';
import './style.css';

/** Classic and React PR headers; when neither is found the button floats in the corner instead. */
const HEADER_ACTION_SELECTORS = ['.gh-header-show .gh-header-actions', '[data-component="PH_Actions"]'];

/** GitHub hides the React header actions with `d-none` at some widths, so only visible containers count. */
function findHeaderActions(): Element | null {
  for (const selector of HEADER_ACTION_SELECTORS) {
    for (const element of document.querySelectorAll(selector)) {
      if (element.checkVisibility()) return element;
    }
  }
  return null;
}

function shouldShowButton(): boolean {
  if (!isPrPagePath(location.pathname)) return false;
  const state = readPullRequestState();
  return state === 'open' || state === 'draft' || state === 'unknown';
}

export default defineContentScript({
  // All of github.com, because GitHub navigates to PR pages without a full page load.
  matches: ['https://github.com/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'slack-review-request',
      position: 'inline',
      isolateEvents: true,
      anchor: () => findHeaderActions() ?? document.body,
      append: (anchor, element) => {
        if (anchor === document.body) anchor.append(element);
        else anchor.prepend(element);
      },
      onMount: (container, _shadow, host) => {
        const floating = !findHeaderActions();
        host.classList.toggle('floating', floating);
        render(<App floating={floating} />, container);
        return container;
      },
      onRemove: (container) => {
        if (container) render(null, container);
      },
    });

    const sync = () => {
      const host = ui.shadowHost;
      if (!shouldShowButton()) {
        if (host.isConnected) ui.remove();
        return;
      }
      const parent = findHeaderActions() ?? document.body;
      if (!host.isConnected || host.parentElement !== parent) {
        ui.remove();
        ui.mount();
      }
    };

    let scheduled = false;
    const scheduleSync = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        sync();
      });
    };

    const observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    ctx.onInvalidated(() => observer.disconnect());
    ctx.addEventListener(window, 'wxt:locationchange', scheduleSync);
    sync();
  },
});
