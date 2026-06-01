import { useSidebar } from "../context/sidebarContextValue";

const Backdrop: React.FC = () => {
  const { isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } =
    useSidebar();

  if (!isMobileOpen && !isExpanded) return null;

  const handleClick = () => {
    if (isMobileOpen) {
      toggleMobileSidebar();
      return;
    }
    toggleSidebar();
  };

  return (
    <div className="fixed inset-0 z-40 bg-gray-900/40" onClick={handleClick} />
  );
};

export default Backdrop;
