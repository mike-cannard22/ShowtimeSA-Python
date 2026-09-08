// gallery-scatter.js — plain-JS port of useScatterLayout.js + useDragController.js

function computeScatterPositions(count, containerW, containerH) {
  const maxImgSize = 220;
  const minImgSize = 70;
  const imgSize = Math.max(
    minImgSize,
    Math.min(maxImgSize, Math.min(containerW, containerH) / 3)
  );

  const imgW = imgSize;
  const imgH = imgSize;

  const maxAngle = 20 * (Math.PI / 180);
  const rotatedW = Math.abs(imgW * Math.cos(maxAngle)) + Math.abs(imgH * Math.sin(maxAngle));
  const rotatedH = Math.abs(imgH * Math.cos(maxAngle)) + Math.abs(imgW * Math.sin(maxAngle));

  const radius = Math.max(rotatedW, rotatedH) + 40;
  const centerX = containerW / 2;
  const centerY = containerH / 2;
  const maxX = Math.max(0, containerW - rotatedW);
  const maxY = Math.max(0, containerH - rotatedH);

  const samples = [];
  const active = [];

  const start = { x: centerX, y: centerY };
  samples.push(start);
  active.push(start);

  function generatePointAround(p) {
    const r1 = Math.random();
    const r2 = Math.random();
    const radiusMin = radius;
    const radiusMax = radius * 2;
    const rad = radiusMin + (radiusMax - radiusMin) * r1;
    const angle = 2 * Math.PI * r2;
    return { x: p.x + rad * Math.cos(angle), y: p.y + rad * Math.sin(angle) };
  }

  function clamp(pt) {
    return {
      x: Math.min(Math.max(pt.x, 0), maxX),
      y: Math.min(Math.max(pt.y, 0), maxY),
    };
  }

  function isValid(pt) {
    if (pt.x < 0 || pt.x > maxX || pt.y < 0 || pt.y > maxY) return false;
    for (const s of samples) {
      const dx = pt.x - s.x;
      const dy = pt.y - s.y;
      if (dx * dx + dy * dy < radius * radius) return false;
    }
    return true;
  }

  while (samples.length < count && active.length > 0) {
    const idx = Math.floor(Math.random() * active.length);
    const p = active[idx];
    let found = false;

    for (let i = 0; i < 30; i++) {
      let newPt = generatePointAround(p);
      newPt = clamp(newPt);
      if (isValid(newPt)) {
        samples.push(newPt);
        active.push(newPt);
        found = true;
        break;
      }
    }

    if (!found) {
      const fallbackRangeX = Math.min(150, maxX / 2 || 1);
      const fallbackRangeY = Math.min(150, maxY / 2 || 1);
      const fallback = clamp({
        x: centerX + (Math.random() - 0.5) * fallbackRangeX * 2,
        y: centerY + (Math.random() - 0.5) * fallbackRangeY * 2,
      });
      samples.push(fallback);
      active.splice(idx, 1);
      if (active.length === 0 && samples.length < count) active.push(fallback);
    }
  }

  while (samples.length < count) {
    samples.push(
      clamp({
        x: centerX + (Math.random() - 0.5) * Math.min(100, maxX || 1),
        y: centerY + (Math.random() - 0.5) * Math.min(100, maxY || 1),
      })
    );
  }

  const gravityStrength = 0.25;
  const positions = samples.slice(0, count).map((pt) => ({
    x: pt.x + (centerX - pt.x) * gravityStrength,
    y: pt.y + (centerY - pt.y) * gravityStrength,
    angle: (Math.random() - 0.5) * 40,
  }));

  return { positions, imgW, imgH };
}

