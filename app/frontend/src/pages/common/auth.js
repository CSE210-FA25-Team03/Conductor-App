export async function ensureAuthenticated() {
  try {
    const res = await fetch("/auth/me", { credentials: "include" });

    if (res.status === 401) {
      window.location.href = "/login/";
      return null;
    }

    const data = await res.json();
    if (!data.authenticated || !data.user) {
      window.location.href = "/login/";
      return null;
    }

    const user = data.user;

    // Store what the rest of your code already expects
    localStorage.setItem("currentUser", JSON.stringify(user));
    localStorage.setItem("email", user.email || "");
    localStorage.setItem("role", user.role || "");
    localStorage.setItem("courseId", user.courseId || "");

    if (user.name) {
      localStorage.setItem("displayName", user.name);
    }

    // If you want to keep using firstName/lastName, you can try to split:
    if (user.name) {
      const parts = user.name.split(" ");
      localStorage.setItem("firstName", parts[0] || "");
      localStorage.setItem("lastName", parts.slice(1).join(" ") || "");
    }

    return user;
  } catch (err) {
    console.error("Auth check failed", err);
    window.location.href = "/login/";
    return null;
  }
}
