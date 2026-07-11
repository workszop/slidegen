// Use the shared edulab rocking-horse mark as the browser-tab icon.
(function () {
  if (!window.EDULAB_LOGO || document.querySelector('link[rel~="icon"]')) return;
  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.href = window.EDULAB_LOGO;
  document.head.appendChild(favicon);
})();
