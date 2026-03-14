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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(() => {
    if (sessionStorage.getItem("sv_splash_shown")) return false;
    return true;
  });

  const handleSplashFinish = useCallback(() => {
    sessionStorage.setItem("sv_splash_shown", "1");
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
                <Route path="/" element={<Landing />} />
                <Route path="/setup" element={<ProfileSetup />} />
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
