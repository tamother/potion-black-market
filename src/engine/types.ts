import type { TownState, TownAction } from "./townTypes";
export const IDS = [
  "healing",
  "mana",
  "antidote",
  "invisibility",
  "berserk",
] as const;
export type ProductId = (typeof IDS)[number];
export type Faction = "kingdom" | "guild" | "black";
export type ChainId = "war" | "plague" | "smuggling";
export type OrderKind =
  | "army"
  | "warblack"
  | "doctor"
  | "smuggler"
  | "guild"
  | "royal"
  | "collector"
  | "clinic";
export interface Product {
  id: ProductId;
  name: string;
  buy: number;
  retail: number;
  demand: number;
  volatility: number;
  color: string;
  note: string;
}
export interface Batch {
  brewed?: number;
  id: string;
  product: ProductId;
  qty: number;
  cost: number;
  day: number;
}
export interface Market {
  buy: number;
  previous: number;
  reference: number;
  supply: number;
  remaining: number;
  factor: number;
  demand: number;
}
export interface Chain {
  stage: "idle" | "rumor" | "active" | "cooldown";
  start: number;
  end: number;
  cooldown: number;
  choice: string | null;
}
export interface Order {
  id: string;
  kind: OrderKind;
  product: ProductId;
  qty: number;
  reward: number;
  bulkRatio?: number;
  title: string;
  description: string;
  faction: Faction;
  rep: number;
  risk: number;
  status: "open" | "accepted" | "declined";
  day: number;
}
export interface Delayed {
  id: string;
  due: number;
  chain: ChainId;
  start: number;
  choice: string;
  kind: "army" | "warblack" | "clinic" | "smuggling";
}
export interface Effect {
  id: string;
  title: string;
  description: string;
  until: number;
  buy: Partial<Record<ProductId, number>>;
  demand: Partial<Record<ProductId, number>>;
  supply: Partial<Record<ProductId, number>>;
}
export interface Log {
  id: string;
  day: number;
  text: string;
  kind: "world" | "choice" | "risk" | "trade";
}
export interface DayBook {
  openingCash: number;
  purchases: number;
  orderRevenue: number;
  orderCogs: number;
  repaid: number;
  arrearsPaid: number;
  finance: number;
  staffCost: number;
  crystalCost: number;
  townCost: number;
  townUnits: number;
  openingRisk: number;
  openingRep: Record<Faction, number>;
}
export interface DemandBreakdown {
  baseDemand: number;
  eventMultiplier: number;
  price: number;
  reference: number;
  priceFactor: number;
  noise: number;
  raw: number;
  potential: number;
}
export interface SaleDetail extends DemandBreakdown {
  held?: number;
  stock: number;
  sold: number;
  revenue: number;
  cogs: number;
  expired: number;
}
export interface Ledger {
  townCost?: number;
  staffSalary?: number;
  careCost?: number;
  serviceCost?: number;
  storageCost?: number;
  permitCost?: number;
  runningPaid?: number;
  crystalCost?: number;
  incidentCashCost?: number;
  incidentStockCost?: number;
  repairCost?: number;
  incident?: HazardResult;
  staffCost?: number;
  day: number;
  revenue: number;
  orderRevenue: number;
  purchases: number;
  cogs: number;
  expired: number;
  expiryCost: number;
  fixed: number;
  fixedPaid: number;
  interest: number;
  fine: number;
  confiscationCost: number;
  quotes: Record<ProductId, Market>;
  operatingProfit: number;
  profit: number;
  cashFlow: number;
  cash: number;
  debt: number;
  arrears: number;
  assets: number;
  stock: number;
  sales: Record<ProductId, number>;
  saleDetails?: Record<ProductId, SaleDetail>;
  riskDelta: number;
  repDelta: Record<Faction, number>;
  notes: string[];
  repaid: number;
  arrearsPaid: number;
  finance: number;
}
export type HazardKind = "theft" | "spill" | "blackout" | "repair";
export interface Omen {
  kind: HazardKind | null;
  chance: number;
}
export interface HazardResult {
  kind: HazardKind;
  chance: number;
  actualChance: number;
  triggered: boolean;
  averted: boolean;
  cashLost: number;
  stockCost: number;
  repairCost: number;
  demandFactor: number;
  detail: string;
}
export interface GameState {
  version: 2;
  location: "shop" | "town";
  town: TownState;
  seed: number;
  rng: number;
  revision: number;
  day: number;
  cash: number;
  debt: number;
  capacity: number;
  arrears: number;
  defaultSince: number | null;
  status: "active" | "default" | "ended";
  reason: string | null;
  phase: "planning" | "report";
  batches: Batch[];
  market: Record<ProductId, Market>;
  prices: Record<ProductId, number>;
  reputation: Record<Faction, number>;
  risk: number;
  actions: number;
  actionPointsUsed: number;
  illegalToday: boolean;
  warningDay: number | null;
  strikes: number;
  financeUsed: boolean;
  accountantHiredDay: number | null;
  newsReadDay: number;
  crystalUnlockedDay: number | null;
  wardDay: number;
  lastIncidentDay: number | null;
  omen: Omen;
  chains: Record<ChainId, Chain>;
  delayed: Delayed[];
  effects: Effect[];
  eventCooldowns: Record<string, number>;
  orders: Order[];
  log: Log[];
  ledger: Ledger[];
  book: DayBook;
  news: string[];
  stats: { revenue: number; maxLoss: number; days: number };
  serial: number;
}
export type Action =
  | TownAction
  | { type: "buy"; product: string; qty: number }
  | { type: "price"; product: string; price: number }
  | { type: "order"; id: string; accept: boolean }
  | { type: "repay" | "arrears"; amount: number }
  | { type: "finance" }
  | { type: "hire-accountant" }
  | { type: "buy-crystal" | "ward" }
  | { type: "ack-news" }
  | { type: "end"; day: number }
  | { type: "ack" };
export interface Result {
  state: GameState;
  error?: string;
}
