import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  // Send the httpOnly session cookie cross-origin
  withCredentials: true,
});

// Pages where a 401 is expected — don't redirect, just reject
const UNAUTH_PATHS = ["/auth", "/onboarding"];

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      try {
        localStorage.removeItem("ss_user");
      } catch (e) {
        console.warn("Could not clear ss_user from localStorage", e);
      }
      const onUnauthPage = UNAUTH_PATHS.some((p) =>
        window.location.pathname.startsWith(p)
      );
      if (!onUnauthPage) {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(err);
  }
);

export default api;
