// Модуль формы заявки: вкладки «Рассчитать цену» / «Сотрудничество», проверка полей,
// отправка в api/lead.php, состояния ответа и черновик в localStorage.
// DOM-контракт — interfaces.md, «Модуль формы».

const DRAFT_KEY = 'vsecheki:lead-draft:v1';
const MIN_FILL_MS = 3000; // сервер считает более быструю отправку ботом
const REQUEST_TIMEOUT_MS = 20000;
const NB = ' ';
const PHONE_HTML = `<a href="tel:+79202431957">8${NB}920${NB}243-19-57</a>`;
const EMAIL_HTML = '<a href="mailto:ipoderator@yandex.ru">ipoderator@yandex.ru</a>';

const FIELD_ORDER = ['type', 'name', 'phone', 'email', 'company', 'region', 'format', 'format_custom', 'quantity', 'message', 'consent'];
// Согласие в черновик не пишется: на общем компьютере его иначе «давал» бы предыдущий посетитель.
const DRAFT_FIELDS = ['type', 'name', 'phone', 'email', 'company', 'region', 'format', 'format_custom', 'quantity', 'message'];
const PRICE_ONLY = ['format', 'format_custom', 'quantity'];
const FORMAT_LABELS = { '57x40': `57${NB}×${NB}40`, '80x80': `80${NB}×${NB}80`, other: 'другой размер' };

// Тексты ответа. saved — в форме есть введённое: только тогда пишем, что оно сохранено.
const MESSAGES = {
  sending: () => 'Отправляем заявку…',
  success: () => `<strong>Заявка принята.</strong> Мы${NB}свяжемся с${NB}вами. Если срочно${NB}— звоните ${PHONE_HTML}.`,
  invalid: (saved) => `<strong>Проверьте поля, отмеченные красным.</strong>${saved ? ` Введённое сохранено${NB}— исправьте и${NB}отправьте ещё раз.` : ''}`,
  not_configured: (saved) => `<strong>Форма пока не${NB}подключена${NB}— заявка не${NB}отправлена.</strong>${saved ? ` Ваши данные сохранены на${NB}странице.` : ''} Позвоните ${PHONE_HTML} или напишите на${NB}${EMAIL_HTML}.`,
  delivery_failed: (saved) => `<strong>Не${NB}удалось доставить заявку.</strong> ${saved ? `Ваши данные сохранены${NB}— попробуйте` : 'Попробуйте'} отправить ещё раз или позвоните ${PHONE_HTML}.`,
  rate_limited: (saved) => `<strong>Слишком много заявок подряд.</strong> Подождите 10${NB}минут и${NB}отправьте снова или позвоните ${PHONE_HTML}.${saved ? ' Введённое сохранено.' : ''}`,
  network: (saved) => `<strong>Нет связи с${NB}сервером${NB}— заявка не${NB}отправлена.</strong> Проверьте интернет и${NB}нажмите «Отправить заявку» ещё раз.${saved ? ' Введённое сохранено.' : ''} Телефон для связи: ${PHONE_HTML}.`,
  // Запрос оборван по таймеру: сервер мог заявку принять, поэтому не пишем «не отправлена».
  timeout: (saved) => `<strong>Сервер не${NB}ответил вовремя.</strong> Заявка могла дойти, а${NB}могла и${NB}нет. Чтобы не${NB}отправить её дважды, позвоните ${PHONE_HTML}.${saved ? ' Введённое сохранено.' : ''}`,
};

// Правила полей — те же, что в public/app/LeadRequest.php (PHONE_CHARS, EMAIL_PATTERN):
// при правке менять в обоих местах; tests/e2e/form.spec.mjs сверяет клиент и сервер.
const PHONE_CHARS = /^[0-9+().\- \u00A0\u2009\u202F\u2010-\u2015]*$/u;
const EMAIL_PATTERN = /^(?!\.)(?!.*\.\.)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}(?<!\.)@(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:\p{L}{2,63}|xn--[a-z0-9-]{1,59})$/iu;
const PHONE_INVALID = `Укажите телефон: 10${NB}цифр после +7 или${NB}8.`;
const EMAIL_INVALID = `Проверьте адрес e-mail${NB}— например, name@mail.ru.`;

const textLength = (value) => [...value].length;

/** +7XXXXXXXXXX или null — те же правила, что у сервера: буквы и прочие знаки — не телефон. */
export function normalizePhone(phone) {
  if (textLength(phone) > 40 || !PHONE_CHARS.test(phone)) return null;
  const digits = phone.replace(/\D+/g, '');
  if (digits.length === 11 && (digits[0] === '7' || digits[0] === '8')) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits[0] === '9') return `+7${digits}`;
  return null;
}

