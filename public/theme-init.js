// Apply saved theme preference before React loads to prevent flash.
// Standard convention: .dark class = dark mode. Default is dark.
try {
  var pref = localStorage.getItem("user-theme-preference");
  if (pref !== "light") {
    document.documentElement.classList.add("dark");
  }
} catch (e) {}
