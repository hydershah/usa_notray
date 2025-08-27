import React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useAccountCompletion } from "@/hooks/use-account-completion";
import { useNotaryProfileCompletion } from "@/hooks/use-notary-profile-completion";
import { MainLayout } from "@/components/layout/main-layout";
import { AccountCompletionOverlay } from "@/components/ui/account-completion-overlay";
import { NotaryProfileCompletionOverlay } from "@/components/ui/notary-profile-completion-overlay";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Jobs from "@/pages/jobs";
import CreateJob from "@/pages/create-job";
import TitleCompanies from "@/pages/title-companies";
import UserManagement from "@/pages/user-management";

// PDF Editor Demo
const EditorDemo = React.lazy(() => import("@/pages/EditorDemo"));

// PDF Editor Integration - Static import for development
import EditorPage from "@/pages/EditorPage";

// Signer invitation page
const SignPage = React.lazy(() => import("@/pages/sign-page"));

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">Please refresh the page to try again.</p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

const Calendar = React.lazy(() => import("@/pages/calendar"));
const Payments = React.lazy(() => import("@/pages/payments"));
const ClosingTypes = React.lazy(() => import("@/pages/closing-types"));
const EmailSettingsPage = React.lazy(() => import("@/pages/email-settings"));
const EmailTemplateManagement = React.lazy(() => import("@/pages/email-template-management"));
const CompanyRegistration = React.lazy(() => import("@/pages/company-registration"));
const NotaryProfileCompletion = React.lazy(() => 
  import("@/components/notary/NotaryProfileCompletion")
    .then(module => ({ default: module.NotaryProfileCompletion }))
    .catch(err => {
      console.error('Failed to load NotaryProfileCompletion:', err);
      return { default: () => <div>Failed to load component. Please refresh the page.</div> };
    })
);
const SetPasswordPage = React.lazy(() => import("@/pages/set-password"));
const ResetPasswordPage = React.lazy(() => import("@/pages/reset-password"));
const JobDetailsPage = React.lazy(() => import("@/pages/job-details"));
const ProfilePage = React.lazy(() => import("@/pages/profile"));

// Role-based redirect component
function RoleBasedRedirect() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return <LoadingFallback />;
  }
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  // Signers and witnesses go to dashboard, others go to admin dashboard
  if (user.role === 'signer' || user.role === 'witness') {
    return <Redirect to="/dashboard" />;
  } else {
    return <Redirect to="/admin-dashboard" />;
  }
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

  if (allowedRoles && user) {
    const hasRequiredRole = allowedRoles.some(role => {
      switch (role) {
        case 'admin':
          return (user as any).isAdmin || (user as any).role === 'admin';
        case 'notary':
          return (user as any).isNotary || (user as any).role === 'notary';
        default:
          return (user as any).role === role;
      }
    });

    if (!hasRequiredRole) {
      // Redirect based on user role
      const defaultRoute = (user.role === 'signer' || user.role === 'witness') 
        ? "/dashboard" 
        : "/admin-dashboard";
      return <Redirect to={defaultRoute} />;
    }
  }

  return <>{children}</>;
}

