import {
  type PoolAsset,
  type Transaction,
  type Trade,
  type Hop,
  type Amount,
  calculateDiffToRef,
  bnum,
  BigNumber,
  TradeRouter,
} from '@galacticcouncil/sdk';
import type { PalletDcaOrder } from '@polkadot/types/lookup';

import { TradeConfig, tradeSettingsCursor } from '../db';
import { getTradeMaxAmountIn, getTradeMinAmountOut } from './slippage';
import { HOUR_MS } from './time';
import { formatAmount } from '../utils/amount';

export const TWAP_BLOCK_PERIOD = 5;
export const TWAP_MAX_PRICE_IMPACT = -5;
export const TWAP_RETRIES = 1;

const TWAP_MAX_DURATION = 3 * HOUR_MS;
const TWAP_TX_MULTIPLIER = 3;

export type TradeInfo = {
  trade: Trade;
  transaction: Transaction;
  slippage: string;
};

export type TradeTwap = {
  trade: Trade;
  tradeReps: number;
  tradeTime: number;
  tradeError: TradeTwapError;
  budget: number;
  orderSlippage: Amount;
  order: PalletDcaOrder;
};

export enum TradeTwapError {
  OrderTooSmall = 'OrderTooSmall',
  OrderTooBig = 'OrderTooBig',
  OrderImpactTooBig = 'OrderImpactTooBig',
}

export class TradeApi {
  private _router: TradeRouter;
  private _config: TradeConfig;

  public constructor(router: TradeRouter) {
    this._router = router;
    this._config = tradeSettingsCursor.deref();
  }

  async getSell(assetIn: PoolAsset, assetOut: PoolAsset, amountIn: string): Promise<TradeInfo> {
    const bestSell = await this._router.getBestSell(assetIn.id, assetOut.id, amountIn);
    const minAmountOut = getTradeMinAmountOut(bestSell, this._config.slippage);
    const minAmountOutHuman = formatAmount(minAmountOut.amount, minAmountOut.decimals);
    const transaction = bestSell.toTx(minAmountOut.amount);

    return {
      trade: bestSell,
      transaction: transaction,
      slippage: minAmountOutHuman,
    } as TradeInfo;
  }

  async getBuy(assetIn: PoolAsset, assetOut: PoolAsset, amountOut: string): Promise<TradeInfo> {
    const bestBuy = await this._router.getBestBuy(assetIn.id, assetOut.id, amountOut);
    const maxAmountIn = getTradeMaxAmountIn(bestBuy, this._config.slippage);
    const maxAmountInHuman = formatAmount(maxAmountIn.amount, maxAmountIn.decimals);
    const transaction = bestBuy.toTx(maxAmountIn.amount);

    return {
      trade: bestBuy,
      transaction: transaction,
      slippage: maxAmountInHuman,
    } as TradeInfo;
  }

  getSellPriceDifference(amountIn: number, spotPrice: number, swaps: []): BigNumber {
    const lastSwap = swaps[swaps.length - 1];
    const calculatedOut = lastSwap['calculatedOut'];
    const calculatedOutBN = bnum(calculatedOut);
    const swapAmount = amountIn * spotPrice;
    const swapAmountBN = bnum(swapAmount);
    return calculateDiffToRef(swapAmountBN, calculatedOutBN);
  }

  private getOptimizedTradesNo(priceDifference: number, blockTime: number): number {
    const noOfTrades = Math.round(priceDifference * 10) || 1;
    const executionTime = noOfTrades * TWAP_BLOCK_PERIOD * blockTime;

    if (executionTime > TWAP_MAX_DURATION) {
      const maxNoOfTrades = TWAP_MAX_DURATION / (blockTime * TWAP_BLOCK_PERIOD);
      return Math.round(maxNoOfTrades);
    }
    return noOfTrades;
  }

  private getTwapTxFee(tradesNo: number, txFee: number): number {
    const twapTxFee = txFee * TWAP_TX_MULTIPLIER;
    const twapTxFeeWithRetries = twapTxFee * (TWAP_RETRIES + 1);
    return twapTxFeeWithRetries * tradesNo;
  }

  private getTwapExecutionTime(tradesNo: number, blockTime: number): number {
    return tradesNo * TWAP_BLOCK_PERIOD * blockTime;
  }

