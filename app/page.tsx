"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useConfidentialClient } from "./hooks/useConfidentialClient";
import { useState } from "react";

export default function Home() {
  const { login, logout, authenticated, user } = usePrivy();
  const {
    signer,
    userKeys,
    balances,
    loading,
    error,
    tokenSymbol,
    ensureAccount,
    confidentialDeposit,
    confidentialTransfer,
    withdraw,
  } = useConfidentialClient();

  const [depositAmount, setDepositAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRecipient, setTransferRecipient] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const handleDeposit = async () => {
    if (!depositAmount) return;
    try {
      await confidentialDeposit(depositAmount);
      setDepositAmount("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransfer = async () => {
    if (!transferAmount || !transferRecipient) return;
    try {
      await confidentialTransfer(transferRecipient, transferAmount);
      setTransferAmount("");
      setTransferRecipient("");
    } catch (e) {
      console.error(e);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    try {
      await withdraw(withdrawAmount);
      setWithdrawAmount("");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 font-sans text-black">
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-black text-white flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight">StableTrust SDK</h1>
          {authenticated ? (
            <button
              onClick={logout}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 rounded-lg text-sm font-medium transition-colors border border-gray-800"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={login}
              className="px-4 py-2 bg-white text-black hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors border border-gray-200"
            >
              Connect Wallet
            </button>
          )}
        </div>

        <div className="p-8 pb-12 space-y-8">
          {error && (
            <div className="p-4 bg-gray-50 text-red-600 rounded-lg text-sm border border-red-200">
              <strong className="font-semibold block mb-1">Error</strong>
              {error}
            </div>
          )}

          {!authenticated ? (
            <div className="text-center py-12 text-gray-500">
              <p>Please connect your wallet to interact with StableTrust.</p>
            </div>
          ) : (
            <>
              {/* Account Status / Setup */}
              <div className="bg-white p-6 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold tracking-tight">
                    Account Status
                  </h2>
                  {loading && (
                    <span className="text-sm text-gray-500 animate-pulse">
                      Processing...
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-2 truncate">
                  <span className="font-medium text-black">Wallet:</span>{" "}
                  {user?.wallet?.address || "Connected"}
                </p>

                {!userKeys ? (
                  <div className="mt-4 p-4 border border-gray-200 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700 mb-3">
                      Your confidential account is not initialized.
                    </p>
                    <button
                      onClick={ensureAccount}
                      disabled={loading || !signer}
                      className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
                    >
                      Initialize Confidential Account
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-black flex items-center gap-2 font-medium">
                    <span className="w-2 h-2 rounded-full bg-black"></span>
                    Confidential Account Active
                  </p>
                )}
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-white border border-gray-200 rounded-xl shadow-sm text-center">
                  <p className="text-sm text-gray-500 font-medium mb-1 uppercase tracking-wider">
                    Public Balance
                  </p>
                  <p className="text-3xl font-bold font-mono text-black">
                    {balances.public}{" "}
                    <span className="text-lg text-gray-400">{tokenSymbol}</span>
                  </p>
                </div>
                <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm text-center">
                  <p className="text-sm text-gray-500 font-medium mb-1 uppercase tracking-wider">
                    Confidential Balance
                  </p>
                  <p className="text-3xl font-bold font-mono text-black">
                    {balances.confidential}{" "}
                    <span className="text-lg text-gray-400">{tokenSymbol}</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              {userKeys && (
                <div className="space-y-6 pt-4 border-t border-gray-200">
                  {/* Deposit section */}
                  <div>
                    <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wider">
                      Confidential Deposit
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none transition-all"
                      />
                      <button
                        onClick={handleDeposit}
                        disabled={loading || !depositAmount}
                        className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                      >
                        Deposit
                      </button>
                    </div>
                  </div>

                  {/* Transfer section */}
                  <div>
                    <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wider">
                      Confidential Transfer
                    </h3>
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="Recipient Address (0x...)"
                        value={transferRecipient}
                        onChange={(e) => setTransferRecipient(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none transition-all font-mono text-sm"
                      />
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={transferAmount}
                          onChange={(e) => setTransferAmount(e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none transition-all"
                        />
                        <button
                          onClick={handleTransfer}
                          disabled={
                            loading || !transferAmount || !transferRecipient
                          }
                          className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
                        >
                          Transfer
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Withdraw section */}
                  <div>
                    <h3 className="text-sm font-semibold text-black mb-3 uppercase tracking-wider">
                      Withdraw to Public
                    </h3>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-black focus:border-black outline-none transition-all"
                      />
                      <button
                        onClick={handleWithdraw}
                        disabled={loading || !withdrawAmount}
                        className="px-6 py-2 border border-gray-300 bg-white text-black rounded-lg hover:bg-gray-50 focus:ring-1 focus:ring-gray-300 outline-none disabled:opacity-50 transition-colors"
                      >
                        Withdraw
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