// Account Completion Wrapper Component
function AccountCompletionWrapper({ children }: { children: React.ReactNode }) {
  const { showOverlay: showSignerOverlay } = useAccountCompletion();
  const { showOverlay: showNotaryOverlay, refresh: refreshNotaryStatus } = useNotaryProfileCompletion();
  const { refetch, user } = useAuth();

  // Only refresh user data once when either overlay first appears
  const hasRefreshedRef = React.useRef(false);
  React.useEffect(() => {
    if ((showSignerOverlay || showNotaryOverlay) && !hasRefreshedRef.current) {
      hasRefreshedRef.current = true;
      refetch?.();
    }
  }, [showSignerOverlay, showNotaryOverlay, refetch]);

  const handleCompletionComplete = async () => {
    console.log('🏁 Account completion callback triggered');
    
    // Add a small delay to prevent racing condition
    setTimeout(async () => {
      // Ensure we have the latest verification state
      await refetch?.();
      
      // Reset the refresh flag so the overlay can be reshown if needed
      hasRefreshedRef.current = false;
      
      // The hook will recompute showOverlay from updated user data
      console.log('🔄 User data refreshed, hook will recompute overlay state');
    }, 500);
  };

  const handleNotaryCompletionComplete = async () => {
    console.log('🏁 Notary profile completion callback triggered');
    
    // Add a small delay to prevent racing condition
    setTimeout(async () => {
      // Refresh both user data and notary status
      await refetch?.();
      await refreshNotaryStatus?.();
      
      // Reset the refresh flag
      hasRefreshedRef.current = false;
      
      // Dispatch custom event to notify other components about profile completion
      window.dispatchEvent(new CustomEvent('notaryProfileCompleted', {
        detail: { userId: user?.id }
      }));
      
      console.log('🔄 Notary profile completion data refreshed');
    }, 500);
  };

  return (
    <>
      {children}
      {/* Signer/Witness Profile Completion Overlay */}
      <AccountCompletionOverlay
        isOpen={showSignerOverlay}
        onComplete={handleCompletionComplete}
      />
      {/* Notary Profile Completion Overlay */}
      <NotaryProfileCompletionOverlay
        isOpen={showNotaryOverlay}
        onComplete={handleNotaryCompletionComplete}
      />
    </>
  );
}

