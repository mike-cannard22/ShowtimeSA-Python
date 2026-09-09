let baseDirectory = null;

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const menuWrap = document.getElementById('menuWrap');
const app = document.getElementById('app');
const navbarLogo = document.querySelector('.navbar-logo');

// ⭐ NEW — swaps the plain "ShowtimeSA" text for the downloaded
// Whitelabel logo, if one exists under the current base directory
async function loadLogo() {
  if (!baseDirectory) {
    navbarLogo.innerHTML = 'ShowtimeSA';
    return;
  }

  try {
    const logoFolder = `${baseDirectory}\\Whitelabel`;
    const files = await window.pywebview.api.list_files(logoFolder);

    if (!files || files.length === 0) {
      navbarLogo.innerHTML = 'ShowtimeSA';
      return;
    }

    // There should only ever be one file here (logo.<ext>) — use whichever
    // is found first rather than assuming an exact filename/extension
    const logoData = await window.pywebview.api.get_image_data(files[0].path);

    if (logoData) {
      navbarLogo.innerHTML = `<img src="${logoData}" alt="Logo" />`;
    } else {
      navbarLogo.innerHTML = 'ShowtimeSA';
    }
  } catch (err) {
    console.error('loadLogo failed:', err);
    navbarLogo.innerHTML = 'ShowtimeSA';
  }
}

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  menuDropdown.classList.toggle('open');
});

// ⭐ Click-away-to-close, mirroring Navbar.js's menuRef + click-outside effect
document.addEventListener('click', (e) => {
  if (!menuWrap.contains(e.target)) {
    menuDropdown.classList.remove('open');
  }
});

document.getElementById('exitBtn').addEventListener('click', () => {
  window.pywebview.api.close_app();
});

menuDropdown.querySelectorAll('.navbar-dropdown-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {
    menuDropdown.classList.remove('open');
    showPage(item.dataset.page);
  });
});

async function showPage(page) {
  if (page === 'settings') return renderSettings();
  if (page === 'gallery') return renderGalleryScatter('Gallery');
  if (page === 'products') return renderCarouselPage('Products');
  if (page === 'brochures') return renderBrochuresPage('Brochures');
  if (page === 'videos') return renderVideosTable('Videos');
  if (page === 'powerpoints') return renderPowerpointsPage('Powerpoints');
}

async function renderSettings() {
  const current = baseDirectory || 'Not set';
  app.innerHTML = `
    <h2>Settings</h2>
    <p>Current base directory: <strong id="currentDir">${current}</strong></p>
    <button id="chooseBtn">Choose Folder</button>
    <button id="saveBtn">Save</button>
  `;

  document.getElementById('chooseBtn').addEventListener('click', async () => {
    const folder = await window.pywebview.api.pick_folder();
    if (folder) {
      baseDirectory = folder;
      document.getElementById('currentDir').innerText = folder;
    }
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    if (!baseDirectory) {
      alert('Choose a folder first');
      return;
    }
    try {
      await window.pywebview.api.save_config(baseDirectory);
      await loadLogo();
      alert('Saved: ' + baseDirectory);
    } catch (err) {
      alert('Save failed: ' + err);
      console.error(err);
    }
  });
}

async function renderListPage(subfolder) {
  app.innerHTML = `<h2>${subfolder}</h2><p>Loading...</p>`;

  if (!baseDirectory) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No base directory set. Go to Settings first.</p>`;
    return;
  }

  const folderPath = `${baseDirectory}\\${subfolder}`;
  const files = await window.pywebview.api.list_files(folderPath);

  if (files.length === 0) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No files found.</p>`;
    return;
  }

  const items = files.map(f => `<li>${f.name}</li>`).join('');
  app.innerHTML = `<h2>${subfolder}</h2><ul class="fileList">${items}</ul>`;
}

// ⭐ NEW — Powerpoints: list of .pptx files, click one to open it in the
// machine's installed PowerPoint app (offline-safe — no in-app rendering
// is possible for this format, so this hands off to the real app instead)
async function renderPowerpointsPage(subfolder) {
  app.innerHTML = `<h2>${subfolder}</h2><p>Loading...</p>`;

  if (!baseDirectory) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No base directory set. Go to Settings first.</p>`;
    return;
  }

  const folderPath = `${baseDirectory}\\${subfolder}`;
  const files = await window.pywebview.api.list_files(folderPath);

  if (files.length === 0) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No files found.</p>`;
    return;
  }

  const items = files
    .map((f, i) => `<li class="pptItem" data-index="${i}" style="cursor: pointer;">${f.name}</li>`)
    .join('');

  app.innerHTML = `<h2>${subfolder}</h2><ul class="fileList">${items}</ul>`;

  document.querySelectorAll('.pptItem').forEach(li => {
    li.addEventListener('click', async () => {
      const index = parseInt(li.dataset.index, 10);
      const success = await window.pywebview.api.open_powerpoint(files[index].path);
      if (!success) {
        alert('Could not open this file. Is PowerPoint (or a compatible viewer) installed?');
      }
    });
  });
}

