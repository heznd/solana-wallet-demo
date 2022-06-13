// @ts-nocheck
import "./App.css";

import {
  Liquidity,
  Percent,
  Token,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import { createTransferCheckedInstruction } from "@solana/spl-token";
import {
  WalletAdapterNetwork,
  WalletNotConnectedError,
} from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  useConnection,
  useWallet,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import {
  WalletDisconnectButton,
  WalletModalProvider,
  WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {
  BitKeepWalletAdapter,
  BitpieWalletAdapter,
  CloverWalletAdapter,
  Coin98WalletAdapter,
  CoinhubWalletAdapter,
  ExodusWalletAdapter,
  GlowWalletAdapter,
  LedgerWalletAdapter,
  MathWalletAdapter,
  PhantomWalletAdapter,
  SafePalWalletAdapter,
  SlopeWalletAdapter,
  SolflareWalletAdapter,
  SolletExtensionWalletAdapter,
  SolletWalletAdapter,
  SolongWalletAdapter,
  TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  clusterApiUrl,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import React, { FC, useCallback, useMemo } from "react";

import { getOrCreateAssociatedTokenAccount } from "./transfer";
import { getTokenAccountsByOwner } from "./util";
import { fetchDevPoolKeys } from "./util_devnet";

// import { Token as SplToken } from "@solana/spl-token";

// Default styles that can be overridden by your app
require("@solana/wallet-adapter-react-ui/styles.css");

function App() {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
  const network = WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint.
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking and lazy loading --
  // Only the wallets you configure here will be compiled into your application, and only the dependencies
  // of wallets that your users connect to will be loaded.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new SolletWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
      new SolletExtensionWalletAdapter(),
      new MathWalletAdapter({ network }),
      new SolongWalletAdapter({ network }),
      new Coin98WalletAdapter({ network }),
      new SafePalWalletAdapter({ network }),
      new SlopeWalletAdapter({ network }),
      new BitpieWalletAdapter({ network }),
      new GlowWalletAdapter({ network }),
      new BitKeepWalletAdapter({ network }),
      new ExodusWalletAdapter({ network }),
      new CloverWalletAdapter(),
      new CoinhubWalletAdapter(),
    ],
    [network]
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletMultiButton />
          <WalletDisconnectButton />
          <SendLamports />
          <TransferSplToken />
          <LiquiditySwap />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default App;

export const SendLamports: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const onClick = useCallback(async () => {
    if (!publicKey) throw new WalletNotConnectedError();

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      })
    );

    const signature = await sendTransaction(transaction, connection);
    console.log(signature);
    await connection.confirmTransaction(signature, "processed");
  }, [publicKey, sendTransaction, connection]);

  return (
    <button onClick={onClick} disabled={!publicKey}>
      Send 1 lamport to a random address!
    </button>
  );
};

