'use client';

import { useState } from 'react';
import { resolveAddress, getTextRecord } from '@/lib/ens';

type VerifyState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';

type TextRecord = { key: string; value: string | null };

export default function VerifyPage() {
  const [ensName, setEnsName] = useState('');
  const [state, setState] = useState<VerifyState>('idle');
  const [resolvedAddr, setResolvedAddr] = useState<string | null>(null);
  const [textRecords, setTextRecords] = useState<TextRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleVerify() {
    const name = ensName.trim();
    if (!name) return;

    setState('loading');
    setResolvedAddr(null);
    setTextRecords([]);
    setErrorMsg('');

    try {
      const addr = await resolveAddress(name);

      if (!addr) {
        setState('not-found');
        return;
      }

      setResolvedAddr(addr);

      // Fetch all known text records
      const keys = [
        'lease.status',
        'lease.tenant',
        'lease.rentAmount',
        'lease.token',
        'lease.startDate',
        'lease.endDate',
        'lease.lastPaid',
        'persona.verified',
        'persona.timestamp',
        'role',
        'owner.address',
      ];

      const results = await Promise.all(
        keys.map(async (key) => {
          try {
            const value = await getTextRecord(name, key);
            return { key, value };
          } catch {
            return { key, value: null };
          }
        })
      );

      setTextRecords(results);
      setState('found');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      // Check if it's a "not found" type error
      if (msg.includes('revert') || msg.includes('null') || msg.includes('resolve')) {
        setState('not-found');
      } else {
        setErrorMsg(msg.slice(0, 200));
        setState('error');
      }
    }
  }

  const hasRecords = textRecords.some((r) => r.value);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">&#x1F50D;</div>
          <h1 className="text-2xl font-bold text-gray-900">Verify ENS Lease</h1>
          <p className="text-sm text-gray-500 mt-1">
            Look up any ENS name to verify its on-chain lease data. No wallet required.
          </p>
        </div>

        {/* Search */}
        <div className="space-y-3 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ENS Name</label>
            <input
              type="text"
              value={ensName}
              onChange={(e) => setEnsName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder="apt1.residence-epfl.eth"
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={!ensName.trim() || state === 'loading'}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            {state === 'loading' ? 'Resolving...' : 'Verify'}
          </button>
        </div>

        {/* Loading */}
        {state === 'loading' && (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Resolving on-chain...</p>
          </div>
        )}

        {/* Not Found */}
        {state === 'not-found' && (
          <div className="text-center py-4">
            <div className="text-red-500 text-5xl mb-3">&#x2718;</div>
            <p className="font-semibold text-red-700 text-lg mb-1">ENS Name Not Found</p>
            <p className="text-sm text-gray-500 mb-2">
              <span className="font-mono text-red-600">{ensName}</span> does not resolve to any address.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mt-3">
              <p className="text-sm text-red-700">
                This name has no on-chain identity. If someone gave you this as a payment link, <span className="font-semibold">it may be a scam</span>.
              </p>
            </div>
          </div>
        )}

        {/* Found */}
        {state === 'found' && resolvedAddr && (
          <div>
            <div className="text-center mb-4">
              <div className="text-green-500 text-5xl mb-3">&#x2714;</div>
              <p className="font-semibold text-green-700 text-lg mb-1">ENS Name Verified</p>
              <p className="font-mono text-blue-600 font-semibold">{ensName}</p>
            </div>

            {/* Resolved Address */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-500 mb-1">Resolved Address</p>
              <p className="font-mono text-sm break-all">{resolvedAddr}</p>
            </div>

            {/* Text Records */}
            {hasRecords ? (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <p className="text-xs text-gray-500 mb-2 font-semibold">On-Chain Text Records</p>
                {textRecords.map((record) =>
                  record.value ? (
                    <div key={record.key} className="flex justify-between text-sm">
                      <span className="text-gray-500 font-mono text-xs">{record.key}</span>
                      <span className="font-mono text-xs text-gray-900 text-right max-w-[200px] truncate">
                        {record.key === 'lease.rentAmount'
                          ? `${(Number(record.value) / 1e6).toFixed(2)} USDC`
                          : record.key === 'lease.startDate' || record.key === 'lease.endDate'
                            ? new Date(Number(record.value) * 1000).toLocaleDateString()
                            : record.value}
                      </span>
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-500">No lease text records found for this name.</p>
              </div>
            )}

            {/* Info banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4">
              <p className="text-xs text-blue-700">
                This data is read directly from Ethereum Sepolia. Any ENS-aware app can verify this lease without our frontend.
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="text-center py-4">
            <div className="text-red-500 text-4xl mb-2">&#x2718;</div>
            <p className="font-semibold text-red-700 mb-1">Lookup Failed</p>
            <p className="text-sm text-gray-500 break-all">{errorMsg}</p>
          </div>
        )}

        {/* Nav */}
        <div className="mt-6 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to Home</a>
        </div>
      </div>
    </div>
  );
}
