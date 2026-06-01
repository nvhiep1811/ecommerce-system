import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import { useAuth } from "../../hooks/useAuth";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";


type LocationState = {
  from?: {
    pathname?: string;
  };
};

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("admin@ecommerce.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRoleError, setIsRoleError] = useState(false); // thêm dòng này
  const { isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? "/";

  if (isAuthenticated && !isRoleError) { // thêm !isRoleError
    return <Navigate to={from} replace />;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setIsRoleError(false);

    try {
      const profile = await login(email, password);
      if (!["admin", "seller"].includes(profile.role)) {
        setIsRoleError(true); // set trước
        await logout();
        throw new Error(`Tài khoản role ${profile.role} không có quyền quản trị.`);
      }
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div>
          <div className="mb-6">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Admin Login
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Đăng nhập bằng tài khoản ADMIN để quản lý hệ thống
            </p>
          </div>

          {error ? (
            <div className="mb-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300">
              {error}
            </div>
          ) : null}

          <form onSubmit={submit}>
            <div className="space-y-5">
              <div>
                <Label>
                  Email <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@ecommerce.local"
                />
              </div>
              <div>
                <Label>
                  Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nhập mật khẩu"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 z-30 -translate-y-1/2"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" size="sm" disabled={loading}>
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
