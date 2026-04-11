/**
 * Introduction post screen — compose and publish first Hive post.
 *
 * Pre-filled title and thank-you line. User writes "about me" (required)
 * and "interests" (optional). The photo from profile setup is embedded
 * in the post body automatically. Post is broadcast to a newcomer
 * community (default: OCD / hive-174578).
 */

import type { ScreenFn } from '../../types';
import { t, fmt } from '../locale';
import { signAndBroadcast } from '../../hive/broadcast';

/** Default community for introduction posts. */
const DEFAULT_COMMUNITY = 'hive-174578';

/**
 * Generate a URL-safe permlink from a title.
 * Appends a base-36 timestamp suffix for uniqueness.
 */
function generatePermlink(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const suffix = Date.now().toString(36);
  return `${slug}-${suffix}`;
}

/**
 * Assemble the markdown body for the introduction post.
 */
function assemblePostBody(
  imageUrl: string,
  aboutMe: string,
  interests: string,
  thankYou: string,
): string {
  const parts: string[] = [];
  if (imageUrl) parts.push(`![photo](${imageUrl})`);
  parts.push(aboutMe);
  if (interests) parts.push(interests);
  if (thankYou) parts.push(thankYou);
  parts.push('---');
  parts.push('*Posted via [HiveInvite](https://hiveinvite.com)*');
  return parts.join('\n\n');
}

export const IntroPostScreen: ScreenFn = (container, state, advance) => {
  const username = state.username!;
  const postingWif = state.keys!.posting.wif;
  const referrer = state.payload?.referrer ?? '';
  const community = state.payload?.introPostCommunity ?? DEFAULT_COMMUNITY;
  const imageUrl = state.imageUrl ?? '';
  const endpoints = state.payload?.endpoints ?? [];

  const defaultThankYou = referrer ? fmt(t.intro_default_thanks, referrer) : '';

  container.innerHTML = `<div class="ct">
    <h1>${t.intro_title}</h1>
    <p class="sm mb">${t.intro_desc}</p>

    <label>${t.intro_post_title}</label>
    <input type="text" id="post-title" value="${t.intro_default_title}" maxlength="100">

    <label>${t.intro_about_me}</label>
    <textarea id="about-me" placeholder="${t.intro_about_me_placeholder}" rows="3"></textarea>

    <label>${t.intro_interests}</label>
    <textarea id="interests" placeholder="${t.intro_interests_placeholder}" rows="2"></textarea>

    ${defaultThankYou ? `
      <label>${t.intro_thank_you}</label>
      <textarea id="thank-you" rows="2">${defaultThankYou}</textarea>
    ` : ''}

    <button id="publish" disabled>${t.intro_publish}</button>
    <p class="err hidden" id="err"></p>
  </div>`;

  const titleInput = container.querySelector('#post-title') as HTMLInputElement;
  const aboutMeInput = container.querySelector('#about-me') as HTMLTextAreaElement;
  const interestsInput = container.querySelector('#interests') as HTMLTextAreaElement;
  const thankYouInput = container.querySelector('#thank-you') as HTMLTextAreaElement | null;
  const publishBtn = container.querySelector('#publish') as HTMLButtonElement;
  const errEl = container.querySelector('#err') as HTMLElement;

  let submitting = false;

  function validate(): void {
    const valid = titleInput.value.trim().length > 0
      && aboutMeInput.value.trim().length > 0
      && !submitting;
    publishBtn.disabled = !valid;
  }

  function showError(msg: string): void {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    submitting = false;
    validate();
    publishBtn.textContent = t.intro_publish;
  }

  titleInput.addEventListener('input', validate);
  aboutMeInput.addEventListener('input', validate);

  publishBtn.addEventListener('click', async () => {
    errEl.classList.add('hidden');

    const title = titleInput.value.trim();
    const aboutMe = aboutMeInput.value.trim();
    if (!aboutMe) {
      showError(t.intro_about_required);
      return;
    }

    submitting = true;
    publishBtn.disabled = true;
    publishBtn.textContent = t.intro_publishing;

    const interests = interestsInput.value.trim();
    const thankYou = thankYouInput?.value.trim() ?? '';
    const body = assemblePostBody(imageUrl, aboutMe, interests, thankYou);
    const permlink = generatePermlink(title);

    const tags = ['introduceyourself'];
    if (community && !tags.includes(community)) {
      tags.push(community);
    }

    try {
      await signAndBroadcast(
        [['comment', {
          parent_author: '',
          parent_permlink: community,
          author: username,
          permlink,
          title,
          body,
          json_metadata: JSON.stringify({
            tags,
            app: 'hiveinvite/1.0',
            format: 'markdown',
            image: imageUrl ? [imageUrl] : [],
          }),
        }]],
        postingWif,
        endpoints,
      );
    } catch {
      showError(t.intro_publish_failed);
      return;
    }

    advance('success');
  });

  validate();
};
