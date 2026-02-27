"use client";

import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { ConfidentialTransferClient } from "@fairblock/stabletrust";

// Minimal configuration for the example page
export interface ConfidentialConfig {
  rpcUrl: string;
  tokenAddress: string;
  chainId: number;
}

const DEFAULT_CONFIG: ConfidentialConfig = {
  // Using public base sepolia rpc or environment variable fallback
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://base-sepolia.drpc.org",
  // Expected contract and token addresses (or from env)
  tokenAddress:
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532"),
};

export function useConfidentialClient() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();

  const [config] = useState<ConfidentialConfig>(DEFAULT_CONFIG);
  const [client, setClient] = useState<ConfidentialTransferClient | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  type UserKeys = { publicKey: string; privateKey: string } | null;
  const [userKeys, setUserKeys] = useState<UserKeys>(null);

  const [balances, setBalances] = useState({
    public: "0",
    confidential: "0",
    native: "0",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tokenSymbol, setTokenSymbol] = useState("TKN");
  const [tokenDecimals, setTokenDecimals] = useState(18);

  useEffect(() => {
    async function fetchTokenDetails() {
      if (!config.tokenAddress || !config.rpcUrl) return;
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const tokenContract = new ethers.Contract(
          config.tokenAddress,
          [
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
          ],
          provider,
        );

        const [sym, dec] = await Promise.all([
          tokenContract.symbol().catch(() => "TKN"),
          tokenContract.decimals().catch(() => 18),
        ]);

        setTokenSymbol(sym);
        setTokenDecimals(Number(dec));
      } catch (err) {
        console.warn("Failed to fetch token details", err);
      }
    }
    fetchTokenDetails();
  }, [config.tokenAddress, config.rpcUrl]);

  // 1. Initialize stabletrust client
  useEffect(() => {
    try {
      const c = new ConfidentialTransferClient(config.rpcUrl, config.chainId);
      setClient(c);
    } catch (err) {
      console.error("Failed to initialize ConfidentialTransferClient:");
      console.error(err);
    }
  }, [config.rpcUrl, config.chainId]);

  // 2. Setup signer from Privy wallet
  useEffect(() => {
    async function setupSigner() {
      if (authenticated && wallets.length > 0) {
        const wallet = wallets[0];
        try {
          await wallet.switchChain(config.chainId);
          const provider = await wallet.getEthereumProvider();
          const ethersProvider = new ethers.BrowserProvider(provider);
          const s = await ethersProvider.getSigner();
          setSigner(s);
        } catch (err) {
          console.error("Failed to setup signer:", err);
        }
      } else {
        setSigner(null);
        setUserKeys(null);
        setBalances({ public: "0", confidential: "0", native: "0" });
      }
    }
    setupSigner();
  }, [authenticated, wallets, config.chainId]);

  // 4. Confidential Account Initialization (FHE Key Generation)
  // This prompts the user to sign a message generating their keypair on the active chain.
  // It is required before a user can utilize confidential balances inside the SDK.
  const ensureAccount = useCallback(async () => {
    if (!client || !signer) return;
    setLoading(true);
    setError(null);
    try {
      const keys = await client.ensureAccount(signer);
      setUserKeys(keys);
      return keys;
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to initialize confidential account";
      setError(msg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [client, signer]);

  // Fetch balances
  const fetchBalances = useCallback(
    async (silent = false) => {
      if (!signer) return;
      if (!silent) setLoading(true);

      try {
        const address = await signer.getAddress();
        const provider =
          signer.provider || new ethers.JsonRpcProvider(config.rpcUrl);

        const nativeBal = await provider.getBalance(address);
        let publicBal = BigInt(0);
        let confidentialBal = BigInt(0);

        // Public stabletrust token balance
        if (client) {
          try {
            publicBal = await client.getPublicBalance(
              address,
              config.tokenAddress,
            );
          } catch (e) {
            console.warn("Could not fetch public balance", e);
          }
        }

        // Confidential stabletrust token balance
        if (client && userKeys) {
          try {
            const cb = await client.getConfidentialBalance(
              address,
              userKeys.privateKey,
              config.tokenAddress,
            );
            confidentialBal = BigInt(cb.amount);
          } catch (e) {
            console.warn("Could not fetch confidential balance", e);
          }
        }

        setBalances({
          public: ethers.formatUnits(publicBal, tokenDecimals),
          confidential: ethers.formatUnits(confidentialBal, tokenDecimals),
          native: ethers.formatEther(nativeBal),
        });
      } catch (err) {
        console.error("Balance fetch error:", err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [
      client,
      signer,
      userKeys,
      config.tokenAddress,
      config.rpcUrl,
      tokenDecimals,
    ],
  );

  // Auto-fetch balances when signer or keys change
  useEffect(() => {
    if (signer) {
      fetchBalances(true);
      const interval = setInterval(() => fetchBalances(true), 10000);
      return () => clearInterval(interval);
    }
  }, [fetchBalances, signer]);

  // 6. Confidential Deposit (Public -> Confidential)
  // Transfers public tokens into a user's encrypted, confidential balance.
  // The 'amountWei' must be a literal BigInt scaled to the token's active on-chain decimals.
  const confidentialDeposit = useCallback(
    async (amountStr: string) => {
      if (!client || !signer) throw new Error("Not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amountStr, tokenDecimals);
        const receipt = await client.confidentialDeposit(
          signer,
          config.tokenAddress,
          amountWei,
        );
        setTimeout(() => fetchBalances(true), 2000);
        return receipt;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Deposit failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, tokenDecimals, config.tokenAddress, fetchBalances],
  );

  // 7. Confidential Transfer (Confidential -> Confidential)
  // Sends an encrypted balance privately from one user to another.
  const confidentialTransfer = useCallback(
    async (recipient: string, amountStr: string) => {
      if (!client || !signer) throw new Error("Not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amountStr, tokenDecimals);
        const receipt = await client.confidentialTransfer(
          signer,
          recipient,
          config.tokenAddress,
          Number(amountWei), // client takes number for confidential amounts natively based on token decimals currently internally
        );
        setTimeout(() => fetchBalances(true), 2000);
        return receipt;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Transfer failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, tokenDecimals, config.tokenAddress, fetchBalances],
  );

  // 8. Withdraw (Confidential -> Public)
  // Removes funds from the encrypted balance layer, putting them back into the user's public address space.
  const withdraw = useCallback(
    async (amountStr: string) => {
      if (!client || !signer) throw new Error("Not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amountStr, tokenDecimals);
        const receipt = await client.withdraw(
          signer,
          config.tokenAddress,
          Number(amountWei),
        );
        setTimeout(() => fetchBalances(true), 2000);
        return receipt;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Withdraw failed";
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, tokenDecimals, config.tokenAddress, fetchBalances],
  );

  return {
    client,
    signer,
    userKeys,
    balances,
    loading,
    error,
    tokenSymbol,
    ensureAccount,
    fetchBalances,
    confidentialDeposit,
    confidentialTransfer,
    withdraw,
  };
}
