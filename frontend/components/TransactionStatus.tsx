export function TransactionStatus({
  isPending,
  isConfirming,
  pendingText = 'Confirm in wallet...',
  confirmingText = 'Confirming transaction...',
}: {
  isPending: boolean;
  isConfirming: boolean;
  pendingText?: string;
  confirmingText?: string;
}) {
  return (
    <div className="text-center py-6">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
      <p className="text-sm text-gray-600">
        {isPending ? pendingText : isConfirming ? confirmingText : 'Processing...'}
      </p>
    </div>
  );
}
