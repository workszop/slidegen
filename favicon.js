// Browser-tab icon: the ink rocking-horse on light themes, a white version on
// dark themes, so the mark stays legible on either tab bar. Browsers without
// favicon media-query support fall back to the first (light) link.
(function () {
  if (!window.EDULAB_LOGO || document.querySelector('link[rel~="icon"]')) return;
  const add = (href, media) => {
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = href;
    if (media) favicon.media = media;
    document.head.appendChild(favicon);
  };
  add(window.EDULAB_LOGO, "(prefers-color-scheme: light)");
  if (window.EDULAB_LOGO_WHITE) add(window.EDULAB_LOGO_WHITE, "(prefers-color-scheme: dark)");
})();