function Router() {
  const { isAuthenticated, isLoggingOut } = useAuth();

  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login">
        {(isAuthenticated && !isLoggingOut) ? <RoleBasedRedirect /> : <Login />}
      </Route>

      {/* Sign page route - public for signer invitations */}
      <Route path="/sign/:token">
        <ErrorBoundary fallback={<LoadingFallback />}>
          <React.Suspense fallback={<LoadingFallback />}>
            <SignPage />
          </React.Suspense>
        </ErrorBoundary>
      </Route>

      {/* Password setup route - public */}
      <Route path="/set-password">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <SetPasswordPage />
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      {/* Password reset route - public */}
      <Route path="/reset-password">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <ResetPasswordPage />
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      {/* PDF Editor Demo - public for development */}
      <Route path="/editor-demo">
        <ErrorBoundary fallback={<LoadingFallback />}>
          <React.Suspense fallback={<LoadingFallback />}>
            <EditorDemo />
          </React.Suspense>
        </ErrorBoundary>
      </Route>

      {/* Company registration route - public */}
      <Route path="/register-company">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <CompanyRegistration />
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      {/* User registration route - public */}
      <Route path="/register-user">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/register-user")))}
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      {/* Notary registration route - public */}
      <Route path="/register-notary">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/register-notary")))}
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      {/* New specialized signup routes - public */}
      <Route path="/signup/client">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/signup-client")))}
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      <Route path="/signup/notary">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/signup-notary")))}
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      <Route path="/signup/company">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/signup-company")))}
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      <Route path="/signup-success">
        {(isAuthenticated && !isLoggingOut) ? <Redirect to="/dashboard" /> : 
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/signup-success")))}
            </React.Suspense>
          </ErrorBoundary>
        }
      </Route>

      {/* Protected routes */}
      <Route path="/notary/profile/complete">
        <ProtectedRoute allowedRoles={['notary']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <NotaryProfileCompletion />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute allowedRoles={['signer', 'witness']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/signing-jobs")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/admin-dashboard">
        <ProtectedRoute allowedRoles={['admin', 'title_company', 'notary', 'client']}>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/jobs">
        <ProtectedRoute>
          <Jobs />
        </ProtectedRoute>
      </Route>

      <Route path="/jobs/:id">
        <ProtectedRoute>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <JobDetailsPage />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      {/* Redirect old signing URLs to proper format */}
      <Route path="/jobs/:id/sign">
        <ProtectedRoute>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/job-sign-redirect")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      {/* Job Request Routes */}
      <Route path="/job-request">
        <ProtectedRoute allowedRoles={['signer', 'client']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/job-request")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/my-job-requests">
        <ProtectedRoute allowedRoles={['signer', 'client']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/my-job-requests")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/job-requests">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}>
                {React.createElement(React.lazy(() => import("@/pages/admin/job-requests")))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      {/* PDF Editor Routes */}
      <Route path="/editor/:jobId">
        <ProtectedRoute allowedRoles={['admin', 'notary', 'signer', 'witness']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <EditorPage />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/profile">
        <ProtectedRoute>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <ProfilePage />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/calendar">
        <ProtectedRoute allowedRoles={['admin', 'notary']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <Calendar />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/create-job">
        <ProtectedRoute>
          <CreateJob />
        </ProtectedRoute>
      </Route>

      <Route path="/title-companies">
        <ProtectedRoute allowedRoles={['admin']}>
          <Redirect to="/admin/companies" />
        </ProtectedRoute>
      </Route>

      <Route path="/title-company-assignments">
        <ProtectedRoute allowedRoles={['admin']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/title-company-assignments")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/user-management">
        <ProtectedRoute allowedRoles={['admin']}>
          <Redirect to="/admin/users" />
        </ProtectedRoute>
      </Route>

      <Route path="/payments">
        <ProtectedRoute allowedRoles={['admin', 'title_company', 'notary']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <Payments />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/closing-types">
        <ProtectedRoute allowedRoles={['admin']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <ClosingTypes />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/email-settings">
        <ProtectedRoute allowedRoles={['admin']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <EmailSettingsPage />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/email-templates">
        <ProtectedRoute allowedRoles={['admin']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              <EmailTemplateManagement />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>



      {/* New Admin Routes */}
      <Route path="/admin/overview">
        <ProtectedRoute allowedRoles={['admin']}>
          <Redirect to="/dashboard" />
        </ProtectedRoute>
      </Route>

      <Route path="/admin/approvals">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}>
                {React.createElement(React.lazy(() => import("@/components/admin/AdminApprovals").then(m => ({ default: m.AdminApprovals }))))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/approvals-hub">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}>
                {React.createElement(React.lazy(() => import("@/pages/admin/approvals-hub")))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/notary-approvals">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}>
                {React.createElement(React.lazy(() => import("@/pages/admin/notary-approvals")))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/verification">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}>
                {React.createElement(React.lazy(() => import("@/components/admin/AdminVerification").then(m => ({ default: m.AdminVerification }))))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

            <Route path="/admin/users">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}> 
                {React.createElement(React.lazy(() => import("@/components/admin/AdminUsers").then(m => ({ default: m.AdminUsers }))))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/banned-users">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}> 
                {React.createElement(React.lazy(() => import("@/components/admin/AdminBannedUsers").then(m => ({ default: m.AdminBannedUsers }))))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/notaries">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}>
                {React.createElement(React.lazy(() => import("@/components/admin/AdminNotaries").then(m => ({ default: m.AdminNotaries }))))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/companies">
        <ProtectedRoute allowedRoles={['admin']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}> 
              <TitleCompanies />
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/admin/logs">
        <ProtectedRoute allowedRoles={['admin']}>
          <MainLayout>
            <ErrorBoundary fallback={<LoadingFallback />}>
              <React.Suspense fallback={<LoadingFallback />}>
                {React.createElement(React.lazy(() => import("@/components/admin/AdminLogs").then(m => ({ default: m.AdminLogs }))))}
              </React.Suspense>
            </ErrorBoundary>
          </MainLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/logs">
        <ProtectedRoute allowedRoles={['admin', 'notary']}>
          <Dashboard />
        </ProtectedRoute>
      </Route>

      <Route path="/my-logs">
        <ProtectedRoute>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/my-logs")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>



      <Route path="/my-documents">
        <ProtectedRoute allowedRoles={['signer', 'witness', 'client', 'notary']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/my-documents")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/id-verification">
        <ProtectedRoute allowedRoles={['signer', 'witness', 'client']}>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/id-verification")))}
            </React.Suspense>
          </ErrorBoundary>
        </ProtectedRoute>
      </Route>

      <Route path="/notifications">
        <ProtectedRoute>
          <ErrorBoundary fallback={<LoadingFallback />}>
            <React.Suspense fallback={<LoadingFallback />}>
              {React.createElement(React.lazy(() => import("@/pages/notifications")))}
            </React.Suspense>
          </ErrorBoundary>
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
        <SonnerToaster />
        <ErrorBoundary fallback={<LoadingFallback />}>
          <AccountCompletionWrapper>
            <Router />
          </AccountCompletionWrapper>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
