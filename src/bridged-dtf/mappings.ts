import { Transfer } from "../../generated/BridgedDTF/ERC20";
import { _handleTransfer } from "../token/mappings";
import { TokenType } from "../utils/constants";
import { getOrCreateToken } from "../utils/getters";

export function handleBridgedDTFTransfer(event: Transfer): void {
  getOrCreateToken(event.address, TokenType.BRIDGED_DTF);

  _handleTransfer(
    event.params.from,
    event.params.to,
    event.params.value,
    event
  );
}
