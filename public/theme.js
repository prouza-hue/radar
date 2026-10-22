(function () {
  var choice = null;
  try { choice = localStorage.getItem("radar-theme"); } catch (_) {}
  var dark = choice === "dark" || (choice !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  function syncChrome() {
    var color = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && color) meta.setAttribute("content", "hsl(" + color + ")");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncChrome, {once: true});
  else syncChrome();
})();