async function renderGalleryScatter(subfolder) {
  app.innerHTML = `<div class="viewing-page"><p class="loading-message">Loading, Please Wait...</p></div>`;

  if (!baseDirectory) {
    app.innerHTML = `<div class="viewing-page"><p class="loading-message">No base directory set. Go to Settings first.</p></div>`;
    return;
  }

  const folderPath = `${baseDirectory}\\${subfolder}`;
  const files = await window.pywebview.api.list_files(folderPath);

  if (files.length === 0) {
    app.innerHTML = `<div class="viewing-page"><p class="loading-message">No images found.</p></div>`;
    return;
  }

  const imageDataList = await Promise.all(
    files.map((f) => window.pywebview.api.get_image_data(f.path))
  );

  app.innerHTML = `
    <div class="viewing-page">
      <div class="scatter-container" id="scatterContainer"></div>
      <button id="scatterAutoBtn" class="auto-button">Auto</button>
    </div>
  `;

  const container = document.getElementById('scatterContainer');

  // Wait a frame so the browser has actually applied layout (height: 70vh
  // etc.) before measuring — measuring synchronously right after setting
  // innerHTML can read a collapsed/near-zero size.
  requestAnimationFrame(() => {
    const rect = container.getBoundingClientRect();
    const { positions, imgW, imgH } = computeScatterPositions(files.length, rect.width, rect.height);
    setupScatterImages(container, imageDataList, positions, imgW, imgH);
  });
}

