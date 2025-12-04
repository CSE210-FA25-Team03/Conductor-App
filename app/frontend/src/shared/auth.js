// app/frontend/src/shared/auth.js
window.ConductorAuth = {
  logout: async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include", // send cookie-session cookie
      });
    } catch (err) {
      console.error("Logout error:", err);
    }

    // client-side cleanup
    localStorage.clear();
    sessionStorage.clear();

    // go back to login page
    window.location.href = "/login/";
  },
};
