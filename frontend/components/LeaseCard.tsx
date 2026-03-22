'use client';

import { formatUnits } from 'viem';

type LeaseAction = {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'warning' | 'danger';
  disabled?: boolean;
};

function actionClasses(variant: LeaseAction['variant']) {
  if (variant === 'danger') return 'bg-red-500 hover:bg-red-600 text-white';
  if (variant === 'warning') return 'bg-amber-500 hover:bg-amber-600 text-white';
  if (variant === 'secondary') return 'border border-blue-600 text-blue-600 hover:bg-blue-50';
  return 'bg-blue-600 hover:bg-blue-700 text-white';
}

export function LeaseCard({
  ensName,
  leaseId,
  tenantAddress,
  rentAmount,
  nextDueDate,
  endDate,
  totalDue,
  penalty,
  paymentCount,
  status,
  personaVerified,
  primaryLink,
  secondaryLink,
  actions = [],
}: {
  ensName: string;
  leaseId: bigint;
  tenantAddress?: string;
  rentAmount: bigint;
  nextDueDate: Date;
  endDate: Date;
  totalDue?: bigint;
  penalty?: bigint;
  paymentCount?: number;
  status: 'active' | 'overdue' | 'terminated';
  personaVerified?: boolean;
  primaryLink?: { label: string; href: string };
  secondaryLink?: { label: string; href: string };
  actions?: LeaseAction[];
}) {
  const statusClasses =
    status === 'terminated'
      ? 'bg-red-100 text-red-700'
      : status === 'overdue'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-green-100 text-green-700';

  const statusLabel =
    status === 'terminated' ? 'Terminated' : status === 'overdue' ? 'Overdue' : 'Active';

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <p className="font-mono text-blue-600 font-semibold break-all">{ensName}</p>
          <p className="text-xs text-gray-400 mt-1">Lease #{leaseId.toString()}</p>
        </div>
        <div className="flex items-center gap-2">
          {personaVerified && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
              persona.verified
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 space-y-2 mb-4">
        {tenantAddress && (
          <div className="flex justify-between text-sm gap-3">
            <span className="text-gray-500">Tenant</span>
            <span className="font-mono text-xs text-right">
              {tenantAddress.slice(0, 6)}...{tenantAddress.slice(-4)}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Monthly Rent</span>
          <span className="font-semibold">{formatUnits(rentAmount, 6)} USDC</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Next Due Date</span>
          <span className="text-gray-700">{nextDueDate.toLocaleDateString()}</span>
        </div>
        {penalty !== undefined && penalty > 0n && (
          <div className="flex justify-between text-sm">
            <span className="text-red-500">Late Penalty</span>
            <span className="font-semibold text-red-600">+{formatUnits(penalty, 6)} USDC</span>
          </div>
        )}
        {totalDue !== undefined && (
          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2">
            <span>Total Due</span>
            <span>{formatUnits(totalDue, 6)} USDC</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Lease End</span>
          <span className="text-gray-700">{endDate.toLocaleDateString()}</span>
        </div>
        {paymentCount !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Payments</span>
            <span className="text-gray-700">
              {paymentCount} payment{paymentCount === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {(primaryLink || secondaryLink) && (
        <div className="flex gap-3 mb-3">
          {primaryLink && (
            <a
              href={primaryLink.href}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-3 rounded-xl transition-colors text-sm text-center"
            >
              {primaryLink.label}
            </a>
          )}
          {secondaryLink && (
            <a
              href={secondaryLink.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2 px-3 rounded-xl transition-colors text-sm text-center"
            >
              {secondaryLink.label}
            </a>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div className="flex gap-3">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`flex-1 disabled:bg-gray-300 disabled:text-white font-medium py-2 px-3 rounded-xl transition-colors text-sm ${actionClasses(action.variant)}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

