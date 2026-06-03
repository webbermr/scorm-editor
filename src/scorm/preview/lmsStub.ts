// A no-op SCORM API adapter. Imported course players (e.g. Lectora) walk up the
// window chain looking for window.API (SCORM 1.2) / window.API_1484_11 (2004) and
// alert "Unable to find an API adapter" if absent. We provide a stub so the player
// initializes cleanly and tracking calls quietly succeed (we don't persist them).
//
// NOTE: keep this a self-contained function with no external references — it is
// also serialized via .toString() into the standalone wrapper page below.
export function installLmsStub(win: unknown): void {
  const w = win as Record<string, unknown>;
  if (w.API && w.API_1484_11) return;
  const store: Record<string, string> = {};
  const ok = function () {
    return 'true';
  };
  const err0 = function () {
    return '0';
  };
  const noErr = function () {
    return 'No error';
  };
  const empty = function () {
    return '';
  };
  const set = function (k: string, v: string) {
    store[k] = v;
    return 'true';
  };
  const getter = function (defs: Record<string, string>) {
    return function (k: string) {
      return k in store ? store[k] : k in defs ? defs[k] : '';
    };
  };
  const defs12: Record<string, string> = {
    'cmi.core.lesson_status': 'incomplete',
    'cmi.core.entry': 'ab-initio',
    'cmi.core.lesson_mode': 'normal',
    'cmi.core.credit': 'credit',
    'cmi.core.student_name': '',
    'cmi.core.score.raw': '',
    'cmi.core.lesson_location': '',
    'cmi.suspend_data': '',
    'cmi.launch_data': '',
  };
  const defs2004: Record<string, string> = {
    'cmi.completion_status': 'incomplete',
    'cmi.entry': 'ab-initio',
    'cmi.mode': 'normal',
    'cmi.credit': 'credit',
    'cmi.success_status': 'unknown',
    'cmi.suspend_data': '',
    'cmi.location': '',
    'cmi.learner_name': '',
  };
  if (!w.API) {
    w.API = {
      LMSInitialize: ok,
      LMSFinish: ok,
      LMSGetValue: getter(defs12),
      LMSSetValue: set,
      LMSCommit: ok,
      LMSGetLastError: err0,
      LMSGetErrorString: noErr,
      LMSGetDiagnostic: empty,
    };
  }
  if (!w.API_1484_11) {
    w.API_1484_11 = {
      Initialize: ok,
      Terminate: ok,
      GetValue: getter(defs2004),
      SetValue: set,
      Commit: ok,
      GetLastError: err0,
      GetErrorString: noErr,
      GetDiagnostic: empty,
    };
  }
}

/** Standalone wrapper page that hosts a stub API and frames the course — used for
 *  "Open in new tab", where there is no parent LMS window to provide the API. */
export function buildLmsWrapper(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Course preview</title>
  <style>html,body{margin:0;height:100%;background:#fff}iframe{border:0;width:100%;height:100%;display:block}</style>
  <script>(${installLmsStub.toString()})(window);</script>
</head>
<body>
  <iframe id="cw-course" allow="autoplay; fullscreen; encrypted-media"></iframe>
  <script>
    var f = document.getElementById('cw-course');
    // This is a read-only preview — silence the player's own LMS/persistence alerts.
    f.addEventListener('load', function () {
      try { f.contentWindow.alert = function () {}; f.contentWindow.print = function () {}; } catch (e) {}
    });
    var page = new URLSearchParams(location.search).get('page');
    if (page) f.src = page;
  </script>
</body>
</html>`;
}
