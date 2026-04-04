import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp, Employee } from '../context/AppContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedEmployeeId?: string;
}

export function AddPaymentModal({ isOpen, onClose, preselectedEmployeeId }: AddPaymentModalProps) {
  const { employees, addPayment } = useApp();
  const [employeeId, setEmployeeId] = useState(preselectedEmployeeId || employees[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!employeeId || !amount || parseFloat(amount) <= 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    addPayment({
      employeeId,
      amount: parseFloat(amount),
      date,
      comment: comment || 'payment',
    });

    toast.success('Payment added successfully');
    
    // Reset form
    setAmount('');
    setComment('');
    setDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-md md:rounded-lg rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Add Payment</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-neutral-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <Label htmlFor="employee">Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="w-full mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Amount (₽)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000"
              className="mt-1.5"
              min="0"
              step="100"
              required
            />
          </div>

          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5"
              required
            />
          </div>

          <div>
            <Label htmlFor="comment">Comment</Label>
            <Input
              id="comment"
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="salary, advance, etc."
              className="mt-1.5"
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12"
          >
            Add payment
          </Button>
        </form>
      </div>
    </div>
  );
}
