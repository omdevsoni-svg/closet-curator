import { useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import SplashScreen from "./components/SplashScreen";
import AppLayout from "./components/AppLayout";
import Landing from "./pages/Landing";
import ProfileSetup from "./pages/ProfileSetup";
import Home from "./pages/Home";
import DigitalCloset from "./pages/DigitalCloset";
import AiStylist from "./pages/AiStylist";
import ClosetHealth from "./pages/ClosetHealth";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import OutfitCalendar from "./pages/OutfitCalendar";
import ResetPassword from "./pages/ResetPassword";
import EmailVerification from "./pages/EmailVerification";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  // Show splash only on first-ever visit (persists across sessions via localStorage)
  const [showSplash, setShowSplash] = useState(() => {
    if (localStorage.getItem("styleos_splash_shown")) return false;
    return true;
  });

  const handleSplashFinish = useCallback(() => {
    localStorage.setItem("styleos_splash_shown", "1");
    setShowSplash(false);
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
            <BrowserRouter>
              <Routes>
                {/* Default route: login/signup for new users, auto-redirects to /home if already logged in */}
                <Route path="/" element={<ProfileSetup />} />
                <Route path="/setup" element={<ProfileSetup />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/verify-email" element={<EmailVerification />} />
                <Route
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/home" element={<Home />} />
                  <Route path="/closet" element={<DigitalCloset />} />
                  <Route path="/stylist" element={<AiStylist />} />
                  <Route path="/health" element={<ClosetHealth />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/calendar" element={<OutfitCalendar />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;