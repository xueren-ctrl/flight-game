// Sky Courier — input: keyboard + mouse.
// The game is played with keyboard and mouse. Arrow keys / WASD fly the
// plane, Shift/Ctrl work the throttle, G/F work gear and flaps, M toggles
// mouse steering (the plane banks toward the cursor), P pauses.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let click = null;
  let throttle = 0;
  let mouseSteer = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) {
    onMouseMove(e);
    mouse.down = true;
    click = { x: mouse.x, y: mouse.y };
  }
  function onMouseUp() {
    mouse.down = false;
  }
  function onBlur() {
    keys.clear();
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    mouse,
    get mouseSteer() {
      return mouseSteer;
    },
    // One frame of stick input. Returns pitch/roll in -1..1, the throttle
    // setting, and any one-shot toggles pressed this frame.
    read(dt, W, H) {
      let pitch = 0;
      let roll = 0;
      if (keys.has('ArrowUp') || keys.has('KeyW')) pitch += 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) pitch -= 1;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
      if (mouseSteer) {
        const dx = (mouse.x - W / 2) / (W / 2);
        const dy = (mouse.y - H / 2) / (H / 2);
        roll = Math.max(-1, Math.min(1, dx * 1.4));
        pitch = Math.max(-1, Math.min(1, -dy * 1.2));
      }
      if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttle = Math.min(1, throttle + 0.7 * dt);
      if (keys.has('ControlLeft') || keys.has('ControlRight')) throttle = Math.max(0, throttle - 0.7 * dt);
      const toggles = [];
      for (const code of ['KeyG', 'KeyF', 'KeyM', 'KeyP', 'Escape']) {
        if (keys.has(code)) {
          keys.delete(code);
          toggles.push(code);
        }
      }
      if (toggles.includes('KeyM')) mouseSteer = !mouseSteer;
      return { pitch, roll, throttle, toggles };
    },
    setThrottle(v) {
      throttle = v;
    },
    consumeClick() {
      const c = click;
      click = null;
      return c;
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