  private hasSwapErrors(trade: Trade) {
    const swaps = trade.swaps;
    const swapWithError: any = swaps.find((swap: any) => swap.errors.length > 0);
    return !!swapWithError;
  }

  async getSellTwap(
    assetIn: PoolAsset,
    assetOut: PoolAsset,
    amountIn: number,
    amountMin: number,
    txFee: number,
    priceDifference: number,
    blockTime: number
  ): Promise<TradeTwap> {
    const tradesNo = this.getOptimizedTradesNo(priceDifference, blockTime);
    const tradeTime = this.getTwapExecutionTime(tradesNo, blockTime);
    const twapTxFees = this.getTwapTxFee(tradesNo, txFee);
    const amountInPerTrade = (amountIn - twapTxFees) / tradesNo;
    const bestSell = await this._router.getBestSell(assetIn.id, assetOut.id, amountInPerTrade.toString());
    const bestSellRoute = bestSell.swaps.map(({ assetIn, assetOut }: Hop) => {
      return { pool: 'Omnipool', assetIn, assetOut };
    });

    const minAmountOut = getTradeMinAmountOut(bestSell, this._config.slippage);

    const isSingleTrade = tradesNo == 1;
    const isLessThanMinimalAmount = amountInPerTrade < amountMin;
    const isOrderImpactTooBig = bestSell.priceImpactPct < TWAP_MAX_PRICE_IMPACT;

    let tradeError: TradeTwapError = null;
    if (isLessThanMinimalAmount || isSingleTrade) {
      tradeError = TradeTwapError.OrderTooSmall;
    } else if (isOrderImpactTooBig) {
      tradeError = TradeTwapError.OrderImpactTooBig;
    }

    return {
      trade: bestSell,
      tradeReps: tradesNo,
      tradeTime: tradeTime,
      tradeError: tradeError,
      budget: amountIn,
      orderSlippage: minAmountOut,
      order: {
        Sell: {
          assetIn: assetIn.id,
          assetOut: assetOut.id,
          amountIn: bestSell.amountIn.toString(),
          minAmountOut: minAmountOut.amount.toFixed(),
          route: bestSellRoute,
        },
      } as unknown as PalletDcaOrder,
    } as TradeTwap;
  }

  async getBuyTwap(
    assetIn: PoolAsset,
    assetOut: PoolAsset,
    amountOut: number,
    amountMin: number,
    txFee: number,
    priceDifference: number,
    blockTime: number
  ): Promise<TradeTwap> {
    const tradesNo = this.getOptimizedTradesNo(priceDifference, blockTime);
    const tradeTime = this.getTwapExecutionTime(tradesNo, blockTime);
    const twapTxFees = this.getTwapTxFee(tradesNo, txFee);
    const amountOutPerTrade = amountOut / tradesNo;
    const bestBuy = await this._router.getBestBuy(assetIn.id, assetOut.id, amountOutPerTrade.toString());
    const bestBuyRoute = bestBuy.swaps.map(({ assetIn, assetOut }: Hop) => {
      return { pool: 'Omnipool', assetIn, assetOut };
    });

    const maxAmountIn = getTradeMaxAmountIn(bestBuy, this._config.slippage);
    const maxAmountInStr = formatAmount(maxAmountIn.amount, maxAmountIn.decimals);
    const maxBudget = Number(maxAmountInStr) * tradesNo + twapTxFees;

    const isSingleTrade = tradesNo == 1;
    const isLessThanMinimalAmount = Number(maxAmountInStr) < amountMin;
    const isOrderTooBig = priceDifference == 100;

    let tradeError: TradeTwapError = null;
    if (isLessThanMinimalAmount || isSingleTrade) {
      tradeError = TradeTwapError.OrderTooSmall;
    } else if (isOrderTooBig) {
      tradeError = TradeTwapError.OrderTooBig;
    }

    return {
      trade: bestBuy,
      tradeReps: tradesNo,
      tradeTime: tradeTime,
      tradeError: tradeError,
      budget: maxBudget,
      orderSlippage: maxAmountIn,
      order: {
        Buy: {
          assetIn: assetIn.id,
          assetOut: assetOut.id,
          amountOut: bestBuy.amountOut.toString(),
          maxAmountIn: maxAmountIn.amount.toFixed(),
          route: bestBuyRoute,
        },
      } as unknown as PalletDcaOrder,
    } as TradeTwap;
  }
}
