'use client';

import { formatUnits } from 'viem';

export function PaymentCard({
  ensName,
  monthlyRent,
  penalty,
  totalDue,
  nextDueDate,
  endDate,
  verifiedLease,
  personaVerified,
}: {
  ensName: string;
  monthlyRent: bigint;
  penalty: bigint;
  totalDue: bigint;
  nextDueDate: Date | null;
  endDate: Date | null;
  verifiedLease: boolean;
  personaVerified: boolean;
}) {
  const hasPenalty = penalty > 0n;

  return (
    <>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Pay Rent</h1>
        <p className="text-sm font-mono text-blue-600 mt-1 break-all">{ensName}</p>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          {verifiedLease && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
              Verified Lease
            </span>
          )}
          {personaVerified && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              Identity Verified
            </span>
          )}
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Monthly Rent</span>
          <span className="font-semibold">{formatUnits(monthlyRent, 6)} USDC</span>
        </div>

        {hasPenalty && (
          <div className="flex justify-between text-sm">
            <span className="text-red-500">Late Penalty</span>
            <span className="font-semibold text-red-600">+{formatUnits(penalty, 6)} USDC</span>
          </div>
        )}

        <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
          <span>Total Due</span>
          <span className={hasPenalty ? 'text-red-600' : 'text-gray-900'}>
            {formatUnits(totalDue, 6)} USDC
          </span>
        </div>

        {nextDueDate && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Due Date</span>
            <span className="text-gray-700">{nextDueDate.toLocaleDateString()}</span>
          </div>
        )}

        {endDate && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Lease End</span>
            <span className="text-gray-700">{endDate.toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </>
  );
}

