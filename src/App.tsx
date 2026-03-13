import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "./components/AppLayout";
import Landing from "./pages/Landing";
import ProfileSetup from "./pages/ProfileSetup";
import DigitalCloset from "./pages/DigitalCloset";
import AiStylist from "./pages/AiStylist";
import ClosetHealth from "./pages/ClosetHealth";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/setup" element={<ProfileSetup />} />
          <Route element={<AppLayout />}>
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
);

export default App;
