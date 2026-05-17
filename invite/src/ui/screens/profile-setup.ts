/**
 * Profile setup screen — photo, display name, bio, location, website.
 *
 * Uploads the photo to Hive image hosting, then broadcasts an
 * account_update2 operation to set the user's profile metadata.
 * The photo URL is stored in state for reuse in the intro post.
 */

import type { ScreenFn } from '../../types';
import { t } from '../locale';
import { compressImage, uploadImage } from '../../hive/image-upload';
import { signAndBroadcast } from '../../hive/broadcast';

export const ProfileSetupScreen: ScreenFn = (container, state, advance) => {
  const username = state.username!;
  const postingWif = state.keys!.posting.wif;
  const endpoints = state.payload?.endpoints ?? [];

  let imageFile: File | null = null;
  let submitting = false;

  container.innerHTML = `<div class="ct">
    <h1>${t.profile_title}</h1>
    <p class="sm mb">${t.profile_desc}</p>

    <div class="photo-area">
      <button type="button" id="photo-btn" class="btn-s">${t.profile_photo_btn}</button>
      <input type="file" id="photo-input" class="photo-input" accept="image/*" capture="user">
      <img id="photo-preview" class="photo-preview hidden" alt="">
    </div>

    <label>${t.profile_display_name}</label>
    <input type="text" id="display-name" placeholder="${t.profile_display_name_placeholder}" maxlength="30">

    <label>${t.profile_about}</label>
    <textarea id="about" placeholder="${t.profile_about_placeholder}" rows="2" maxlength="160"></textarea>

    <label>${t.profile_location}</label>
    <input type="text" id="location" placeholder="${t.profile_location_placeholder}" maxlength="30">

    <label>${t.profile_website}</label>
    <input type="url" id="website" placeholder="${t.profile_website_placeholder}" maxlength="100">

    <button id="submit" disabled>${t.profile_continue}</button>
    <p class="err hidden" id="err"></p>
  </div>`;

  const photoBtn = container.querySelector('#photo-btn') as HTMLButtonElement;
  const photoInput = container.querySelector('#photo-input') as HTMLInputElement;
  const photoPreview = container.querySelector('#photo-preview') as HTMLImageElement;
  const nameInput = container.querySelector('#display-name') as HTMLInputElement;
  const aboutInput = container.querySelector('#about') as HTMLTextAreaElement;
  const locationInput = container.querySelector('#location') as HTMLInputElement;
  const websiteInput = container.querySelector('#website') as HTMLInputElement;
  const submitBtn = container.querySelector('#submit') as HTMLButtonElement;
  const errEl = container.querySelector('#err') as HTMLElement;

  function validate(): void {
    const valid = !!imageFile && nameInput.value.trim().length > 0 && !submitting;
    submitBtn.disabled = !valid;
  }

  function showError(msg: string): void {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
    submitting = false;
    validate();
    submitBtn.textContent = t.profile_continue;
  }

  // Photo capture — clicking the button triggers the hidden file input
  photoBtn.addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    imageFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = () => {
      photoPreview.src = reader.result as string;
      photoPreview.classList.remove('hidden');
      photoBtn.textContent = t.profile_photo_change;
    };
    reader.readAsDataURL(file);
    validate();
  });

  nameInput.addEventListener('input', validate);

  submitBtn.addEventListener('click', async () => {
    errEl.classList.add('hidden');

    if (!imageFile) {
      showError(t.profile_photo_required);
      return;
    }
    const displayName = nameInput.value.trim();
    if (!displayName) {
      showError(t.profile_name_required);
      return;
    }

    submitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = t.profile_uploading;

    // 1. Compress and upload image
    let imageUrl: string;
    try {
      const compressed = await compressImage(imageFile);
      imageUrl = await uploadImage(compressed, username, postingWif);
    } catch {
      showError(t.profile_upload_failed);
      return;
    }

    // 2. Broadcast profile update
    submitBtn.textContent = t.profile_saving;

    const about = aboutInput.value.trim();
    const location = locationInput.value.trim();
    const website = websiteInput.value.trim();

    const profile: Record<string, string> = {
      name: displayName,
      profile_image: imageUrl,
    };
    if (about) profile.about = about;
    if (location) profile.location = location;
    if (website) profile.website = website;

    try {
      await signAndBroadcast(
        [['account_update2', {
          account: username,
          json_metadata: '',
          posting_json_metadata: JSON.stringify({ profile }),
          extensions: [],
        }]],
        postingWif,
        endpoints,
      );
    } catch {
      showError(t.profile_save_failed);
      return;
    }

    // 3. Store results in state for the intro post screen
    state.imageUrl = imageUrl;
    state.profileData = { displayName, about, location, website };

    advance('intro');
  });

  validate();
};
