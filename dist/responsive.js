// Follow Safari's visible area when its toolbar or on-screen keyboard changes.
// Keep page zoom available; zooming must not be mistaken for opening a keyboard.
export function installViewportLayout(win = window, doc = document) {
  const root = doc.documentElement, viewport = win.visualViewport;
  let frame;
  const update = () => {
    frame = undefined;
    const zoomed = viewport && Math.abs(viewport.scale - 1) > 0.05;
    const height = viewport && !zoomed ? viewport.height : win.innerHeight;
    const width = viewport && !zoomed ? viewport.width : win.innerWidth;
    root.style.setProperty('--visual-height', `${height}px`);
    root.style.setProperty('--visual-width', `${width}px`);
    root.style.setProperty('--visual-top', `${viewport && !zoomed ? viewport.offsetTop : 0}px`);
    root.style.setProperty('--visual-left', `${viewport && !zoomed ? viewport.offsetLeft : 0}px`);
    const active = doc.activeElement;
    const editing = active && (active.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]),textarea') || active.isContentEditable);
    root.dataset.keyboardOpen = String(Boolean(editing && !zoomed && win.innerHeight - height > 140));
  };
  const schedule = () => { if (frame === undefined) frame = win.requestAnimationFrame(update); };
  const listeners = [[win, 'resize'], [doc, 'focusin'], [doc, 'focusout'], ...(viewport ? [[viewport, 'resize'], [viewport, 'scroll']] : [])];
  listeners.forEach(([target, event]) => target.addEventListener(event, schedule));
  update();
  return () => {
    listeners.forEach(([target, event]) => target.removeEventListener(event, schedule));
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    ['--visual-height', '--visual-width', '--visual-top', '--visual-left'].forEach(name => root.style.removeProperty(name));
    delete root.dataset.keyboardOpen;
  };
}
