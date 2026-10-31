const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!open));
  menuToggle.setAttribute('aria-label', open ? 'Open navigation' : 'Close navigation');
  mainNav.classList.toggle('open', !open);
});
mainNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  mainNav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Open navigation');
}));

document.querySelector('#year').textContent = new Date().getFullYear();

const dialog = document.querySelector('.request-dialog');
const form = document.querySelector('#service-form');
const typeInput = form.elements.serviceType;
const categorySelect = form.elements.category;
const titleInput = form.elements.subject;
const categoryLabel = document.querySelector('#category-label');
const titleLabel = document.querySelector('#subject-label');
const dialogIntro = document.querySelector('.dialog-intro');
const submitButton = form.querySelector('.form-submit');
const successPanel = document.querySelector('.success-panel');
const formError = form.querySelector('.form-error');
const supabaseConfig = window.SUPABASE_CONFIG;
const serviceSettings = {
  complaint: {
    title: 'Raise a complaint', intro: 'Let us know what needs attention so it can be reviewed.',
    category: 'Issue type', options: ['Common area maintenance', 'Cleaning', 'Lift or building access', 'Parking', 'Noise or disturbance', 'Other'],
    subject: 'Issue summary', placeholder: 'What needs attention?'
  },
  feedback: {
    title: 'Share feedback', intro: 'Tell us what could make our shared spaces or services better.',
    category: 'Feedback about', options: ['Repair or maintenance', 'Cleaning or upkeep', 'Safety or security', 'Shared spaces', 'A new improvement', 'Other'],
    subject: 'Idea or work to be done', placeholder: 'A short title for your suggestion'
  },
  security: {
    title: 'Request a security service', intro: 'Share what kind of security assistance you need and when.',
    category: 'Service requested', options: ['Visitor assistance', 'Escort within the society', 'Security concern', 'Delivery or access support', 'Other'],
    subject: 'What do you need?', placeholder: 'A short title for your request'
  },
  payment: {
    title: 'Request payment details', intro: 'Ask society management for the current maintenance dues or payment instructions.',
    category: 'Information needed', options: ['Current amount due', 'Payment schedule', 'Payment method or account details', 'Receipt or payment confirmation', 'Other'],
    subject: 'Payment information request', placeholder: 'What payment information do you need?'
  }
};

const flatSelect = form.elements.flat;
for (let floor = 4; floor >= 1; floor--) {
  const group = document.createElement('optgroup');
  group.label = `Floor ${floor}`;
  for (let unit = 1; unit <= 5; unit++) {
    const option = document.createElement('option');
    option.value = `${floor}0${unit}`;
    option.textContent = `Flat ${floor}0${unit}`;
    group.append(option);
  }
  flatSelect.append(group);
}

function openRequest(type) {
  const settings = serviceSettings[type];
  if (!settings) return;
  form.reset();
  typeInput.value = type;
  document.querySelector('#dialog-title').innerHTML = `${settings.title.split(' ')[0]} <em>${settings.title.split(' ').slice(1).join(' ')}</em>`;
  dialogIntro.textContent = settings.intro;
  categoryLabel.firstChild.textContent = `${settings.category} `;
  categorySelect.replaceChildren(new Option('Select an option', '', true, true));
  categorySelect.options[0].disabled = true;
  settings.options.forEach(item => categorySelect.add(new Option(item, item)));
  titleLabel.firstChild.textContent = `${settings.subject} `;
  titleInput.placeholder = settings.placeholder;
  submitButton.firstChild.textContent = 'Submit request ';
  formError.hidden = true;
  formError.textContent = '';
  submitButton.disabled = false;
  form.hidden = false;
  successPanel.hidden = true;
  dialog.showModal();
  form.elements.name.focus();
}

document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openRequest(button.dataset.open)));
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
document.querySelector('.success-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  if (event.target === dialog) dialog.close();
});

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  saveResidentRequest();
});

function makeRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function responseMessage(response) {
  try {
    const body = await response.json();
    return body.message || body.error || body.msg || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

async function uploadAttachment(requestId, file) {
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[file.type];
  if (!extension) throw new Error('Choose a JPEG, PNG or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('The photo must be smaller than 10 MB.');
  const path = `${requestId}.${extension}`;
  const response = await fetch(`${supabaseConfig.url}/storage/v1/object/${supabaseConfig.attachmentBucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: supabaseConfig.publishableKey,
      Authorization: `Bearer ${supabaseConfig.publishableKey}`,
      'Content-Type': file.type,
      'x-upsert': 'false'
    },
    body: file
  });
  if (!response.ok) throw new Error('The photo could not be uploaded. Please try again or submit without it.');
  return path;
}

async function saveResidentRequest() {
  if (!supabaseConfig?.url || !supabaseConfig?.publishableKey) {
    formError.textContent = 'The resident request service is not configured yet. Please contact society management.';
    formError.hidden = false;
    return;
  }

  const originalButtonText = submitButton.firstChild.textContent;
  submitButton.disabled = true;
  submitButton.firstChild.textContent = 'Saving request… ';
  formError.hidden = true;
  formError.textContent = '';

  try {
    const values = new FormData(form);
    const file = values.get('attachment');
    const hasFile = file instanceof File && file.size > 0;
    const requestId = makeRequestId();
    const attachmentPath = hasFile ? await uploadAttachment(requestId, file) : null;
    const payload = {
      id: requestId,
      request_type: String(values.get('serviceType') || '').trim(),
      resident_name: String(values.get('name') || '').trim(),
      flat_number: String(values.get('flat') || '').trim(),
      phone: String(values.get('phone') || '').trim(),
      category: String(values.get('category') || '').trim(),
      subject: String(values.get('subject') || '').trim(),
      details: String(values.get('details') || '').trim(),
      attachment_path: attachmentPath,
      attachment_name: hasFile ? file.name.slice(0, 255) : null
    };
    const response = await fetch(`${supabaseConfig.url}/rest/v1/resident_requests`, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.publishableKey,
        Authorization: `Bearer ${supabaseConfig.publishableKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(await responseMessage(response));

    form.hidden = true;
    successPanel.hidden = false;
    successPanel.querySelector('button').focus();
  } catch (error) {
    formError.textContent = error.message === 'Failed to fetch'
      ? 'We could not reach the request service. Check your connection and try again.'
      : error.message || 'We could not save your request. Please try again.';
    formError.hidden = false;
    submitButton.disabled = false;
    submitButton.firstChild.textContent = originalButtonText;
  }
}
