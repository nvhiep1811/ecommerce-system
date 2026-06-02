import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { ScrollToTop } from "./components/common/ScrollToTop";
import AppLayout from "./layout/AppLayout";
import SignIn from "./pages/AuthPages/SignIn";
import Home from "./pages/Dashboard/Home";
import CatalogSettingsPage from "./pages/Admin/CatalogSettingsPage";
import CouponsPage from "./pages/Admin/CouponsPage";
import FlashSalesPage from "./pages/Admin/FlashSalesPage";
import OrdersPage from "./pages/Admin/OrdersPage";
import ProductsPage from "./pages/Admin/ProductsPage";
import UsersPage from "./pages/Admin/UsersPage";
import NotFound from "./pages/OtherPage/NotFound";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Home />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/flash-sales" element={<FlashSalesPage />} />
            <Route path="/catalog-settings" element={<CatalogSettingsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/profile" element={<Navigate to="/users" replace />} />
          </Route>
        </Route>

        <Route path="/signin" element={<SignIn />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
