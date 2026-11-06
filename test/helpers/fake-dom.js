// A tiny stand-in for the parts of an <input> the component touches, so the
// binding layer can be tested with `node --test` and no browser or dependency.
//
// Event order mirrors the browser: `beforeinput` (cancelable, carries `data`),
// then the insertion (skipped when the event was prevented), then `input`.

export function createElement(options = {}) {
  const { type = 'text', tagName = 'INPUT', value: initial = '' } = options;
  const listeners = new Map();
  const attributes = new Map();
  let value = initial;

  const el = {
    tagName,
    type,
    textContent: '',
    showPickerCalls: 0,
    selectionStart: initial.length,
    selectionEnd: initial.length,

    get value() {
      return value;
    },
    set value(next) {
      value = next == null ? '' : String(next);
    },
    get id() {
      return attributes.get('id') ?? '';
    },

    addEventListener(eventType, listener) {
      if (!listeners.has(eventType)) listeners.set(eventType, []);
      listeners.get(eventType).push(listener);
    },
    removeEventListener(eventType, listener) {
      const list = listeners.get(eventType) ?? [];
      const index = list.indexOf(listener);
      if (index >= 0) list.splice(index, 1);
    },
    listenerCount(eventType) {
      return (listeners.get(eventType) ?? []).length;
    },

    setAttribute(name, val) {
      attributes.set(name, String(val));
    },
    getAttribute(name) {
      return attributes.has(name) ? attributes.get(name) : null;
    },
    hasAttribute(name) {
      return attributes.has(name);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },

    setSelectionRange(start, end = start) {
      el.selectionStart = start;
      el.selectionEnd = end;
    },
    focus() {},
    blur() {
      return dispatch('blur');
    },
    showPicker() {
      el.showPickerCalls += 1;
    },

    dispatch,

    // --- test helpers -----------------------------------------------------

    setValue(next) {
      el.value = next;
      el.selectionStart = el.selectionEnd = value.length;
      return el;
    },
    setCaretToEnd() {
      el.selectionStart = el.selectionEnd = value.length;
      return el;
    },
    type(text) {
      return insert(text, 'insertText');
    },
    paste(text) {
      return insert(text, 'insertFromPaste');
    },
    backspace() {
      return removeBackward();
    },
    key(name, init = {}) {
      return dispatch('keydown', { key: name, cancelable: true, ...init });
    },
    selectDate(iso) {
      el.setValue(iso);
      dispatch('input');
      dispatch('change');
      return el;
    },
  };

  function dispatch(eventType, detail = {}) {
    const event = {
      type: eventType,
      target: el,
      cancelable: false,
      defaultPrevented: false,
      preventDefault() {
        event.defaultPrevented = true;
      },
      stopPropagation() {},
      ...detail,
    };
    for (const listener of [...(listeners.get(eventType) ?? [])]) {
      listener.call(el, event);
    }
    return event;
  }

  function insert(text, inputType) {
    const event = dispatch('beforeinput', { inputType, data: text, cancelable: true });
    if (event.defaultPrevented) return event;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    el.value = value.slice(0, start) + text + value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    dispatch('input', { inputType, data: text });
    return event;
  }

  function removeBackward() {
    const event = dispatch('beforeinput', {
      inputType: 'deleteContentBackward',
      data: null,
      cancelable: true,
    });
    if (event.defaultPrevented) return event;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    if (start === end) {
      if (start === 0) return event;
      el.value = value.slice(0, start - 1) + value.slice(end);
      el.selectionStart = el.selectionEnd = start - 1;
    } else {
      el.value = value.slice(0, start) + value.slice(end);
      el.selectionStart = el.selectionEnd = start;
    }
    dispatch('input', { inputType: 'deleteContentBackward', data: null });
    return event;
  }

  return el;
}

/** A text field (the component's main input). */
export function createTextInput(value = '') {
  return createElement({ type: 'text', value });
}

/** A native `<input type="date">`. */
export function createDateInput(value = '') {
  return createElement({ type: 'date', value });
}

/** The polite live region showing the current reading. */
export function createFeedback() {
  return createElement({ tagName: 'DIV', type: null });
}