export const LiquiditySwap: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const liquiditySwap = useCallback(async () => {
    if (!publicKey) throw new WalletNotConnectedError();
    const wSOL = {
      address: "So11111111111111111111111111111111111111112",
      decimals: 9,
    };
    const USDT = {
      address: "8FRFC6MoGGkMFQwngccyu69VnYbzykGeez7ignHVAFSN",
      decimals: 6,
    };
    const token0 = wSOL;
    const token1 = USDT;
    const amountIn = 10000000;
    // SOL_USDT POOL DEV ammId
    const SOL_USDT_AMMM_ID = "384zMi9MbUKVUfkUdrnuMfWBwJR9gadSxYimuXeJ9DaJ";

    // FIDA-SOL POOL DEV ammId
    const FIDA_SOL = "ER3u3p9TGyA4Sc9VCJrkLq4hR73GFW8QAzYkkz8rSwsk";
    // RAY_USDC POOL DEV ammId
    // const RAY_USDC = "ELSGBb45rAQNsMTVzwjUqL8vBophWhPn4rNbqwxenmqY"

    // const POOL_ID = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";

    const POOL_ID = SOL_USDT_AMMM_ID;
    // const allPoolKeys = await fetchAllPoolKeys(connection);
    // const poolKeys = allPoolKeys.find((item) => item.id.toBase58() === RAY_USDC)
    const poolKeys = await fetchDevPoolKeys(connection, new PublicKey(POOL_ID));
    // const poolKeys = await fetchPoolKeys(connection, new PublicKey(POOL_ID));

    console.log(poolKeys.baseMint.toBase58());

    console.log(poolKeys.quoteMint.toBase58());
    const poolInfo = await Liquidity.fetchInfo({ connection, poolKeys });
    console.log(poolInfo);

    const owner = publicKey;
    const tokenAccounts = await getTokenAccountsByOwner(connection, owner);
    // real amount = 1000000 / 10**poolInfo.baseDecimals
    const tokenAmountIn = new TokenAmount(
      new Token(new PublicKey(token0.address), token0.decimals),
      amountIn,
      true
    );

    const currencyOut = new Token(
      new PublicKey(token1.address),
      token1.decimals
    );

    // 5% slippage
    const slippage = new Percent(5, 100);

    const {
      amountOut,
      minAmountOut,
      currentPrice,
      executionPrice,
      priceImpact,
      fee,
    } = Liquidity.computeAmountOut({
      poolKeys,
      poolInfo,
      amountIn: tokenAmountIn,
      currencyOut,
      slippage,
    });

    // @ts-ignore
    // console.log(amountOut.toFixed(), minAmountOut.toFixed(), currentPrice.toFixed(), executionPrice.toFixed(), priceImpact.toFixed(), fee.toFixed())
    console.log(
      `swap: ${poolKeys.id.toBase58()}, amountIn: ${tokenAmountIn.toFixed()}, amountOut: ${amountOut.toFixed()}, executionPrice: ${executionPrice?.toFixed()}`
    );

    // const minAmountOut = new TokenAmount(new Token(poolKeys.quoteMint, poolInfo.quoteDecimals), 1000000)

    const { transaction, signers } = await Liquidity.makeSwapTransaction({
      connection,
      poolKeys,
      userKeys: {
        tokenAccounts,
        owner,
      },
      amountIn: tokenAmountIn,
      amountOut: minAmountOut,
      fixedSide: "in",
    });

    // await sendTx(connection, transaction, [ownerKeypair, ...signers]);
    const txid = await sendTransaction(transaction, connection, {
      signers,
      skipPreflight: true,
    });
    console.log(`swap end: ${txid}`);
  }, [publicKey, sendTransaction, connection]);

  return (
    <button onClick={liquiditySwap} disabled={!publicKey}>
      Liquidity swap
    </button>
  );
};

export const TransferSplToken: FC = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const liquiditySwap = useCallback(async () => {
    if (!publicKey) throw new WalletNotConnectedError();

    const mint = new PublicKey("8FRFC6MoGGkMFQwngccyu69VnYbzykGeez7ignHVAFSN");
    const to = new PublicKey("7m1pg7NGCazuLc8RQQdmsujEp9VeificdcDNsYRVFXzh");
    const amount = 1000000;
    const decimals = 6;
    try {
      const fromTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        publicKey,
        mint,
        publicKey,
        sendTransaction,
        "confirmed"
      );

      const toTokenAccount = await getOrCreateAssociatedTokenAccount(
        connection,
        publicKey,
        mint,
        to,
        sendTransaction,
        "confirmed"
      );

      const transaction = new Transaction().add(
        createTransferCheckedInstruction(
          fromTokenAccount.address, // source
          mint,
          toTokenAccount.address, // dest
          publicKey,
          amount,
          decimals
        )
      );

      // step 2: sign&send transaction
      const txid = await sendTransaction(transaction, connection);

      console.log(`transfer hash: ${txid}`);

      const latestBlockHash = await connection.getLatestBlockhash();

      const result = await connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: txid,
      });
      if (result.context.slot) {
        return true;
      }
      console.log(`result: ${JSON.stringify(result)}`);
    } catch (err) {
      // err handle
    }
  }, [publicKey, sendTransaction, connection]);

  return (
    <button onClick={liquiditySwap} disabled={!publicKey}>
      Transfer Spl
    </button>
  );
};

export const token0 = {
  address: "So11111111111111111111111111111111111111112",
  decimals: 9,
};
export const token1 = {
  address: "8FRFC6MoGGkMFQwngccyu69VnYbzykGeez7ignHVAFSN",
  decimals: 9,
};
export const amountIn = 1000000;
