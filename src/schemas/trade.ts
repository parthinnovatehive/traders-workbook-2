import { z } from 'zod';
import { MARKETS, MISTAKE_CODES, PSYCH_CODES } from '@/constants/journal';
import type { Market, MistakeCode, PsychCode } from '@/types';
import { TRADE_DIRECTIONS, type TradeDirection } from '@/types';

const marketEnum = z.enum(MARKETS as unknown as [Market, ...Market[]]);
const directionEnum = z.enum(TRADE_DIRECTIONS as unknown as [TradeDirection, ...TradeDirection[]]);
const psychEnum = z.enum(PSYCH_CODES as unknown as [PsychCode, ...PsychCode[]]);
const mistakeEnum = z.enum(MISTAKE_CODES as unknown as [MistakeCode, ...MistakeCode[]]);

/** Parsed & validated trade input (numbers are already numbers here). */
export const tradeSchema = z.object({
  symbol: z.string().trim().min(1, 'Symbol is required').max(20),
  market: marketEnum,
  direction: directionEnum,
  entryDate: z.string().min(1, 'Entry date is required'),
  entryTime: z.string().optional(),
  exitDate: z.string().optional(),
  exitTime: z.string().optional(),
  entryPrice: z.number({ message: 'Entry price is required' }).positive('Must be greater than 0'),
  exitPrice: z.number().positive('Must be greater than 0').nullable(),
  quantity: z.number({ message: 'Quantity is required' }).positive('Must be greater than 0'),
  stopLoss: z.number().positive('Must be greater than 0').nullable(),
  target: z.number().positive('Must be greater than 0').nullable(),
  charges: z.number().min(0, 'Cannot be negative'),
  strategyId: z.string().nullable(),
  setup: z.string().optional(),
  marketCondition: z.string().optional(),
  notes: z.string().optional(),
  psychology: z.array(psychEnum),
  mistakes: z.array(mistakeEnum),
});

export type TradeInput = z.infer<typeof tradeSchema>;
