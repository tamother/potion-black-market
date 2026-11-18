import type { Faction, ProductId } from "./types";
export const FACTION_IDS = ["guild", "kingdom", "black"] as const;
export type SupplySource = "spot" | "reserve" | "official" | "black";
export interface ContractLine {
  product: ProductId;
  qty: number;
}
export interface Contract {
  id: string;
  faction: Faction;
  title: string;
  client: string;
  lines: ContractLine[];
  posted: number;
  deadline: number;
  reward: number;
  rep: number;
  key: boolean;
  step: number;
  status:
    "offered" | "active" | "fulfilled" | "declined" | "failed" | "cancelled";
  reserve: boolean;
}
export interface Delivery {
  id: string;
  product: ProductId;
  qty: number;
  cost: number;
  due: number;
}
export interface TownState {
  met: Record<Faction, boolean>;
  keys: Record<Faction, number>;
  announced: Record<Faction, number>;
  routine: Record<string, number>;
  offers: Contract[];
  contracts: Contract[];
  deliveries: Delivery[];
  supplyDay: number;
  used: Record<SupplySource, number>;
  intelDay: number;
  knownForecast: number;
}
export type TownAction =
  | { type: "travel"; location: "shop" | "town" }
  | { type: "meet"; faction: Faction }
  | { type: "town-buy"; source: SupplySource; product: string; qty: number }
  | {
      type: "contract";
      id: string;
      choice: "accept" | "decline" | "deliver" | "cancel";
    }
  | { type: "reserve-contract"; id: string; reserve: boolean }
  | { type: "intel" };
export function newTown(): TownState {
  return {
    met: { guild: false, kingdom: false, black: false },
    keys: { guild: 0, kingdom: 0, black: 0 },
    announced: { guild: 0, kingdom: 0, black: 0 },
    routine: {},
    offers: [],
    contracts: [],
    deliveries: [],
    supplyDay: 0,
    used: { spot: 0, reserve: 0, official: 0, black: 0 },
    intelDay: 0,
    knownForecast: 0,
  };
}
