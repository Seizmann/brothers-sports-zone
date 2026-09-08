import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { NavBar } from "../components/NavBar";
import { FooterDark } from "../components/FooterDark";
import { RequireAdmin, RequireUser } from "../components/guards";
import { AppLayout } from "../components/AppLayout";
import { ScrollToTop } from "../components/ScrollToTop";

import HomePage from "../pages/HomePage";
import GalleryPage from "../pages/GalleryPage";
import ContactPage from "../pages/ContactPage";
import TermsPage from "../pages/TermsPage";
import PrivacyPage from "../pages/PrivacyPage";

import BookingPage from "../modules/booking/pages/BookingPage";
import DashboardPage from "../modules/dashboard/pages/DashboardPage";
import BookingDetailPage from "../modules/dashboard/pages/BookingDetailPage";
import AuthFlowPage from "../modules/auth/pages/AuthFlowPage";

import AdminLoginPage from "../modules/management/auth/pages/AdminLoginPage";
import { ManagementLayout } from "../modules/management/ManagementLayout";
import ManagementDashboardPage from "../modules/management/dashboard/pages/ManagementDashboardPage";
import BookingsPage from "../modules/management/bookings/pages/BookingsPage";
import NewWalkInPage from "../modules/management/bookings/pages/NewWalkInPage";
import SlotsPage from "../modules/management/slots/pages/SlotsPage";
import BlackoutsPage from "../modules/management/blackouts/pages/BlackoutsPage";
import CouponsPage from "../modules/management/coupons/pages/CouponsPage";
import AdminsPage from "../modules/management/admins/pages/AdminsPage";
import UsersPage from "../modules/management/users/pages/UsersPage";
import AnalyticsPage from "../modules/management/analytics/pages/AnalyticsPage";
import SettingsPage from "../modules/management/settings/pages/SettingsPage";

function PublicLayout() {
  return (
    <div className="min-h-screen bg-canvas-night text-white">
      <NavBar />
      <Outlet />
      <FooterDark />
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-end p-6 sm:p-10 lg:p-16">
      <div>
        <p className="eyebrow mb-6 text-white/60">404</p>
        <h1 className="display-xl">Page not found</h1>
      </div>
    </main>
  );
}

/** The signup page merged into the unified flow; old links keep their intent. */
function SignupRedirect() {
  const location = useLocation();
  return <Navigate to="/auth/login" replace state={location.state} />;
}

/** Route tree without a router — reused by the SPA entry and the
 *  build-time prerender script (MemoryRouter / any router). */
export function AppTree() {
  return (
    <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Route>

        <Route path="/auth/login" element={<AuthFlowPage />} />
        <Route path="/auth/signup" element={<SignupRedirect />} />

        <Route element={<RequireUser />}>
          <Route element={<AppLayout />}>
            <Route path="/book" element={<BookingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/booking/:id" element={<BookingDetailPage />} />
          </Route>
        </Route>

        <Route path="/management/login" element={<AdminLoginPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<ManagementLayout />}>
            <Route path="/management" element={<ManagementDashboardPage />} />
            <Route path="/management/bookings" element={<BookingsPage />} />
            <Route path="/management/bookings/new" element={<NewWalkInPage />} />
            <Route path="/management/slots" element={<SlotsPage />} />
            <Route path="/management/blackouts" element={<BlackoutsPage />} />
            <Route path="/management/coupons" element={<CouponsPage />} />
            <Route path="/management/admins" element={<AdminsPage />} />
            <Route path="/management/users" element={<UsersPage />} />
            <Route path="/management/analytics" element={<AnalyticsPage />} />
            <Route path="/management/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
  );
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppTree />
    </BrowserRouter>
  );
}
