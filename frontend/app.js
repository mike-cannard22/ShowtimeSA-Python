let baseDirectory = null;

const menuBtn = document.getElementById('menuBtn');
const menuDropdown = document.getElementById('menuDropdown');
const app = document.getElementById('app');

menuBtn.addEventListener('click', () => {
  menuDropdown.classList.toggle('open');
});

document.getElementById('exitBtn').addEventListener('click', () => {
  window.pywebview.api.close_app();
});

menuDropdown.querySelectorAll('button[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    menuDropdown.classList.remove('open');
    showPage(btn.dataset.page);
  });
});

async function showPage(page) {
  if (page === 'settings') return renderSettings();
  if (page === 'gallery') return renderGalleryScatter('Gallery');
  if (page === 'products') return renderCarouselPage('Products');
  if (page === 'brochures') return renderListPage('Brochures');
  if (page === 'videos') return renderVideosTable('Videos');
  if (page === 'powerpoints') return renderListPage('Powerpoints');
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

  // Fetch each image as a base64 data URI (file:// paths get blocked by
  // WebView2's cross-origin restrictions, data URIs don't)
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
  `;

  new Swiper('.swiper', {
    pagination: { el: '.swiper-pagination' },
    loop: true,
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
  renderSettings();
});