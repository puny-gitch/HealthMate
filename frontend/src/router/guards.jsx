import { Navigate, Outlet, useLocation } from "react-router-dom";
import { DotLoading } from "antd-mobile";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { useAppStore } from "../store/AppStore";
import { profileApi } from "../services/api";
import { AUTH_EXPIRED_EVENT } from "../services/http";
import { mapProfile } from "../utils/backendMappers";

export function AuthGuard() {
  const {
    state: { token, user },
    actions,
  } = useAppStore();
  const location = useLocation();

  useEffect(() => {
    const handleExpired = () => actions.logout();
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, [actions]);

  useEffect(() => {
    if (!token || user.userId) {
      return;
    }

    let active = true;
    profileApi
      .getProfile()
      .then((profile) => {
        if (active) {
          actions.updateUser(mapProfile(profile));
        }
      })
      .catch(() => {
        if (active) {
          actions.logout();
        }
      });

    return () => {
      active = false;
    };
  }, [actions, token, user.userId]);

  if (!token) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  if (token && !user.userId) {
    return (
      <motion.div
        className="app-loading-spinner"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <DotLoading color="primary" />
        <span>加载中...</span>
      </motion.div>
    );
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
