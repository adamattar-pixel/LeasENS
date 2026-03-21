export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">ENS Lease Pay</h1>
        <p className="text-gray-500 mb-8">
          On-chain rental payments secured by ENS. Pay rent with stablecoins, verified by your ENS subname.
        </p>

        <div className="space-y-3">
          <a
            href="/onboarding"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            I&apos;m a Tenant
          </a>
          <a
            href="/owner/dashboard"
            className="block w-full border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            I&apos;m an Owner
          </a>
        </div>
      </div>
    </div>
  );
}
