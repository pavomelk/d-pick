// Demo entry point. Vite serves this file as a native ES module, so what runs in the
// browser is exactly what is in the repository.
//
// The demo UI (text input + native date picker + feedback area) is added together with the
// first failing tests; see requirements.md.

const demo = document.querySelector('#demo');

if (demo) {
  demo.dataset.ready = 'false';
}
