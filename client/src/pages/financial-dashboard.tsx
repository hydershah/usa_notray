import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  TrendingDown,
  Wallet,
  Receipt,
  AlertCircle,
  Calendar,
  Calculator,
  Eye,
  Plus,
  Download,
  Filter
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface AccountSummary {
  accountBalance: number;
  minimumBalance: number;
  availableBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  totalSpent: number;
  notaryType: 'subscriber' | 'contractor';
  role: string;
  canTakeJobs: boolean;
  recentTransactions: Transaction[];
}

interface Transaction {
  id: number;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  jobId?: number;
  status: string;
  createdAt: string;
  processedAt?: string;
}

interface ContractorPayment {
  id: number;
  jobId: number;
  totalJobFee: number;
  contractorAmount: number;
  platformFee: number;
  contractorPercentage: number;
  paymentStatus: string;
  clientPaymentDate?: string;
  paidToContractorDate?: string;
  createdAt: string;
}

interface FeeCalculation {
  subscriberFees?: {
    basePlatformFee: number;
    additionalIdFees: number;
    extendedTimeFees: number;
    witnessFee: number;
    totalFees: number;
  };
  contractorFees?: {
    totalJobFee: number;
    contractorPercentage: number;
    contractorAmount: number;
    platformFee: number;
  };
  breakdown: {
    feeType: string;
    amount: number;
    description: string;
  }[];
}

