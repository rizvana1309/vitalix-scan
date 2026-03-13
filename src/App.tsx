import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UserProvider, useUser } from "./contexts/UserContext";

// Pages
import Welcome from "./pages/Welcome";
import BasicDetails from "./pages/onboarding/BasicDetails";
import GoalSelection from "./pages/onboarding/GoalSelection";
import ActivityLevel from "./pages/onboarding/ActivityLevel";
import Home from "./pages/Home";
import FoodScanner from "./pages/FoodScanner";
import HeartRate from "./pages/HeartRate";
import Steps from "./pages/Steps";
import Water from "./pages/Water";
import Dashboard from "./pages/Dashboard";
import HealthChat from "./pages/HealthChat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isOnboarded } = useUser();
  
  if (!isOnboarded) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// Routes wrapper with user context access
function AppRoutes() {
  const { isOnboarded } = useUser();

  return (
    <Routes>
      <Route path="/" element={isOnboarded ? <Navigate to="/home" replace /> : <Welcome />} />
      <Route path="/onboarding/1" element={<BasicDetails />} />
      <Route path="/onboarding/2" element={<GoalSelection />} />
      <Route path="/onboarding/3" element={<ActivityLevel />} />
      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/food-scanner" element={<ProtectedRoute><FoodScanner /></ProtectedRoute>} />
      <Route path="/heart-rate" element={<ProtectedRoute><HeartRate /></ProtectedRoute>} />
      <Route path="/steps" element={<ProtectedRoute><Steps /></ProtectedRoute>} />
      <Route path="/water" element={<ProtectedRoute><Water /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <UserProvider>
          <AppRoutes />
        </UserProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