/** Ошибки полей по-русски; ключи — имена полей (как в ответе 422). */
export function validate(values) {
  const errors = {};
  const name = values.name.trim();
  const nameLength = textLength(name);
  if (nameLength === 0) errors.name = 'Укажите имя.';
  else if (nameLength < 2) errors.name = `Имя слишком короткое${NB}— нужно хотя бы 2${NB}символа.`;
  else if (nameLength > 100) errors.name = `Имя слишком длинное${NB}— не${NB}больше 100${NB}символов.`;

  const phone = values.phone.trim();
  if (phone === '') errors.phone = 'Укажите телефон.';
  else if (!normalizePhone(phone)) errors.phone = PHONE_INVALID;

  const email = values.email.trim();
  if (email !== '') {
    if (textLength(email) > 254) errors.email = `Адрес e-mail слишком длинный${NB}— не${NB}больше 254${NB}символов.`;
    else if (!EMAIL_PATTERN.test(email)) errors.email = EMAIL_INVALID;
  }
  if (textLength(values.company.trim()) > 150) errors.company = `Название компании${NB}— не${NB}больше 150${NB}символов.`;
  if (textLength(values.region.trim()) > 150) errors.region = `Регион${NB}— не${NB}больше 150${NB}символов.`;

  if (values.type === 'price') {
    const custom = values.format_custom.trim();
    if (values.format === 'other' && custom === '') errors.format_custom = 'Укажите нужный размер ленты.';
    else if (textLength(custom) > 100) errors.format_custom = `Размер${NB}— не${NB}больше 100${NB}символов.`;
    if (textLength(values.quantity.trim()) > 100) errors.quantity = `Количество${NB}— не${NB}больше 100${NB}символов.`;
  }
  if (textLength(values.message.trim()) > 2000) errors.message = `Комментарий${NB}— не${NB}больше 2000${NB}символов.`;
  if (!values.consent) errors.consent = `Нужно согласие на${NB}обработку персональных данных.`;
  return errors;
}

