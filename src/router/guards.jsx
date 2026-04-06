import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAppStore } from "../store/AppStore";

export function AuthGuard() {
  const {
    state: { token, user },
  } = useAppStore();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  if (!user.hasProfile && location.pathname !== "/profile-setup") {
    return <Navigate to="/profile-setup" replace />;
  }

  return <Outlet />;
}

export function GuestGuard() {
  const {
    state: { token, user },
  } = useAppStore();

  if (token && user.hasProfile) {
    return <Navigate to="/dashboard" replace />;
  }

  if (token && !user.hasProfile) {
    return <Navigate to="/profile-setup" replace />;
  }

  return <Outlet />;
}
