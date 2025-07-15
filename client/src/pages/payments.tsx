import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { type Payment, type Invoice, type Job, type User } from "@shared/types";
import { 
  Plus, 
  DollarSign, 
  Receipt, 
  CreditCard, 
  Clock, 
  CheckCircle, 
  XCircle,
  Eye,
  Edit,
  Download,
  Send,
  Calendar,
  Search,
  Filter,
  FileText,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";



export default function Payments() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State management
  const [activeTab, setActiveTab] = useState<'payments' | 'invoices' | 'create'>('payments');
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  
  // Form state
  const [paymentForm, setPaymentForm] = useState({
    jobId: "",
    payeeId: "",
    amount: "",
    description: "",
    paymentMethod: "",
    dueDate: ""
  });

  const [invoiceForm, setInvoiceForm] = useState({
    jobId: "",
    clientId: "",
    notaryId: "",
    description: "",
    subtotal: "",
    taxAmount: "",
    dueDate: ""
  });

  // Data fetching
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ['/api/payments'],
    enabled: activeTab === 'payments'
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
    enabled: activeTab === 'invoices'
  });

  const { data: jobs = [] } = useQuery<Job[]>({
    queryKey: ['/api/jobs']
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users']
  });

  // Mutations
  const createPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/payments", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      setIsCreatePaymentOpen(false);
      setPaymentForm({
        jobId: "",
        payeeId: "",
        amount: "",
        description: "",
        paymentMethod: "",
        dueDate: ""
      });
      toast({
        title: "Payment Created",
        description: "Payment has been successfully created.",
      });
    }
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/invoices", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      setIsCreateInvoiceOpen(false);
      setInvoiceForm({
        jobId: "",
        clientId: "",
        notaryId: "",
        description: "",
        subtotal: "",
        taxAmount: "",
        dueDate: ""
      });
      toast({
        title: "Invoice Created",
        description: "Invoice has been successfully created.",
      });
    }
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PUT", `/api/payments/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payments'] });
      toast({
        title: "Payment Updated",
        description: "Payment status has been updated.",
      });
    }
  });

  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PUT", `/api/invoices/${id}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({
        title: "Invoice Updated",
        description: "Invoice status has been updated.",
      });
    }
  });

  // Helper functions
  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusBadge = (status: string, type: 'payment' | 'invoice') => {
    const statusColors = {
      payment: {
        pending: "bg-yellow-100 text-yellow-800",
        completed: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800",
        refunded: "bg-gray-100 text-gray-800"
      },
      invoice: {
        draft: "bg-gray-100 text-gray-800",
        sent: "bg-blue-100 text-blue-800",
        paid: "bg-green-100 text-green-800",
        overdue: "bg-red-100 text-red-800",
        cancelled: "bg-gray-100 text-gray-800"
      }
    };

    const colorClass = statusColors[type][status as keyof typeof statusColors[typeof type]] || "bg-gray-100 text-gray-800";

    return (
      <Badge className={`${colorClass} border-0`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const handleCreatePayment = () => {
    const amount = Math.round(parseFloat(paymentForm.amount) * 100);
    createPaymentMutation.mutate({
      ...paymentForm,
      amount,
      payerId: user?.id,
      currency: "USD"
    });
  };

  const handleCreateInvoice = () => {
    const subtotal = Math.round(parseFloat(invoiceForm.subtotal) * 100);
    const taxAmount = Math.round(parseFloat(invoiceForm.taxAmount || "0") * 100);
    const totalAmount = subtotal + taxAmount;

    createInvoiceMutation.mutate({
      ...invoiceForm,
      subtotal,
      taxAmount,
      totalAmount
    });
  };

  const filteredPayments = payments.filter((payment: Payment) =>
    (statusFilter === "all" || payment.status === statusFilter) &&
    (payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
     payment.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredInvoices = invoices.filter((invoice: Invoice) =>
    (statusFilter === "all" || invoice.status === statusFilter) &&
    (invoice.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
     invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Calculate totals
  const paymentStats = {
    totalPaid: payments.filter((p: Payment) => p.status === 'completed').reduce((sum: number, p: Payment) => sum + p.amount, 0),
    totalPending: payments.filter((p: Payment) => p.status === 'pending').reduce((sum: number, p: Payment) => sum + p.amount, 0),
    totalInvoiced: invoices.reduce((sum: number, i: Invoice) => sum + i.totalAmount, 0),
    overdueInvoices: invoices.filter((i: Invoice) => i.status === 'overdue').length
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
            <p className="text-gray-600">Manage payments, invoices, and billing for notary services</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button onClick={() => setIsCreatePaymentOpen(true)} variant="outline">
              <DollarSign className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
            <Button onClick={() => setIsCreateInvoiceOpen(true)}>
              <Receipt className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Paid</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(paymentStats.totalPaid)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(paymentStats.totalPending)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Invoiced</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(paymentStats.totalInvoiced)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {paymentStats.overdueInvoices}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('payments')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'payments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DollarSign className="h-4 w-4 inline mr-2" />
              Payments
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invoices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Receipt className="h-4 w-4 inline mr-2" />
              Invoices
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by description or invoice number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {activeTab === 'payments' ? (
                <>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {activeTab === 'payments' ? (
                <>
                  <DollarSign className="h-5 w-5" />
                  Payment Records
                </>
              ) : (
                <>
                  <Receipt className="h-5 w-5" />
                  Invoice Management
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTab === 'payments' ? (
              <div className="overflow-x-auto">
                {paymentsLoading ? (
                  <div className="text-center py-8">Loading payments...</div>
                ) : filteredPayments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No payments found. Create your first payment record.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment: Payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{payment.description}</div>
                              {payment.invoiceNumber && (
                                <div className="text-sm text-gray-500">
                                  Invoice: {payment.invoiceNumber}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(payment.amount, payment.currency)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(payment.status, 'payment')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <CreditCard className="h-4 w-4 text-gray-400" />
                              {payment.paymentMethod || 'Not specified'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {payment.dueDate ? formatDate(payment.dueDate) : '-'}
                          </TableCell>
                          <TableCell>
                            {formatDate(payment.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setIsPaymentDetailsOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {payment.status === 'pending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updatePaymentStatusMutation.mutate({
                                    id: payment.id,
                                    status: 'completed'
                                  })}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {invoicesLoading ? (
                  <div className="text-center py-8">Loading invoices...</div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No invoices found. Create your first invoice.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice: Invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">
                            {invoice.invoiceNumber}
                          </TableCell>
                          <TableCell>{invoice.description}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(invoice.totalAmount)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(invoice.status, 'invoice')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {formatDate(invoice.dueDate)}
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatDate(invoice.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setIsInvoiceDetailsOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  // Download invoice PDF
                                  toast({
                                    title: "Download Started",
                                    description: "Invoice PDF download would start here.",
                                  });
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              {invoice.status === 'draft' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updateInvoiceStatusMutation.mutate({
                                    id: invoice.id,
                                    status: 'sent'
                                  })}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Payment Dialog */}
        <Dialog open={isCreatePaymentOpen} onOpenChange={setIsCreatePaymentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
              <DialogDescription>
                Record a payment received for notary services.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Job</label>
                <Select 
                  value={paymentForm.jobId} 
                  onValueChange={(value) => setPaymentForm({...paymentForm, jobId: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job: any) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.titleCompany} - {job.propertyAddressOne}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Payee</label>
                <Select 
                  value={paymentForm.payeeId} 
                  onValueChange={(value) => setPaymentForm({...paymentForm, payeeId: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select payee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u: any) => u.role === 'notary').map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Payment description"
                  value={paymentForm.description}
                  onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Payment Method</label>
                <Select 
                  value={paymentForm.paymentMethod} 
                  onValueChange={(value) => setPaymentForm({...paymentForm, paymentMethod: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit_card">Credit Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={paymentForm.dueDate}
                  onChange={(e) => setPaymentForm({...paymentForm, dueDate: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreatePaymentOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreatePayment}
                disabled={createPaymentMutation.isPending}
              >
                {createPaymentMutation.isPending ? "Creating..." : "Create Payment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Invoice Dialog */}
        <Dialog open={isCreateInvoiceOpen} onOpenChange={setIsCreateInvoiceOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Generate an invoice for notary services.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium">Job</label>
                <Select 
                  value={invoiceForm.jobId} 
                  onValueChange={(value) => setInvoiceForm({...invoiceForm, jobId: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job: any) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.titleCompany} - {job.propertyAddressOne}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Client</label>
                <Select 
                  value={invoiceForm.clientId} 
                  onValueChange={(value) => setInvoiceForm({...invoiceForm, clientId: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u: any) => u.role === 'title_company' || u.role === 'client').map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Notary</label>
                <Select 
                  value={invoiceForm.notaryId} 
                  onValueChange={(value) => setInvoiceForm({...invoiceForm, notaryId: value})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select notary" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.filter((u: any) => u.role === 'notary').map((user: any) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Invoice description and services provided"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({...invoiceForm, description: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Subtotal</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={invoiceForm.subtotal}
                  onChange={(e) => setInvoiceForm({...invoiceForm, subtotal: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tax Amount (Optional)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={invoiceForm.taxAmount}
                  onChange={(e) => setInvoiceForm({...invoiceForm, taxAmount: e.target.value})}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm({...invoiceForm, dueDate: e.target.value})}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateInvoiceOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateInvoice}
                disabled={createInvoiceMutation.isPending}
              >
                {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}