function setupScatterImages(container, imageDataList, positions, imgW, imgH) {
  const dragPositions = positions.map((p) => ({ ...p }));
  const imgEls = [];

  imageDataList.forEach((data, index) => {
    if (!data) return;
    const img = document.createElement('img');
    img.id = `img-${index}`;
    img.src = data;
    img.className = 'scatter-image';
    img.style.width = `${imgW}px`;
    img.style.zIndex = index + 1;
    img.style.opacity = '0';
    img.style.transform = 'translate(0px, 0px) rotate(0deg)';
    container.appendChild(img);
    imgEls[index] = img;
  });

  requestAnimationFrame(() => {
    imgEls.forEach((img, index) => {
      if (!img) return;
      const pos = dragPositions[index];
      img.style.opacity = '1';
      img.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.angle}deg)`;
    });
  });

  // ---------- Expand / collapse ----------
  let expandedIndex = null;
  let backdropEl = null;

  function applyScatterTransform(index) {
    const img = imgEls[index];
    const pos = dragPositions[index];
    if (!img || !pos) return;
    img.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.angle}deg)`;
  }

  function expand(index) {
    if (expandedIndex !== null && expandedIndex !== index) {
      const prevImg = imgEls[expandedIndex];
      if (prevImg) {
        prevImg.classList.remove('expanded');
        prevImg.style.zIndex = expandedIndex + 1; // restore original stacking
        applyScatterTransform(expandedIndex);
      }
    }

    expandedIndex = index;
    const img = imgEls[index];
    if (img) {
      img.classList.add('expanded');
      img.style.zIndex = 6000; // must be set here — the CSS class's
                                // z-index gets beaten by this same
                                // element's own inline z-index otherwise
      img.style.transform = '';
    }

    if (!backdropEl) {
      backdropEl = document.createElement('div');
      backdropEl.className = 'backdrop';
      backdropEl.addEventListener('click', () => collapse());
      document.body.appendChild(backdropEl);
    }
  }

  function collapse() {
    if (expandedIndex !== null) {
      const img = imgEls[expandedIndex];
      if (img) {
        img.classList.remove('expanded');
        img.style.zIndex = expandedIndex + 1; // restore original stacking
        applyScatterTransform(expandedIndex);
      }
    }
    expandedIndex = null;
    if (backdropEl) {
      backdropEl.remove();
      backdropEl = null;
    }
  }

  // ---------- Drag (mouse + touch), ported from useDragController.js ----------
  let draggingIndex = null;
  let dragOffset = { x: 0, y: 0 };
  let dragStarted = false;
  let touchStartPos = { x: 0, y: 0 };
  let containerBounds = null;
  let rafId = null;
  let pendingUpdate = null;

  function updateImagePosition(index, x, y) {
    const img = imgEls[index];
    if (!img) return;
    const angle = dragPositions[index].angle || 0;
    img.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;
  }

  function flushUpdate() {
    rafId = null;
    if (!pendingUpdate) return;
    const { index, x, y } = pendingUpdate;
    const pos = dragPositions[index];
    if (!pos) return;
    pos.x = x;
    pos.y = y;
    updateImagePosition(index, x, y);
    pendingUpdate = null;
  }

  function scheduleUpdate(index, x, y) {
    pendingUpdate = { index, x, y };
    if (rafId === null) rafId = requestAnimationFrame(flushUpdate);
  }

  function onMouseDown(e, index) {
    e.preventDefault();
    draggingIndex = index;
    dragStarted = false;

    const rect = e.target.getBoundingClientRect();
    dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    containerBounds = container.getBoundingClientRect();

    const img = imgEls[index];
    if (img) img.style.transition = 'none';
  }

  function onMouseMove(e) {
    if (draggingIndex === null || e.buttons !== 1) return;
    dragStarted = true;
    if (expandedIndex !== null) collapse();

    const bounds = containerBounds;
    if (!bounds) return;

    const newX = e.clientX - bounds.left - dragOffset.x;
    const newY = e.clientY - bounds.top - dragOffset.y;
    scheduleUpdate(draggingIndex, newX, newY);
  }

  function onMouseUp() {
    if (draggingIndex !== null) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        flushUpdate();
      }
      const img = imgEls[draggingIndex];
      if (img) img.style.transition = '';
    }
    draggingIndex = null;
    containerBounds = null;
  }

  function onTouchStart(e) {
    const touch = e.touches[0];
    const target = e.target;
    const id = target.id;
    if (!id || !id.startsWith('img-')) return;

    const index = parseInt(id.replace('img-', ''), 10);
    draggingIndex = index;
    dragStarted = false;

    const rect = target.getBoundingClientRect();
    dragOffset = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    touchStartPos = { x: touch.clientX, y: touch.clientY };
    containerBounds = container.getBoundingClientRect();

    const img = imgEls[index];
    if (img) img.style.transition = 'none';
  }

  function onTouchMove(e) {
    if (draggingIndex === null) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.x);
    const dy = Math.abs(touch.clientY - touchStartPos.y);
    if (dx > 5 || dy > 5) e.preventDefault();

    dragStarted = true;
    if (expandedIndex !== null) collapse();

    const bounds = containerBounds;
    if (!bounds) return;

    const newX = touch.clientX - bounds.left - dragOffset.x;
    const newY = touch.clientY - bounds.top - dragOffset.y;
    scheduleUpdate(draggingIndex, newX, newY);
  }

  function onTouchEnd() {
    if (draggingIndex !== null) {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        flushUpdate();
      }
      const img = imgEls[draggingIndex];
      if (img) img.style.transition = '';
    }
    draggingIndex = null;
    containerBounds = null;
  }

  imgEls.forEach((img, index) => {
    if (!img) return;
    img.addEventListener('mousedown', (e) => onMouseDown(e, index));
    img.addEventListener('click', () => {
      if (dragStarted) return;
      if (expandedIndex === index) collapse();
      else expand(index);
    });
  });

  container.addEventListener('mousemove', onMouseMove);
  container.addEventListener('mouseup', onMouseUp);
  container.addEventListener('mouseleave', onMouseUp);
  container.addEventListener('touchstart', onTouchStart, { passive: false });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: false });

  // ---------- Auto-cycle (matches useGalleryData's cycle() timing exactly) ----------
  let autoMode = false;
  let autoIndex = 0;
  let autoTimer = null;

  function startAutoCycle() {
    const cycle = () => {
      if (!autoMode) return;
      const idx = autoIndex % imgEls.length;
      expand(idx);
      autoTimer = setTimeout(() => {
        collapse();
        autoIndex = (idx + 1) % imgEls.length;
        autoTimer = setTimeout(cycle, 600);
      }, 3000);
    };
    cycle();
  }

  function stopAutoCycle() {
    if (autoTimer) clearTimeout(autoTimer);
  }

  document.getElementById('scatterAutoBtn').addEventListener('click', (e) => {
    autoMode = !autoMode;
    e.target.innerText = autoMode ? 'Stop' : 'Auto';
    autoIndex = 0;
    if (autoMode) startAutoCycle();
    else {
      stopAutoCycle();
      collapse();
    }
  });
}