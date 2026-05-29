import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../hooks/useAuth";

const allowedRoles = new Set(["admin", "seller"]);

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-sm text-gray-500 dark:bg-gray-950 dark:text-gray-400">
        Loading admin session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location }} />;
  }

  if (user && !allowedRoles.has(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-950">
        <div className="max-w-md rounded-lg border border-gray-200 bg-white p-6 text-center shadow-theme-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            Tài khoản này chưa có quyền vào trang quản trị.
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Role hiện tại: {user.role}
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
