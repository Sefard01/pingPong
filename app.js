document.addEventListener("DOMContentLoaded", () => {

  const zipInput = document.getElementById("zipInput");
  const goBtn = document.getElementById("goBtn");
  const uploadSection = document.querySelector(".upload-section");
  const chatContainer = document.getElementById("chatContainer");
  const chatWrapper = document.querySelector(".chat-wrapper");
  const scrollBtn = document.getElementById("scrollToBottomBtn");
  const fileNameSpan = document.getElementById("fileName");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const leftUserEl = document.getElementById("leftUser");
  const rightUserEl = document.getElementById("rightUser");

  if (!zipInput || !goBtn || !chatContainer) return;

  /* ---------------- FILE NAME SHOW ---------------- */

  zipInput.addEventListener("change", () => {
    const file = zipInput.files[0];
    fileNameSpan.textContent = file ? file.name : "";
  });

  /* ---------------- LOAD BUTTON ---------------- */

  goBtn.addEventListener("click", async () => {

    const file = zipInput.files[0];
    if (!file) {
      alert("Please select a ZIP file first.");
      return;
    }

    showLoading(true);

    try {

      const zip = await JSZip.loadAsync(file);

      let chatText = "";
      const mediaMap = {};
      const tasks = [];

      Object.keys(zip.files).forEach(filename => {

        const entry = zip.files[filename];

        if (filename.toLowerCase().endsWith(".txt")) {
          tasks.push(
            entry.async("string").then(data => {
              chatText = data;
            })
          );
        }

        if (/\.(jpg|jpeg|png|gif|mp4|pdf|doc|docx)$/i.test(filename)) {
          tasks.push(
            entry.async("blob").then(blob => {
              const cleanName = filename.split("/").pop();
              mediaMap[cleanName] = URL.createObjectURL(blob);
            })
          );
        }

      });

      await Promise.all(tasks);

      if (!chatText) {
        chatContainer.innerHTML = "Chat text file not found.";
        showLoading(false);
        return;
      }

      uploadSection.classList.add("displayNone");
      chatWrapper.classList.remove("displayNone");

      renderChat(chatText, mediaMap);

    } catch (err) {
      console.error(err);
      chatContainer.innerHTML = "Error reading ZIP file.";
    }

    showLoading(false);
  });

  /* ---------------- LOADING ---------------- */

  function showLoading(state) {
    if (!loadingOverlay) return;
    loadingOverlay.classList.toggle("displayNone", !state);
  }

  /* ---------------- CHAT RENDER ---------------- */

  function renderChat(text, mediaMap) {

    chatContainer.innerHTML = "";
    chatWrapper.scrollTop = 0;

    text = text.replace(/\u202F/g, " ");
    const lines = text.split("\n");

    const regex =
      /^(\d{1,2}\/\d{1,2}\/\d{4}),\s(.+?)\s-\s(.*?):\s([\s\S]*)$/;

    let lastDate = null;
    const parsed = [];
    const userSet = new Set();

    /* -------- PARSE ALL MESSAGES -------- */

    for (const line of lines) {
      const match = line.match(regex);
      if (!match) continue;

      const [, date, time, senderRaw, message] = match;
      const sender = senderRaw.trim();

      userSet.add(sender);

      parsed.push({ date, time, sender, message });
    }

    /* -------- USER DETECTION -------- */

    const users = Array.from(userSet);

    let primaryUser = users[0] || "";
    let secondaryUser = users[1] || "";

    if (leftUserEl) leftUserEl.textContent = secondaryUser;
    if (rightUserEl) rightUserEl.textContent = primaryUser;

    /* -------- CHUNK SYSTEM -------- */

    const CHUNK_SIZE = 200;
    let index = 0;

    function renderChunk() {

      if (index >= parsed.length) return;

      const fragment = document.createDocumentFragment();
      const end = Math.min(index + CHUNK_SIZE, parsed.length);

      for (let i = index; i < end; i++) {

        const { date, time, sender, message } = parsed[i];

        if (date !== lastDate) {
          const dateDiv = document.createElement("div");
          dateDiv.className = "date-separator";
          dateDiv.textContent = date;
          fragment.appendChild(dateDiv);
          lastDate = date;
        }

        const side = sender === primaryUser ? "right" : "left";

        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${side}`;

        let mediaHandled = false;

        for (const filename in mediaMap) {

          if (message.includes(filename)) {

            mediaHandled = true;

            if (/\.(jpg|jpeg|png|gif)$/i.test(filename)) {
              const img = document.createElement("img");
              img.src = mediaMap[filename];
              img.classList.add("chat-media");
              img.onclick = () => openViewer(mediaMap[filename], "image");
              msgDiv.appendChild(img);
            }

            else if (/\.mp4$/i.test(filename)) {
              const video = document.createElement("video");
              video.src = mediaMap[filename];
              video.classList.add("chat-media");
              video.onclick = () => openViewer(mediaMap[filename], "video");
              msgDiv.appendChild(video);
            }

            else if (/\.pdf$/i.test(filename)) {
              const btn = document.createElement("button");
              btn.textContent = "View PDF";
              btn.onclick = () => openViewer(mediaMap[filename], "pdf");
              msgDiv.appendChild(btn);
            }

            break;
          }
        }

        if (!mediaHandled) {
          const textNode = document.createElement("div");
          textNode.innerHTML = message.replace(
            /(https?:\/\/[^\s]+)/g,
            url => `<a href="${url}" target="_blank">${url}</a>`
          );
          msgDiv.appendChild(textNode);
        }

        const timeDiv = document.createElement("div");
        timeDiv.className = "time";
        timeDiv.textContent = time;

        msgDiv.appendChild(timeDiv);
        fragment.appendChild(msgDiv);
      }

      chatContainer.appendChild(fragment);
      index = end;
    }

    renderChunk();

    /* -------- SCROLL LAZY LOAD -------- */

    chatWrapper.addEventListener("scroll", () => {
      if (chatWrapper.scrollTop + chatWrapper.clientHeight >= chatWrapper.scrollHeight - 100) {
        renderChunk();
      }
    });

    /* -------- SCROLL BUTTON -------- */

    if (scrollBtn) {
      scrollBtn.onclick = () => {
        chatWrapper.scrollTo({
          top: chatWrapper.scrollHeight,
          behavior: "smooth"
        });
      };
    }
  }

  /* ---------------- MEDIA VIEWER ---------------- */

  function openViewer(src, type) {

    let viewer = document.getElementById("mediaViewer");

    if (!viewer) {
      viewer = document.createElement("div");
      viewer.id = "mediaViewer";
      viewer.style.position = "fixed";
      viewer.style.inset = "0";
      viewer.style.background = "rgba(0,0,0,0.9)";
      viewer.style.display = "flex";
      viewer.style.alignItems = "center";
      viewer.style.justifyContent = "center";
      viewer.style.zIndex = "9999";
      viewer.onclick = () => viewer.remove();
      document.body.appendChild(viewer);
    }

    viewer.innerHTML = "";

    if (type === "image") {
      const img = document.createElement("img");
      img.src = src;
      img.style.maxWidth = "90%";
      img.style.maxHeight = "90%";
      viewer.appendChild(img);
    }

    else if (type === "video") {
      const video = document.createElement("video");
      video.src = src;
      video.controls = true;
      video.autoplay = true;
      video.style.maxWidth = "90%";
      video.style.maxHeight = "90%";
      viewer.appendChild(video);
    }

    else if (type === "pdf") {
      const iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.style.width = "80%";
      iframe.style.height = "90%";
      viewer.appendChild(iframe);
    }
  }

});
