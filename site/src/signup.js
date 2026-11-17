/* "Let's talk": a three step form that creates the client in Packforge through
   its public portal_register_client function, the same one behind /join/{code}.
   Config lives in /config.js. Without a JOIN_CODE it falls back to email.

   Packforge stores business, contact, email, phone, location and industry.
   The needs picked in step 1 aren't a Packforge field yet, so they travel in
   the follow-up email offered on the success screen. */

const STEPS = 3;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function initSignup() {
  const cfg = window.PACKFORGE || {};
  const form = document.querySelector('[data-brief]');
  const steps = [...form.querySelectorAll('[data-step]')];
  const bar = [...form.querySelectorAll('.steps-bar span')];
  const count = form.querySelector('[data-step-count]');
  const review = form.querySelector('[data-review]');
  const errorEl = form.querySelector('[data-brief-error]');
  const back = form.querySelector('[data-step-back]');
  const next = form.querySelector('[data-step-next]');
  const submitBtn = form.querySelector('[data-brief-submit]');
  const done = document.querySelector('[data-brief-done]');
  const canRegister = Boolean(cfg.SUPABASE_URL && cfg.PUBLISHABLE_KEY && cfg.JOIN_CODE);
  const idleLabel = canRegister ? 'Create my client portal' : 'Send my details';
  submitBtn.textContent = idleLabel;
  let current = 1;

  const data = () => {
    const f = form.elements;
    return {
      needs: [...form.querySelectorAll('input[name="need"]:checked')].map((i) => i.value),
      business: f.business.value.trim(),
      industry: f.industry.value,
      location: f.location.value.trim(),
      contact: f.contact.value.trim(),
      email: f.email.value.trim(),
      phone: f.phone.value.trim(),
    };
  };

  const showError = (msg, field) => {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  };
  const clearError = () => { errorEl.hidden = true; };

  // Returns true when the step can be left.
  function validate(step) {
    const d = data();
    const f = form.elements;
    if (step === 1 && d.needs.length === 0) {
      showError('Pick at least one, or choose "Not sure yet".');
      form.querySelector('input[name="need"]').focus();
      return false;
    }
    if (step === 2 && !d.business) { showError('Add your business name so I know who you are.', f.business); return false; }
    if (step === 3 && !EMAIL.test(d.email)) { showError('Add an email address I can reach you on.', f.email); return false; }
    return true;
  }

  function go(step, { focus = true } = {}) {
    const forward = step > current;
    current = step;
    clearError();
    steps.forEach((s) => {
      const on = Number(s.dataset.step) === step;
      s.hidden = !on;
      s.classList.toggle('from-left', on && !forward);
    });
    bar.forEach((b, i) => b.classList.toggle('is-on', i < step));
    count.textContent = `Step ${step} of ${STEPS}`;
    back.hidden = step === 1;
    next.hidden = step === STEPS;
    submitBtn.hidden = step !== STEPS;

    if (step === STEPS) {
      const d = data();
      const where = [d.industry, d.location].filter(Boolean).join(', ');
      review.textContent = `${d.business}${where ? ` (${where})` : ''}. Looking for: ${d.needs.join(', ')}.`;
    }
    if (focus) steps[step - 1].querySelector('input, select')?.focus({ preventScroll: true });
  }

  next.addEventListener('click', () => { if (validate(current)) go(current + 1); });
  back.addEventListener('click', () => go(current - 1));

  // "Not sure yet" and the specific needs are mutually exclusive.
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'need' || !e.target.checked) return;
    const unsure = e.target.value === 'Not sure yet';
    form.querySelectorAll('input[name="need"]').forEach((i) => {
      if (i !== e.target && (unsure || i.value === 'Not sure yet')) i.checked = false;
    });
  });

  form.addEventListener('input', (e) => {
    e.target.removeAttribute('aria-invalid');
    clearError();
  });

  const mailtoFor = (d) => {
    const lines = [
      `Business: ${d.business}`,
      d.contact && `Name: ${d.contact}`,
      `Email: ${d.email}`,
      d.phone && `Phone: ${d.phone}`,
      d.location && `Location: ${d.location}`,
      d.industry && `Industry: ${d.industry}`,
      `Looking for: ${d.needs.join(', ')}`,
      '',
      'About the project:',
      '',
    ].filter((l) => typeof l === 'string');
    return `mailto:ryan@lonewolfdigitech.com?subject=${encodeURIComponent(`New project: ${d.business}`)}&body=${encodeURIComponent(lines.join('\n'))}`;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Enter in an earlier step moves forward instead of submitting.
    if (current < STEPS) { if (validate(current)) go(current + 1); return; }
    for (let s = 1; s <= STEPS; s++) {
      if (!validate(s)) { if (s !== current) { go(s); validate(s); } return; }
    }
    const d = data();

    if (!canRegister) {
      window.location.href = mailtoFor(d);
      return;
    }

    submitBtn.disabled = true;
    back.disabled = true;
    submitBtn.textContent = 'Creating your portal…';
    try {
      const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/rpc/portal_register_client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.PUBLISHABLE_KEY,
          Authorization: `Bearer ${cfg.PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          p_code: cfg.JOIN_CODE,
          p_name: d.business,
          p_contact: d.contact,
          p_email: d.email,
          p_phone: d.phone,
          p_location: d.location,
          p_industry: d.industry,
        }),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok || !result?.ok || !result.portalToken) {
        const msg = result?.error || result?.message || 'The portal could not be created just now.';
        showError(`${msg} You can also email me at ryan@lonewolfdigitech.com.`);
        return;
      }
      done.querySelector('[data-done-name]').textContent = result.name || d.business;
      done.querySelector('[data-done-portal]').href = `${cfg.PORTAL_ORIGIN}/portal/${result.portalToken}`;
      done.querySelector('[data-done-mail]').href = mailtoFor(d);
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch {
      showError('Your connection dropped before the portal was created. Try again, or email me at ryan@lonewolfdigitech.com.');
    } finally {
      submitBtn.disabled = false;
      back.disabled = false;
      submitBtn.textContent = idleLabel;
    }
  });

  go(1, { focus: false });
}
