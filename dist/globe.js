export const DEFAULT_GLOBE_ROTATION = [-112, -23, 0];
export const GLOBE_ZOOM_LIMITS = [0.8, 4];
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const wrap = n => ((n + 180) % 360 + 360) % 360 - 180;

export function rotateGlobe(rotation, dx, dy, radius) {
  const degrees = 90 / Math.max(1, radius);
  return [wrap(rotation[0] + dx * degrees), clamp(rotation[1] - dy * degrees, -89, 89), 0];
}

export function scaleGlobe(zoom, factor) {
  return Number.isFinite(factor) && factor >= 0 ? clamp(zoom * factor, ...GLOBE_ZOOM_LIMITS) : zoom;
}

// An orthographic projection also projects the far hemisphere; explicitly hide
// those points so an invisible destination cannot be clicked through the globe.
export function onFrontHemisphere(coords, center) {
  const radians = Math.PI / 180;
  const [lng, lat] = coords.map(n => n * radians), [clng, clat] = center.map(n => n * radians);
  return Math.sin(lat) * Math.sin(clat) + Math.cos(lat) * Math.cos(clat) * Math.cos(lng - clng) > 0.015;
}

export function createTravelGlobe({ container, d3, features, markers, view, onSelect }) {
  const win = container.ownerDocument.defaultView;
  let width = 0, height = 0, radius = 1, frame, destroyed = false, gesture, moved = false, tap;
  const pointers = new Map(), listeners = [];
  container.replaceChildren();
  const svg = d3.select(container).append('svg').attr('class', 'globe-svg')
    .attr('role', 'group').attr('tabindex', 0).attr('aria-label', '可旋转世界足迹地球仪')
    .attr('aria-describedby', 'globe-help').attr('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown + - Home');
  const node = svg.node(), defs = svg.append('defs');
  const ocean = defs.append('radialGradient').attr('id', 'globe-ocean').attr('cx', '30%').attr('cy', '25%').attr('r', '80%');
  ocean.append('stop').attr('offset', '0%').attr('stop-color', '#f1f6ef');
  ocean.append('stop').attr('offset', '65%').attr('stop-color', '#e0ebe0');
  ocean.append('stop').attr('offset', '100%').attr('stop-color', '#b4cbbb');
  const shade = defs.append('radialGradient').attr('id', 'globe-shade').attr('cx', '34%').attr('cy', '28%').attr('r', '73%');
  shade.append('stop').attr('offset', '50%').attr('stop-color', '#294b39').attr('stop-opacity', 0);
  shade.append('stop').attr('offset', '100%').attr('stop-color', '#294b39').attr('stop-opacity', 0.25);
  const atmosphere = svg.append('circle').attr('class', 'globe-atmosphere');
  const sphere = svg.append('path').datum({ type: 'Sphere' }).attr('class', 'globe-ocean').attr('fill', 'url(#globe-ocean)');
  const surface = svg.append('g');
  const land = surface.selectAll('path').data(features).join('path')
    .attr('class', f => 'map-land' + (markers.some(m => d3.geoContains(f, m.coords)) ? ' visited' : ''));
  const graticule = surface.append('path').datum(d3.geoGraticule10()).attr('class', 'globe-graticule');
  const shading = svg.append('path').datum({ type: 'Sphere' }).attr('class', 'globe-shade').attr('fill', 'url(#globe-shade)');
  const markerLayer = svg.append('g').attr('class', 'globe-markers');
  const projection = d3.geoOrthographic().clipAngle(90).precision(0.5);
  const path = d3.geoPath(projection);
  const listen = (target, type, fn, options) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };

  function draw() {
    frame = undefined;
    if (destroyed) return;
    projection.translate([width / 2, height / 2]).scale(radius * view.zoom).rotate(view.rotation);
    svg.attr('data-rotation', view.rotation.join(',')).attr('data-zoom', view.zoom.toFixed(4));
    atmosphere.attr('cx', width / 2).attr('cy', height / 2).attr('r', radius * view.zoom + 4);
    sphere.attr('d', path); land.attr('d', path); graticule.attr('d', path); shading.attr('d', path);
    const center = projection.invert([width / 2, height / 2]);
    const visible = markers.filter(m => onFrontHemisphere(m.coords, center))
      .map(m => ({ ...m, pos: projection(m.coords) }))
      .filter(m => m.pos.every(Number.isFinite) && m.pos[0] > 8 && m.pos[0] < width - 8 && m.pos[1] > 8 && m.pos[1] < height - 8);
    const cells = visible.length ? d3.Delaunay.from(visible, m => m.pos[0], m => m.pos[1]).voronoi([0, 0, width, height]) : null;
    defs.selectAll('.globe-hit-cell').data(visible, m => m.id).join('clipPath').attr('class', 'globe-hit-cell')
      .attr('id', (_, i) => `globe-hit-${i}`).attr('clipPathUnits', 'userSpaceOnUse')
      .selectAll('path').data((m, i) => [i]).join('path').attr('d', i => cells.renderCell(i));
    const links = markerLayer.selectAll('a').data(visible, m => m.id).join(enter => {
      const link = enter.append('a').attr('class', 'globe-marker');
      link.append('circle').attr('class', 'map-hit').attr('r', 22);
      link.append('circle').attr('class', 'map-dot').attr('r', 5.5);
      link.append('path').attr('class', 'globe-leader');
      link.append('text').attr('class', 'map-point-text globe-label');
      link.append('title');
      return link;
    }).attr('href', m => `#trip/${encodeURIComponent(m.tripId)}`)
      .attr('data-globe-trip', m => m.tripId).attr('aria-label', m => `查看${m.label} · ${m.title}`);
    links.select('.map-hit').attr('cx', m => m.pos[0]).attr('cy', m => m.pos[1]).attr('clip-path', (_, i) => `url(#globe-hit-${i})`);
    links.select('.map-dot').attr('cx', m => m.pos[0]).attr('cy', m => m.pos[1]);
    links.select('title').text(m => `${m.label} · ${m.title}`);
    // Place short labels around dense East Asian points without covering a dot.
    const occupied = [];
    links.each(function (m) {
      const labelWidth = m.label.length * 11.5, right = m.pos[0] >= width / 2;
      const x = clamp(m.pos[0] + (right ? 13 : -13), right ? 8 : labelWidth + 8, right ? width - labelWidth - 8 : width - 8);
      let label;
      for (const offset of [-12, 20, -32, 40, -52, 60]) {
        const y = clamp(m.pos[1] + offset, 18, height - 10);
        const box = { left: right ? x : x - labelWidth, right: right ? x + labelWidth : x, top: y - 13, bottom: y + 3 };
        const collides = occupied.some(b => box.left < b.right + 4 && box.right > b.left - 4 && box.top < b.bottom + 3 && box.bottom > b.top - 3)
          || visible.some(p => box.left < p.pos[0] + 9 && box.right > p.pos[0] - 9 && box.top < p.pos[1] + 9 && box.bottom > p.pos[1] - 9);
        if (!collides) { label = { x, y, box }; occupied.push(box); break; }
      }
      const link = d3.select(this);
      link.select('text').text(label ? m.label : '').attr('x', x).attr('y', label?.y || 0).attr('text-anchor', right ? 'start' : 'end');
      link.select('.globe-leader').attr('d', label ? `M${m.pos}L${label.x + (right ? -3 : 3)},${label.y - 4}` : null);
    });
  }
  const schedule = () => { if (!destroyed && frame === undefined) frame = win.requestAnimationFrame(draw); };
  const point = event => { const box = node.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top]; };
  const distance = ([a, b]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const midpoint = ([a, b]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  function beginGesture() {
    const points = [...pointers.values()].slice(0, 2);
    gesture = points.length ? { count: points.length, origin: points.length === 2 ? midpoint(points) : points[0],
      distance: points.length === 2 ? Math.max(12, distance(points)) : 0, rotation: [...view.rotation], zoom: view.zoom } : null;
    node.classList.toggle('is-dragging', Boolean(gesture));
  }
  function cancelGesture() {
    for (const id of pointers.keys()) if (node.hasPointerCapture(id)) node.releasePointerCapture(id);
    pointers.clear(); gesture = null; tap = null; moved = true;
    node.classList.remove('is-dragging');
  }
  listen(node, 'pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!pointers.size) { moved = false; tap = event.target.closest('[data-globe-trip]')?.dataset.globeTrip; }
    pointers.set(event.pointerId, point(event));
    if (pointers.size > 1) { moved = true; tap = null; }
    try { node.setPointerCapture(event.pointerId); } catch { /* Synthetic events have no native pointer to capture. */ }
    beginGesture();
  });
  listen(node, 'pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture) return;
    pointers.set(event.pointerId, point(event));
    const points = [...pointers.values()].slice(0, 2), current = points.length === 2 ? midpoint(points) : points[0];
    const dx = current[0] - gesture.origin[0], dy = current[1] - gesture.origin[1];
    if (Math.hypot(dx, dy) > 5 || points.length > 1) moved = true;
    if (!moved) return;
    view.rotation = rotateGlobe(gesture.rotation, dx, dy, radius * gesture.zoom);
    if (points.length === 2) view.zoom = scaleGlobe(gesture.zoom, distance(points) / gesture.distance);
    event.preventDefault(); schedule();
  }, { passive: false });
  function endPointer(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const selected = !cancelled && pointers.size === 1 && !moved ? tap : null;
    pointers.delete(event.pointerId);
    if (node.hasPointerCapture(event.pointerId)) node.releasePointerCapture(event.pointerId);
    if (cancelled) { moved = true; tap = null; }
    beginGesture();
    if (selected) onSelect?.(selected);
  }
  listen(node, 'pointerup', event => endPointer(event));
  listen(node, 'pointercancel', event => endPointer(event, true));
  listen(node, 'lostpointercapture', event => endPointer(event, true));
  // Pointer taps are handled above because capture retargets a touch's click.
  // Keyboard activation keeps the normal, accessible SVG link behavior.
  listen(node, 'click', event => { if (event.detail > 0) { event.preventDefault(); event.stopPropagation(); } }, true);
  listen(node, 'dragstart', event => event.preventDefault());
  listen(win, 'blur', cancelGesture);
  const zoomBy = factor => { view.zoom = scaleGlobe(view.zoom, factor); schedule(); };
  const reset = () => { cancelGesture(); view.rotation = [...DEFAULT_GLOBE_ROTATION]; view.zoom = 1; schedule(); };
  listen(node, 'wheel', event => {
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    zoomBy(Math.exp(-clamp(delta, -600, 600) * 0.002));
  }, { passive: false });
  listen(node, 'keydown', event => {
    if (event.target !== node) return;
    const step = event.shiftKey ? 30 : 12;
    const directions = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (directions[event.key]) {
      const [x, y] = directions[event.key];
      view.rotation = [wrap(view.rotation[0] + x), clamp(view.rotation[1] + y, -89, 89), 0]; schedule();
    } else if (['+', '='].includes(event.key)) zoomBy(1.25);
    else if (['-', '_'].includes(event.key)) zoomBy(0.8);
    else if (event.key === 'Home') reset();
    else return;
    event.preventDefault();
  });

  return {
    container, zoomBy, reset,
    focus(coords) { cancelGesture(); view.rotation = [-coords[0], -coords[1], 0]; schedule(); },
    resize(nextWidth, nextHeight) {
      if (width === nextWidth && height === nextHeight) return;
      cancelGesture(); width = nextWidth; height = nextHeight; radius = Math.max(1, Math.min(width, height) / 2 - 24);
      svg.attr('viewBox', `0 0 ${width} ${height}`); draw();
    },
    destroy() {
      destroyed = true; cancelGesture(); listeners.forEach(remove => remove());
      if (frame !== undefined) win.cancelAnimationFrame(frame);
    },
  };
}