export default function FinancialDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isTransactionDetailsOpen, setIsTransactionDetailsOpen] = useState(false);
  const [isFeeCalculatorOpen, setIsFeeCalculatorOpen] = useState(false);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  
  // Fee calculator state
  const [feeCalcForm, setFeeCalcForm] = useState({
    jobId: 1,
    notaryId: user?.id || 1,
    closingType: 'Single Document',
    signerCount: 1,
    documentCount: 1,
    sessionDuration: 20,
    idVerificationCount: 1,
    witnessProvided: false,
    clientProvidesWitness: false
  });

  const [addFundsForm, setAddFundsForm] = useState({
    amount: '',
    description: ''
  });

  // Data fetching
  const { data: accountSummary, isLoading: summaryLoading } = useQuery<AccountSummary>({
    queryKey: ['/api/account/summary'],
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['/api/account/transactions'],
    enabled: accountSummary?.notaryType === 'subscriber'
  });

  const { data: contractorPayments = [], isLoading: paymentsLoading } = useQuery<ContractorPayment[]>({
    queryKey: ['/api/contractor/payments'],
    enabled: accountSummary?.notaryType === 'contractor'
  });

  const [feeCalculation, setFeeCalculation] = useState<FeeCalculation | null>(null);

  // Mutations
  const calculateFeesMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/fees/calculate", data);
      return response.json();
    },
    onSuccess: (result: FeeCalculation) => {
      setFeeCalculation(result);
    }
  });

  const addFundsMutation = useMutation({
    mutationFn: async (data: { userId: number; amount: number; description: string }) => {
      const response = await apiRequest("POST", "/api/account/add-funds", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/account/summary'] });
      setIsAddFundsOpen(false);
      setAddFundsForm({ amount: '', description: '' });
      toast({
        title: "Funds Added",
        description: "Account balance has been updated successfully.",
      });
    }
  });

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'fee_deduction':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'contractor_payment':
        return <DollarSign className="h-4 w-4 text-blue-500" />;
      default:
        return <Receipt className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string, type: 'transaction' | 'payment' = 'transaction') => {
    const colors = {
      transaction: {
        completed: "bg-green-100 text-green-800",
        pending: "bg-yellow-100 text-yellow-800",
        failed: "bg-red-100 text-red-800",
        cancelled: "bg-gray-100 text-gray-800"
      },
      payment: {
        pending: "bg-yellow-100 text-yellow-800",
        paid_by_client: "bg-blue-100 text-blue-800",
        available_for_payout: "bg-purple-100 text-purple-800",
        paid_to_contractor: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800"
      }
    };

    const colorClass = colors[type][status as keyof typeof colors[typeof type]] || "bg-gray-100 text-gray-800";

    return (
      <Badge className={`${colorClass} border-0`}>
        {status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  const handleCalculateFees = () => {
    calculateFeesMutation.mutate(feeCalcForm);
  };

  const handleAddFunds = () => {
    if (!addFundsForm.amount || parseFloat(addFundsForm.amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount greater than 0.",
        variant: "destructive"
      });
      return;
    }

    addFundsMutation.mutate({
      userId: user?.id || 0,
      amount: parseFloat(addFundsForm.amount),
      description: addFundsForm.description || 'Manual fund addition'
    });
  };

  if (summaryLoading) {
    return (
      <MainLayout>
        <div className="text-center py-8">Loading financial dashboard...</div>
      </MainLayout>
    );
  }

  if (!accountSummary) {
    return (
      <MainLayout>
        <div className="text-center py-8">Unable to load account information.</div>
      </MainLayout>
    );
  }

  const balancePercentage = accountSummary.notaryType === 'subscriber' 
    ? (accountSummary.accountBalance / accountSummary.minimumBalance) * 100
    : 100;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Financial Dashboard</h1>
            <p className="text-gray-600">
              Manage your account balance, fees, and payments as a {accountSummary.notaryType} notary
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button onClick={() => setIsFeeCalculatorOpen(true)} variant="outline">
              <Calculator className="h-4 w-4 mr-2" />
              Fee Calculator
            </Button>
            {user?.role === 'admin' && (
              <Button onClick={() => setIsAddFundsOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Funds
              </Button>
            )}
          </div>
        </div>

        {/* Account Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Wallet className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Account Balance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(accountSummary.accountBalance)}
                  </p>
                  {accountSummary.notaryType === 'subscriber' && (
                    <div className="mt-2">
                      <Progress value={Math.min(balancePercentage, 100)} className="h-2" />
                      <p className="text-xs text-gray-500 mt-1">
                        Minimum: {formatCurrency(accountSummary.minimumBalance)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {accountSummary.notaryType === 'subscriber' ? (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingDown className="h-8 w-8 text-red-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Spent</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(accountSummary.totalSpent)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <CreditCard className="h-8 w-8 text-blue-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Available Balance</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(accountSummary.availableBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    {accountSummary.canTakeJobs ? (
                      <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                        <div className="h-4 w-4 bg-green-500 rounded-full"></div>
                      </div>
                    ) : (
                      <AlertCircle className="h-8 w-8 text-red-500" />
                    )}
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Status</p>
                      <p className="text-lg font-bold">
                        {accountSummary.canTakeJobs ? (
                          <span className="text-green-600">Active</span>
                        ) : (
                          <span className="text-red-600">Low Balance</span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <TrendingUp className="h-8 w-8 text-green-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(accountSummary.totalEarnings)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Calendar className="h-8 w-8 text-yellow-500" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Pending Balance</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatCurrency(accountSummary.pendingBalance)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Status</p>
                      <p className="text-lg font-bold text-blue-600">
                        55% Per Job
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Transaction History or Contractor Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {accountSummary.notaryType === 'subscriber' ? 'Transaction History' : 'Payment History'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accountSummary.notaryType === 'subscriber' ? (
              <div className="overflow-x-auto">
                {transactionsLoading ? (
                  <div className="text-center py-8">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No transactions found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Balance After</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTransactionIcon(transaction.transactionType)}
                              {transaction.transactionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </div>
                          </TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>
                            <span className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {transaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                            </span>
                          </TableCell>
                          <TableCell>{formatCurrency(transaction.balanceAfter)}</TableCell>
                          <TableCell>{getStatusBadge(transaction.status)}</TableCell>
                          <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTransaction(transaction);
                                setIsTransactionDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                {paymentsLoading ? (
                  <div className="text-center py-8">Loading payments...</div>
                ) : contractorPayments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No payments found.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job #</TableHead>
                        <TableHead>Total Job Fee</TableHead>
                        <TableHead>Your Share ({contractorPayments[0]?.contractorPercentage}%)</TableHead>
                        <TableHead>Platform Fee</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contractorPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>#{payment.jobId}</TableCell>
                          <TableCell>{formatCurrency(payment.totalJobFee)}</TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {formatCurrency(payment.contractorAmount)}
                          </TableCell>
                          <TableCell>{formatCurrency(payment.platformFee)}</TableCell>
                          <TableCell>{getStatusBadge(payment.paymentStatus, 'payment')}</TableCell>
                          <TableCell>{formatDate(payment.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fee Calculator Dialog */}
        <Dialog open={isFeeCalculatorOpen} onOpenChange={setIsFeeCalculatorOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Fee Calculator</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Closing Type</label>
                  <select 
                    className="w-full mt-1 p-2 border rounded"
                    value={feeCalcForm.closingType}
                    onChange={(e) => setFeeCalcForm(prev => ({ ...prev, closingType: e.target.value }))}
                  >
                    <option value="Single Document">Single Document</option>
                    <option value="Title Closing - Seller Side">Title Closing - Seller Side</option>
                    <option value="Title Closing - Buyer Side">Title Closing - Buyer Side</option>
                    <option value="Title Closing - Buyer Side with Loans">Title Closing - Buyer Side with Loans</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Signer Count</label>
                  <Input
                    type="number"
                    min="1"
                    value={feeCalcForm.signerCount}
                    onChange={(e) => setFeeCalcForm(prev => ({ ...prev, signerCount: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Document Count</label>
                  <Input
                    type="number"
                    min="1"
                    value={feeCalcForm.documentCount}
                    onChange={(e) => setFeeCalcForm(prev => ({ ...prev, documentCount: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Session Duration (minutes)</label>
                  <Input
                    type="number"
                    min="1"
                    value={feeCalcForm.sessionDuration}
                    onChange={(e) => setFeeCalcForm(prev => ({ ...prev, sessionDuration: parseInt(e.target.value) || 20 }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">ID Verifications</label>
                  <Input
                    type="number"
                    min="1"
                    value={feeCalcForm.idVerificationCount}
                    onChange={(e) => setFeeCalcForm(prev => ({ ...prev, idVerificationCount: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="witnessProvided"
                    checked={feeCalcForm.witnessProvided}
                    onChange={(e) => setFeeCalcForm(prev => ({ ...prev, witnessProvided: e.target.checked }))}
                  />
                  <label htmlFor="witnessProvided" className="text-sm font-medium">Witness Provided</label>
                </div>
              </div>
              
              <Button 
                onClick={handleCalculateFees} 
                className="w-full" 
                disabled={calculateFeesMutation.isPending}
              >
                {calculateFeesMutation.isPending ? 'Calculating...' : 'Calculate Fees'}
              </Button>

              {feeCalculation && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-3">Fee Breakdown</h3>
                  <div className="space-y-2">
                    {feeCalculation.breakdown.map((item, index) => (
                      <div key={index} className="flex justify-between">
                        <span>{item.description}</span>
                        <span className="font-medium">{formatCurrency(item.amount / 100)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between font-bold">
                      <span>Total</span>
                      <span>
                        {feeCalculation.subscriberFees 
                          ? formatCurrency(feeCalculation.subscriberFees.totalFees / 100)
                          : feeCalculation.contractorFees 
                          ? formatCurrency(feeCalculation.contractorFees.contractorAmount / 100)
                          : '$0.00'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Funds Dialog (Admin Only) */}
        {user?.role === 'admin' && (
          <Dialog open={isAddFundsOpen} onOpenChange={setIsAddFundsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Funds to Account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Amount ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Enter amount"
                    value={addFundsForm.amount}
                    onChange={(e) => setAddFundsForm(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description (Optional)</label>
                  <Input
                    placeholder="Enter description"
                    value={addFundsForm.description}
                    onChange={(e) => setAddFundsForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <Button 
                  onClick={handleAddFunds} 
                  className="w-full"
                  disabled={addFundsMutation.isPending}
                >
                  {addFundsMutation.isPending ? 'Adding Funds...' : 'Add Funds'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Transaction Details Dialog */}
        <Dialog open={isTransactionDetailsOpen} onOpenChange={setIsTransactionDetailsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            {selectedTransaction && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Transaction ID</label>
                    <p className="text-sm">{selectedTransaction.id}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Type</label>
                    <p className="text-sm">{selectedTransaction.transactionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Amount</label>
                    <p className="text-sm font-medium">
                      <span className={selectedTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {selectedTransaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(selectedTransaction.amount))}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Status</label>
                    <div>{getStatusBadge(selectedTransaction.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Balance Before</label>
                    <p className="text-sm">{formatCurrency(selectedTransaction.balanceBefore)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Balance After</label>
                    <p className="text-sm">{formatCurrency(selectedTransaction.balanceAfter)}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Description</label>
                    <p className="text-sm">{selectedTransaction.description}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-sm">{formatDateTime(selectedTransaction.createdAt)}</p>
                  </div>
                  {selectedTransaction.processedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Processed</label>
                      <p className="text-sm">{formatDateTime(selectedTransaction.processedAt)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
} 