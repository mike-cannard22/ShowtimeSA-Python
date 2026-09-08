async function renderVideosTable(subfolder) {
  app.innerHTML = `<h2>${subfolder}</h2><p>Loading...</p>`;

  if (!baseDirectory) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No base directory set. Go to Settings first.</p>`;
    return;
  }

  const folderPath = `${baseDirectory}\\${subfolder}`;
  let files = await window.pywebview.api.list_files(folderPath);

  if (files.length === 0) {
    app.innerHTML = `<h2>${subfolder}</h2><p>No videos found.</p>`;
    return;
  }

  const selected = new Set();

  function renderTable() {
    const rows = files.map((f, index) => `
      <tr data-index="${index}" data-name="${f.name}">
        <td class="drag-handle" title="Drag to reorder">☰</td>
        <td><input type="checkbox" class="row-check" data-name="${f.name}" ${selected.has(f.name) ? 'checked' : ''}></td>
        <td>${f.name}</td>
      </tr>
    `).join('');

    app.innerHTML = `
      <h2>${subfolder}</h2>
      <table class="videoTable">
        <thead>
          <tr><th></th><th></th><th>File Name</th></tr>
        </thead>
        <tbody id="videoTableBody">${rows}</tbody>
      </table>
      <button id="viewSelectedBtn" class="auto-button" style="position: static; width: auto; margin-top: 16px;">
        View Video(s)
      </button>
    `;

    document.querySelectorAll('.row-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const name = e.target.dataset.name;
        if (e.target.checked) selected.add(name);
        else selected.delete(name);
      });
    });

    document.getElementById('viewSelectedBtn').addEventListener('click', () => {
    const chosen = files.filter(f => selected.has(f.name));
    if (chosen.length === 0) {
        alert('Select at least one video first');
        return;
    }
    renderVideoPlayer(chosen);
    });

    setupDragReorder();
  }

  function setupDragReorder() {
    const tbody = document.getElementById('videoTableBody');
    let draggingIndex = null;

    tbody.querySelectorAll('tr').forEach(row => {
      row.querySelector('.drag-handle').addEventListener('mousedown', (e) => {
        e.preventDefault();
        draggingIndex = parseInt(row.dataset.index, 10);
        row.classList.add('dragging-row');
      });
    });

    function getRowCenters() {
      return Array.from(tbody.querySelectorAll('tr')).map((row) => {
        const rect = row.getBoundingClientRect();
        return {
          index: parseInt(row.dataset.index, 10),
          top: rect.top,
          bottom: rect.bottom,
        };
      });
    }

    function onMouseMove(e) {
      if (draggingIndex === null) return;

      const rows = getRowCenters();
      const target = rows.find(r => e.clientY >= r.top && e.clientY <= r.bottom);
      if (!target || target.index === draggingIndex) return;

      const [moved] = files.splice(draggingIndex, 1);
      files.splice(target.index, 0, moved);
      draggingIndex = target.index;

      renderTable();
      // Re-arm dragging state on the row now at the new index, since
      // renderTable() rebuilt the DOM from scratch
      const newRow = tbody.querySelector(`tr[data-index="${draggingIndex}"]`);
      if (newRow) newRow.classList.add('dragging-row');
    }

    function onMouseUp() {
      draggingIndex = null;
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('dragging-row'));
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  renderTable();
}