// ⭐ NEW — Brochures: list of PDFs, click one to view it embedded in the
// container via the local server (avoids the same file:// cross-origin
// block that affected images/video)
async function renderBrochuresPage(subfolder) {
  app.innerHTML = `<h2>${subfolder}</h2><p>Loading...</p>`;

  if (!baseDirectory) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No base directory set. Go to Settings first.</p>`;
    return;
  }

  const folderPath = `${baseDirectory}\\${subfolder}`;
  const files = await window.pywebview.api.list_files(folderPath);

  if (files.length === 0) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No files found.</p>`;
    return;
  }

  const port = await window.pywebview.api.get_video_port();

  function showList() {
    const items = files
      .map((f, i) => `<li class="brochureItem" data-index="${i}" style="cursor: pointer;">${f.name}</li>`)
      .join('');

    app.innerHTML = `<h2>${subfolder}</h2><ul class="fileList">${items}</ul>`;

    document.querySelectorAll('.brochureItem').forEach(li => {
      li.addEventListener('click', () => showPdf(parseInt(li.dataset.index, 10)));
    });
  }

  function showPdf(index) {
    const file = files[index];
    const url = `http://127.0.0.1:${port}/video?path=${encodeURIComponent(file.path)}`;

    app.innerHTML = `
      <div style="display: flex; flex-direction: column; height: calc(100vh - var(--navbar-height, 64px) - 40px);">
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <button id="backToListBtn">&larr; Back</button>
          <h2 style="margin: 0;">${file.name}</h2>
        </div>
        <iframe src="${url}" style="flex: 1; width: 100%; border: none; background: white;"></iframe>
      </div>
    `;

    document.getElementById('backToListBtn').addEventListener('click', showList);
  }

  showList();
}

async function renderCarouselPage(subfolder) {
  app.innerHTML = `<h2>${subfolder}</h2><p>Loading...</p>`;

  if (!baseDirectory) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No base directory set. Go to Settings first.</p>`;
    return;
  }

  const folderPath = `${baseDirectory}\\${subfolder}`;
  const files = await window.pywebview.api.list_files(folderPath);

  if (files.length === 0) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No images found.</p>`;
    return;
  }

  const imageDataList = await Promise.all(
    files.map(f => window.pywebview.api.get_image_data(f.path))
  );

  const slides = imageDataList
    .filter(data => data)
    .map(data => `<div class="swiper-slide"><img src="${data}" /></div>`)
    .join('');

  app.innerHTML = `
    <h2>${subfolder}</h2>
    <div class="swiper">
      <div class="swiper-wrapper">${slides}</div>
      <div class="swiper-pagination"></div>
    </div>
    <button id="carouselAutoBtn" class="auto-button">Auto</button>
  `;

  const swiper = new Swiper('.swiper', {
    pagination: { el: '.swiper-pagination' },
    loop: true,
    autoplay: false, // starts off — user opts in via the Auto button
  });

  let autoOn = false;
  const autoBtn = document.getElementById('carouselAutoBtn');

  autoBtn.addEventListener('click', () => {
    autoOn = !autoOn;
    autoBtn.innerText = autoOn ? 'Stop' : 'Auto';

    if (autoOn) {
      swiper.params.autoplay = { delay: 3000, disableOnInteraction: false };
      swiper.autoplay.start();
    } else {
      swiper.autoplay.stop();
    }
  });
}

window.addEventListener('pywebviewready', async () => {
  try {
    console.log('pywebview ready, loading config...');
    baseDirectory = await window.pywebview.api.load_config();
    console.log('loaded baseDirectory:', baseDirectory);
  } catch (err) {
    console.error('load_config failed:', err);
  }
  await loadLogo();

  if (baseDirectory) {
    renderGalleryScatter('Gallery');
  } else {
    renderSettings();
  }
});