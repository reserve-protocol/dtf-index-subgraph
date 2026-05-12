# Optimistic Governance

Index DTFs can use either standard governance or the newer optimistic governor.
`Governance.isOptimistic` is only the support-detection flag; `Proposal.isOptimistic` is the proposal-level discriminator.

## Standard Governance

Standard governance uses the existing governor flow:

- `ProposalCreated` creates a `Proposal` with normal voting dates and quorum.
- `VoteCast` weight comes from standard vote-lock delegation.
- `ProposalQueued` links the proposal to a timelock operation.
- `ProposalExecuted` marks the proposal executed after timelock execution.

## Optimistic Governance

Optimistic governance uses the same governor template but exposes additional reads:

- `optimisticParams()` is the governance-level support probe.
- If `optimisticParams()` succeeds, the subgraph records optimistic support and stores veto delay, veto period, and veto threshold.
- `isOptimistic(proposalId)` is proposal-level only. The subgraph calls it when handling `ProposalCreated` and stores `Proposal.isOptimistic`.
- Optimistic proposals use `Against` votes as veto votes. Their proposal-specific veto threshold is stored on `Proposal.vetoThreshold` when available.

The optimistic vote-lock flow is separate from standard delegation:

- `OptimisticDelegateChanged` updates `AccountBalance.optimisticDelegate` and the optimistic holder count on the same `Delegate` entity.
- `OptimisticDelegateVotesChanged` updates `Delegate.optimisticDelegatedVotesRaw`, `Delegate.optimisticDelegatedVotes`, and optimistic totals on `StakingToken`.
- `totalDelegates` and `totalOptimisticDelegates` are counted separately, so an address can be a standard delegate, an optimistic delegate, or both.
- All votes set `Vote.voter` and appear under `Delegate.votes`.
- `Proposal.isOptimistic` marks whether votes belong to optimistic governance.
- `Delegate.numberVotes` and `Delegate.numberOptimisticVotes` are tracked separately.

Optimistic timelocks expose enumerable role reads. When available, the subgraph reads optimistic proposers from the timelock and tracks timelock `CANCELLER_ROLE` members as `GovernanceTimelock.guardians` for Register settings views.
