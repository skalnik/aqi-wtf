importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js");

let version = 1;

let item = (path) => {
  return { url: path, revision: version };
};

workbox.precaching.precacheAndRoute(
  [
    item("/index.html"),
    item("/privacy.html"),
    item("/style.css"),
    item("/app.js"),
    item("/site.webmanifest"),
    item("/android-chrome-192x192.png"),
    item("/android-chrome-512x512.png"),
    item("/apple-touch-icon.png"),
    item("/favicon-16x16.png"),
    item("/favicon-32x32.png"),
    item("https://plausible.io/js/plausible.js"),
  ],
  {
    ignoreURLParametersMatching: [/.*/]
  }
);
