import React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/main-layout";
import { SignatureManager } from "@/components/user/signature-manager";
import { NotaryStampManager } from "@/components/user/notary-stamp-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature, Stamp, User } from "lucide-react";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import CreateJob from "@/pages/create-job";
import TitleCompanies from "@/pages/title-companies";
import UserManagement from "@/pages/user-management";
import NotaryManagement from "@/pages/notary-management";
const Calendar = React.lazy(() => import("@/pages/calendar"));
const Payments = React.lazy(() => import("@/pages/payments"));
const ClosingTypes = React.lazy(() => import("@/pages/closing-types"));
const EmailSettingsPage = React.lazy(() => import("@/pages/email-settings"));
const EmailTemplateManagement = React.lazy(() => import("@/pages/email-template-management"));
const CompanyRegistration = React.lazy(() => import("@/pages/company-registration"));
const NotaryProfileCompletion = React.lazy(() => import("@/components/notary/NotaryProfileCompletion"));
const SetPasswordPage = React.lazy(() => import("@/pages/set-password"));

// Profile component
function Profile() {
  const { user } = useAuth();
  
  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <MainLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Profile & Signatures</h1>
          <p className="text-gray-600">Manage your digital signatures and account settings</p>
        </div>

        <Tabs defaultValue="signatures" className="space-y-6">
          <TabsList>
            <TabsTrigger value="signatures">
              <FileSignature className="w-4 h-4 mr-2" />
              Signatures
            </TabsTrigger>
            {(user.role === 'notary' || user.role === 'admin') && (
              <TabsTrigger value="stamps">
                <Stamp className="w-4 h-4 mr-2" />
                Notary Stamps
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="signatures">
            <SignatureManager userId={user.id} />
          </TabsContent>

          {(user.role === 'notary' || user.role === 'admin') && (
            <TabsContent value="stamps">
              <NotaryStampManager notaryId={user.id} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}

// Protected Route wrapper component
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { isAuthenticated, user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect immediately when not authenticated
  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Return null to prevent rendering while redirecting
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function Router() {
  const { isAuthenticated, isLoggingOut } = useAuth();

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : <Login />}
      </Route>

      {/* Password setup route - public */}
      <Route path="/set-password">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <React.Suspense fallback={<div>Loading...</div>}>
            <SetPasswordPage />
          </React.Suspense>
        }
      </Route>

      {/* Company registration route - public */}
      <Route path="/register-company">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <React.Suspense fallback={<div>Loading...</div>}>
            <CompanyRegistration />
          </React.Suspense>
        }
      </Route>



      {/* Protected routes */}
      <Route path="/notary/profile/complete">
        <ProtectedRoute allowedRoles={['notary']}>
          <React.Suspense fallback={<div>Loading...</div>}>
            <NotaryProfileCompletion />
          </React.Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/jobs">
        <ProtectedRoute>
          <Jobs />
        </ProtectedRoute>
      </Route>

      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>

      <Route path="/calendar">
        <ProtectedRoute allowedRoles={['admin', 'notary']}>
          <React.Suspense fallback={<div>Loading...</div>}>
            <Calendar />
          </React.Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/create-job">
        <ProtectedRoute>
          <CreateJob />
        </ProtectedRoute>
      </Route>

      <Route path="/title-companies">
        <ProtectedRoute allowedRoles={['admin']}>
          <TitleCompanies />
        </ProtectedRoute>
      </Route>

      <Route path="/user-management">
        <ProtectedRoute allowedRoles={['admin']}>
          <UserManagement />
        </ProtectedRoute>
      </Route>





      <Route path="/payments">
        <ProtectedRoute allowedRoles={['admin', 'title_company', 'notary']}>
          <React.Suspense fallback={<div>Loading...</div>}>
            <Payments />
          </React.Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/closing-types">
        <ProtectedRoute allowedRoles={['admin']}>
          <React.Suspense fallback={<div>Loading...</div>}>
            <ClosingTypes />
          </React.Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/email-settings">
        <ProtectedRoute allowedRoles={['admin']}>
          <React.Suspense fallback={<div>Loading...</div>}>
            <EmailSettingsPage />
          </React.Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/email-templates">
        <ProtectedRoute allowedRoles={['admin']}>
          <React.Suspense fallback={<div>Loading...</div>}>
            <EmailTemplateManagement />
          </React.Suspense>
        </ProtectedRoute>
      </Route>

      <Route path="/notary-management">
        <ProtectedRoute allowedRoles={['admin']}>
          <NotaryManagement />
        </ProtectedRoute>
      </Route>

      <Route path="/logs">
        <ProtectedRoute allowedRoles={['admin', 'notary']}>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      {/* Default redirect */}
      <Route path="/">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>

      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