const storage = {
  read() {
    try { return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return null; }
  },
  write(data) {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) { /* приватный режим или нет места — без черновика */ }
  },
  clear() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* нет доступа к хранилищу */ }
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function initLeadForm(form) {
  const readyAt = performance.now();
  const els = form.elements;
  const typeInput = els.namedItem('type');
  const tabs = [...form.querySelectorAll('[data-lead-type]')];
  const panel = form.querySelector('[role="tabpanel"]');
  const status = form.querySelector('[data-lead-status]');
  const submit = form.querySelector('[data-lead-submit]');
  const submitLabel = submit.textContent;
  const success = form.querySelector('[data-lead-success]');
  const successTitle = form.querySelector('[data-lead-success-title]');
  const customWrap = form.querySelector('[data-format-custom]');
  const summary = Object.fromEntries([...form.querySelectorAll('[data-summary]')].map((el) => [el.dataset.summary, el]));
  const clear = form.querySelector('[data-lead-clear]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Статус получает фокус после ошибки отправки: иначе фокус с заблокированной кнопки уходит на body.
  status.setAttribute('tabindex', '-1');
  let busy = false;
  let attempted = false;
  let saveTimer = 0;

  /* ----- значения полей ----- */
  function values() {
    const checked = form.querySelector('input[name="format"]:checked');
    return {
      type: typeInput.value === 'partner' ? 'partner' : 'price',
      name: els.namedItem('name').value,
      phone: els.namedItem('phone').value,
      email: els.namedItem('email').value,
      company: els.namedItem('company').value,
      region: els.namedItem('region').value,
      format: checked ? checked.value : '',
      format_custom: els.namedItem('format_custom').value,
      quantity: els.namedItem('quantity').value,
      message: els.namedItem('message').value,
      consent: els.namedItem('consent').checked,
    };
  }

  function fill(data) {
    for (const key of DRAFT_FIELDS) {
      if (!(key in data) || key === 'type') continue;
      if (key === 'format') {
        form.querySelectorAll('input[name="format"]').forEach((radio) => { radio.checked = radio.value === data.format; });
      } else if (typeof data[key] === 'string') {
        els.namedItem(key).value = data[key];
      }
    }
    setType(data.type === 'partner' ? 'partner' : 'price');
  }

  /* ----- черновик ----- */
  /** В форме есть что-то введённое (кроме вкладки). */
  function hasData() {
    const current = values();
    return DRAFT_FIELDS.some((key) => key !== 'type' && String(current[key]).trim() !== '');
  }

  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = 0;
    const current = values();
    const data = {};
    for (const key of DRAFT_FIELDS) data[key] = current[key];
    if (!hasData()) storage.clear();
    else storage.write(data);
  }
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 200);
  }

  /* ----- вкладки ----- */
  function setType(type) {
    typeInput.value = type;
    tabs.forEach((tab) => {
      const selected = tab.dataset.leadType === type;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) panel.setAttribute('aria-labelledby', tab.id);
    });
    form.querySelectorAll('[data-only="price"]').forEach((el) => { el.hidden = type !== 'price'; });
    if (type !== 'price') PRICE_ONLY.forEach((name) => showError(name, ''));
    updateCustom();
    updateSummary();
  }

  function updateCustom() {
    const checked = form.querySelector('input[name="format"]:checked');
    const isOther = !!checked && checked.value === 'other';
    customWrap.hidden = !isOther;
    if (!isOther) showError('format_custom', '');
  }

  function updateSummary() {
    const v = values();
    const dash = '—';
    if (summary.type) summary.type.textContent = v.type === 'partner' ? 'сотрудничество' : 'расчёт цены';
    if (summary.format) {
      let format = FORMAT_LABELS[v.format] || dash;
      if (v.format === 'other' && v.format_custom.trim()) format = v.format_custom.trim();
      summary.format.textContent = format;
    }
    if (summary.quantity) summary.quantity.textContent = v.quantity.trim() || dash;
    if (summary.region) summary.region.textContent = v.region.trim() || dash;
    if (summary.total) summary.total.textContent = v.type === 'partner' ? 'обсудим условия' : 'цена по запросу';
  }

  /* ----- ошибки у полей ----- */
  function controlsFor(name) {
    if (name === 'format') return [...form.querySelectorAll('input[name="format"]')];
    const el = form.querySelector(`#lead-${name}`);
    return el ? [el] : [];
  }

  function showError(name, message) {
    const error = form.querySelector(`[data-error-for="${name}"]`);
    const controls = controlsFor(name);
    if (!error || !controls.length) return false;
    error.textContent = message;
    for (const control of controls) {
      const ids = (control.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== error.id);
      if (message) {
        control.setAttribute('aria-invalid', 'true');
        ids.push(error.id);
      } else {
        control.removeAttribute('aria-invalid');
      }
      if (ids.length) control.setAttribute('aria-describedby', ids.join(' '));
      else control.removeAttribute('aria-describedby');
    }
    if (name === 'format') {
      const fieldset = form.querySelector('.formats-field');
      if (message) fieldset.setAttribute('aria-invalid', 'true');
      else fieldset.removeAttribute('aria-invalid');
    }
    return true;
  }

  function applyErrors(errors) {
    const orphan = [];
    for (const name of FIELD_ORDER) {
      if (name === 'type') continue;
      const message = errors[name] || '';
      if (!showError(name, message) && message) orphan.push(message);
    }
    for (const [name, message] of Object.entries(errors)) {
      if (!FIELD_ORDER.includes(name) || name === 'type') orphan.push(String(message));
    }
    const first = FIELD_ORDER.find((name) => errors[name] && controlsFor(name).length && !controlsFor(name)[0].closest('[hidden]'));
    if (first) {
      const control = (name) => controlsFor(name).find((el) => el.checked) || controlsFor(name)[0];
      control(first).focus();
    }
    return { orphan, focused: !!first };
  }

  /* ----- состояние и статус ----- */
  function setState(state, html = '', extra = []) {
    form.dataset.state = state;
    status.innerHTML = html;
    for (const text of extra) {
      const line = document.createElement('span');
      line.style.display = 'block';
      line.textContent = text;
      status.append(line);
    }
    status.classList.toggle('visually-hidden', state === 'success');
  }

  function setBusy(value) {
    busy = value;
    submit.disabled = value;
    // Пока заявка в пути, нельзя очистить форму или сменить вкладку: ответ относится к тому, что ушло.
    clear.disabled = value;
    tabs.forEach((tab) => { tab.disabled = value; });
    submit.textContent = value ? 'Отправляем…' : submitLabel;
    form.setAttribute('aria-busy', String(value));
  }

  function resetFields() {
    form.reset();
    form.querySelectorAll('[data-error-for]').forEach((el) => showError(el.dataset.errorFor, ''));
    attempted = false;
  }

  /* ----- отправка ----- */
  /** Поля заявки — снимок на момент нажатия «Отправить». */
  function payload() {
    const v = values();
    const data = new FormData(form);
    if (v.type !== 'price') PRICE_ONLY.forEach((name) => data.delete(name));
    else if (v.format !== 'other') data.delete('format_custom');
    data.set('page', window.location.pathname || '/');
    return data;
  }

  async function send(data) {
    data.set('form_elapsed_ms', String(Math.round(performance.now() - readyAt)));

    const controller = 'AbortController' in window ? new AbortController() : null;
    let timedOut = false;
    const timer = controller ? setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS) : 0;
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        signal: controller ? controller.signal : undefined,
      });
      let body = null;
      try { body = await response.json(); } catch (e) { body = null; }
      return { status: response.status, body };
    } catch (e) {
      return { status: 0, body: null, timedOut };
    } finally {
      clearTimeout(timer);
    }
  }

  function codeFor(result) {
    if (result.status === 0) return result.timedOut ? 'timeout' : 'network';
    if (result.body && result.body.ok === true && result.status >= 200 && result.status < 300) return 'ok';
    if (result.body && typeof result.body.code === 'string') return result.body.code;
    if (result.status === 429) return 'rate_limited';
    if (result.status === 503) return 'not_configured';
    return 'delivery_failed';
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    attempted = true;

    const errors = validate(values());
    if (Object.keys(errors).length) {
      setBusy(false);
      setState('error', MESSAGES.invalid(hasData()));
      applyErrors(errors);
      return;
    }
    applyErrors({});
    saveDraft();
    setState('sending', MESSAGES.sending());
    const data = payload();

    const elapsed = performance.now() - readyAt;
    if (elapsed < MIN_FILL_MS) await sleep(MIN_FILL_MS - elapsed + 50);

    const result = await send(data);
    const code = codeFor(result);
    setBusy(false);

    if (code === 'ok') {
      resetFields();
      storage.clear();
      setType('price');
      success.hidden = false;
      setState('success', MESSAGES.success());
      form.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      successTitle.focus({ preventScroll: true });
      return;
    }
    if (code === 'validation') {
      const { orphan, focused } = applyErrors((result.body && result.body.errors) || {});
      setState('error', MESSAGES.invalid(hasData()), orphan);
      if (!focused) status.focus();
      return;
    }
    const message = MESSAGES[code] || MESSAGES.delivery_failed;
    setState('error', message(hasData()));
    status.focus();
  }

  /* ----- события ----- */
  form.addEventListener('submit', onSubmit);

  form.addEventListener('input', (event) => {
    const name = event.target.name;
    if (!name || name === 'website') return;
    if (event.target.matches('input[name="format"]')) updateCustom();
    updateSummary();
    scheduleSave();
    if (attempted && FIELD_ORDER.includes(name)) {
      const message = validate(values())[name] || '';
      showError(name, message);
    }
  });
  form.addEventListener('change', (event) => {
    if (event.target.matches('input[name="format"]')) updateCustom();
    updateSummary();
    scheduleSave();
  });

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { setType(tab.dataset.leadType); scheduleSave(); });
    tab.addEventListener('keydown', (event) => {
      let next = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = tabs[(index + 1) % tabs.length];
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      setType(next.dataset.leadType);
      next.focus();
      scheduleSave();
    });
  });

  clear.addEventListener('click', () => {
    if (busy) return;
    const type = typeInput.value;
    resetFields();
    storage.clear();
    setType(type === 'partner' ? 'partner' : 'price');
    setState('idle');
    els.namedItem('name').focus();
  });

  form.querySelector('[data-lead-again]').addEventListener('click', () => {
    success.hidden = true;
    setState('idle');
    els.namedItem('name').focus();
  });

  // Ссылки #price / #partner в любом месте страницы открывают нужную вкладку.
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href="#price"], a[href="#partner"]');
    if (!link) return;
    setType(link.getAttribute('href').slice(1));
    scheduleSave();
  });
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.slice(1);
    if (hash === 'price' || hash === 'partner') setType(hash);
  });

  // Кнопки «Рассчитать цену на 57 × 40» и т. п.: вкладка цены + выбранный формат.
  document.querySelectorAll('[data-lead-format]').forEach((button) => {
    button.addEventListener('click', () => {
      const format = button.dataset.leadFormat;
      setType('price');
      const radio = form.querySelector(`input[name="format"][value="${format}"]`);
      if (radio) radio.checked = true;
      updateCustom();
      updateSummary();
      saveDraft();
      if (form.dataset.state === 'success') { success.hidden = true; setState('idle'); }
      const anchor = document.getElementById('price') || form;
      anchor.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
      const focusTarget = format === 'other' ? els.namedItem('format_custom') : radio;
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    });
  });

  window.addEventListener('pagehide', () => { if (saveTimer) saveDraft(); });

  /* ----- старт ----- */
  const draft = storage.read();
  if (draft && typeof draft === 'object') fill(draft);
  const hash = window.location.hash.slice(1);
  if (hash === 'price' || hash === 'partner') setType(hash);
  else if (!draft) setType('price');
  els.namedItem('page').value = window.location.pathname || '/';
  updateSummary();
}

const leadForm = document.querySelector('[data-lead-form]');
if (leadForm) initLeadForm(leadForm);
