import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../../hooks/useAuth";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";

export default function UserDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const closeDropdown = () => setIsOpen(false);

  const signOut = async () => {
    await logout();
    closeDropdown();
    navigate("/signin", { replace: true });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        <span className="mr-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt={user.fullName} /> : user?.fullName?.slice(0, 1) ?? "A"}
        </span>

        <span className="mr-1 hidden max-w-32 truncate font-medium text-theme-sm sm:block">
          {user?.fullName ?? "Admin"}
        </span>
        <svg
          className={`stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-lg border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="block truncate font-medium text-gray-700 text-theme-sm dark:text-gray-300">
            {user?.fullName ?? "Admin"}
          </span>
          <span className="mt-0.5 block truncate text-theme-xs text-gray-500 dark:text-gray-400">
            {user?.email}
          </span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-gray-200 py-3 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/users"
              className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 text-theme-sm hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Hồ sơ
            </DropdownItem>
          </li>
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/catalog-settings"
              className="flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 text-theme-sm hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Cấu hình
            </DropdownItem>
          </li>
        </ul>

        <Link
          to="/signin"
          onClick={(event) => {
            event.preventDefault();
            void signOut();
          }}
          className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 text-theme-sm hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          Đăng xuất
        </Link>
      </Dropdown>
    </div>
  );
}
