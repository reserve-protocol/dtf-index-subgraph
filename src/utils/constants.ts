import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

export const DEFAULT_DECIMALS = 18;
export const GENESIS_ADDRESS = "0x0000000000000000000000000000000000000000";
export const RSR_BURN_ADDRESS = "0x000000000000000000000000000000000000dead";

export const SECONDS_PER_DAY = 60 * 60 * 24;
export const SECONDS_PER_HOUR = 60 * 60;
export const SECONDS_PER_MONTH = 60 * 60 * 24 * 30; // 30 days approximation

export const BIGINT_ZERO = BigInt.fromI32(0);
export const BIGINT_ONE = BigInt.fromI32(1);
export const BIGINT_TWO = BigInt.fromI32(2);
export const BIGINT_D18 = BigInt.fromString("1000000000000000000");
export const DEFAULT_GOVERNANCE_PROPOSAL_THRESHOLD = BigInt.fromString(
  "1000000000000000",
);
export const BIGDECIMAL_ZERO = new BigDecimal(BIGINT_ZERO);
export const BIGDECIMAL_ONE = new BigDecimal(BIGINT_ONE);

export namespace TokenType {
  export const DTF = "DTF";
  export const VOTE = "VOTE";
  export const ASSET = "ASSET";
  export const BRIDGED_DTF = "BRIDGED_DTF";
}

export namespace TradeState {
  export const APPROVED = "APPROVED";
  export const LAUNCHED = "LAUNCHED";
  export const CLOSED = "CLOSED";
}

export namespace ProposalState {
  export const PENDING = "PENDING";
  export const ACTIVE = "ACTIVE";
  export const CANCELED = "CANCELED";
  export const DEFEATED = "DEFEATED";
  export const SUCCEEDED = "SUCCEEDED";
  export const QUEUED = "QUEUED";
  export const EXPIRED = "EXPIRED";
  export const EXECUTED = "EXECUTED";
}

export namespace VoteChoice {
  export const AGAINST_VALUE = 0;
  export const FOR_VALUE = 1;
  export const ABSTAIN_VALUE = 2;
  export const AGAINST = "AGAINST";
  export const FOR = "FOR";
  export const ABSTAIN = "ABSTAIN";
}

export namespace GovernanceType {
  export const OWNER = "OWNER";
  export const TRADING = "TRADING";
  export const VOTE_LOCKING = "VOTE_LOCKING";
}

export namespace Role {
  export const DEFAULT_ADMIN =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  export const BRAND_MANAGER =
    "0x2d8e650da9bd8c373ab2450d770f2ed39549bfc28d3630025cecc51511bcd374";
  export const REBALANCE_MANAGER =
    "4ff6ae4d6a29e79ca45c6441bdc89b93878ac6118485b33c8baa3749fc3cb130";
  export const AUCTION_LAUNCHER =
    "0x13ff1b2625181b311f257c723b5e6d366eb318b212d9dd694c48fcf227659df5";
  export const CANCELLER =
    "0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783";
  export const OPTIMISTIC_PROPOSER =
    "0x26f49d08685d9cdd4951a7470bc8fbe9dd0f00419c1a44c1b89f845867ae12e0";
  // @deprecated role (v4.0)
  export const AUCTION_APPROVER =
    "0x2be23b023f3eee571adc019cdcf3f0bcf041151e6ff405a4bf0c4bfc6faea8c9";
}

// FolioDeployers that are static data sources in networks.json, every chain, lowercase. The version
// registry spawns a deployer template only for addresses outside this list (a second source on the
// same deployer would index every deployment twice); parse-template checks networks.json against it.
export const STATIC_FOLIO_DEPLOYERS: string[] = [
  // mainnet
  "0xaafb13a3df7ce70c140e40c959d58fd5cc443cba",
  "0x4c64ef51cb057867e40114dcfa3702c2955d3644",
  "0xbe3b47587ceeff7d48008a0114f51cd571bec63a",
  "0x4d201a6e5bf975e2cee9e5cbdfc803c0ff122073",
  "0x2b1cd9aef0cd3b9ff5dca1c66348ecfc46f37392",
  // base
  "0xe926577a152ffd5f5036f88bf7e8e8d3652b558c",
  "0xb8469986840bc9b7bb101c274950c02842755911",
  "0xa203aa351723cf943f91684e9f5efca7175ae7ea",
  "0x3451fd177e9a8bb4eb8271e627a804bd22a816f9",
  "0x4c891fca6319d492866672e3d2afdaaa5bdcff67",
  // bsc
  "0x100e0efdd7a4f67825e1be5f0493f8d2aeac00bb",
  "0x5bed18aca50e6057e6658fe8498004092eedcdcf",
  "0x72f87239981159ed23673012ee3806ca6114ab2a",
  "0x9837ce9825d52672ca02533b5a160212bf901963",
];
