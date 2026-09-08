// frontend/video-player.js
async function renderVideoPlayer(videoList) {
  if (!videoList || videoList.length === 0) {
    app.innerHTML = `<p>No videos selected.</p>`;
    return;
  }

  const port = await window.pywebview.api.get_video_port();
  let currentIndex = 0;
  let looping = true; // starts looping by default, per requirement

  function buildUrl(filePath) {
    return `http://127.0.0.1:${port}/video?path=${encodeURIComponent(filePath)}`;
  }

  function render() {
    app.innerHTML = `
      <h2>${videoList[currentIndex].name}</h2>
      <video id="player" controls autoplay style="width: 100%; max-height: 70vh; background: black;">
        <source src="${buildUrl(videoList[currentIndex].path)}" />
      </video>
      <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
        <button id="prevBtn" ${currentIndex === 0 && !looping ? 'disabled' : ''}>Previous</button>
        <button id="nextBtn">Next</button>
        <button id="loopBtn">${looping ? 'Stop Loop' : 'Start Loop'}</button>
        <span>${currentIndex + 1} of ${videoList.length}</span>
      </div>
    `;

    const player = document.getElementById('player');

    player.addEventListener('ended', () => {
      const isLast = currentIndex === videoList.length - 1;

      if (isLast && !looping) return; // stop — reached the end, looping off

      currentIndex = (currentIndex + 1) % videoList.length; // wraps to 0 when looping
      render();
    });

    document.getElementById('prevBtn').addEventListener('click', () => {
      currentIndex = looping
        ? (currentIndex - 1 + videoList.length) % videoList.length
        : Math.max(0, currentIndex - 1);
      render();
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
      currentIndex = looping
        ? (currentIndex + 1) % videoList.length
        : Math.min(videoList.length - 1, currentIndex + 1);
      render();
    });

    document.getElementById('loopBtn').addEventListener('click', () => {
      looping = !looping;
      render();
    });
  }

  render();
}