import { TownWindow } from "../ui/TownWindow";
import { HonorsWindow } from "../ui/RelationsView";
import type { StationId } from "../world/model";
import type { UIProps } from "../ui/Window";
import { InventoryWindow } from "../ui/InventoryWindow";
import { TradeWindow } from "../ui/TradeWindow";
import { BoardWindow } from "../ui/BoardWindow";
import { LedgerWindow, FinanceWindow } from "../ui/BooksWindow";
import { VisitorWindow, CloseWindow } from "../ui/NarrativeWindows";
import { MerchantWindow, CrystalWindow } from "../ui/CrystalWindow";
export type Panel =
  StationId | "settings" | "rules" | "restart" | "news" | null;
export function ShopPanel({ id, ...props }: { id: StationId } & UIProps) {
  switch (id) {
    case "town-market":
      return <TownWindow {...props} faction="kingdom" />;
    case "town-guild":
      return <TownWindow {...props} faction="guild" />;
    case "town-alley":
      return <TownWindow {...props} faction="black" />;
    case "honors":
      return <HonorsWindow s={props.s} onClose={props.onClose} />;
    case "merchant":
      return <MerchantWindow {...props} />;
    case "crystal":
      return <CrystalWindow {...props} />;
    case "chest":
      return <InventoryWindow s={props.s} onClose={props.onClose} />;
    case "supplies":
      return <TradeWindow {...props} mode="purchase" />;
    case "shelves":
      return <TradeWindow {...props} mode="pricing" />;
    case "board":
      return (
        <BoardWindow
          s={props.s}
          dispatch={props.dispatch}
          onClose={props.onClose}
        />
      );
    case "ledger":
      return <LedgerWindow {...props} />;
    case "accountant":
      return <FinanceWindow s={props.s} onClose={props.onClose} />;
    case "visitor":
      return <VisitorWindow {...props} />;
    case "sign":
      return <CloseWindow {...props} />;
  }
}
