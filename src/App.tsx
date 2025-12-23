import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthPage } from "@/components/auth/AuthPage";
import { MainLayout } from "@/components/layout/MainLayout";
import { Dashboard } from "@/pages/Dashboard";
import { MyShifts } from "@/pages/MyShifts";
import { Summary } from "@/pages/Summary";
import { GlobalCalendar } from "@/pages/GlobalCalendar";
import { LeaveRequests } from "@/pages/LeaveRequests";
import { Logs } from "@/pages/Logs";
import { AdminPanel } from "@/pages/AdminPanel";
import { Settings } from "@/pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route element={<MainLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/my-shifts" element={<MyShifts />} />
              <Route path="/summary" element={<Summary />} />
              <Route path="/global-calendar" element={<GlobalCalendar />} />
              <Route path="/leave-requests" element={<LeaveRequests />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/users" element={<AdminPanel />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
