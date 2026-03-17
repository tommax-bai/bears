## ADDED Requirements

### Requirement: Administrators can review messages through a moderation queue
The system SHALL provide an admin moderation queue that lists pending, approved, rejected, and hidden messages with filter and search capabilities. Administrators MUST be able to inspect message details before taking action.

#### Scenario: Administrator filters pending messages
- **WHEN** an administrator opens the moderation queue and filters by pending status
- **THEN** the system shows only messages awaiting review
- **THEN** the administrator can open a message detail view without leaving the moderation workflow

### Requirement: Administrators can change message visibility state
The system SHALL allow administrators to approve, reject, hide, and restore messages according to the defined lifecycle. State transitions MUST update public visibility consistently and MUST be reflected immediately in the admin interface.

#### Scenario: Administrator approves a pending message
- **WHEN** an administrator approves a pending message
- **THEN** the system changes the message state to approved
- **THEN** the message becomes eligible for display on the public board
- **THEN** the admin interface reflects the updated state without requiring manual data correction

#### Scenario: Administrator hides an approved message
- **WHEN** an administrator hides a previously approved message
- **THEN** the system removes the message from the public board
- **THEN** the message remains available in the admin interface with its hidden status

### Requirement: Administrators can perform efficient review actions on mobile and desktop
The admin interface MUST support responsive layouts that preserve core moderation actions on mobile screens as well as desktop screens. High-frequency actions such as approve and reject MUST remain accessible without requiring hover-only or precision-dependent interactions.

#### Scenario: Administrator moderates from a phone
- **WHEN** an administrator opens the moderation interface on a mobile viewport
- **THEN** the system provides touch-friendly controls for the primary moderation actions
- **THEN** filters and secondary metadata are available through responsive patterns such as drawers or collapsible panels

### Requirement: Moderation actions are auditable
The system MUST record each moderation action with the operator identity, timestamp, action type, optional note, and resulting message state. Administrators MUST be able to view the audit history for an individual message.

#### Scenario: Administrator reviews audit history
- **WHEN** an administrator opens a message detail view after one or more moderation actions have occurred
- **THEN** the system displays the chronological audit trail for that message
- **THEN** each audit entry includes who performed the action, when it happened, and what state transition occurred

### Requirement: Administrators can process messages in batches
The system SHALL allow administrators to select multiple messages and apply batch moderation actions where the action is valid for all selected records. If part of the selection cannot accept the chosen action, the system MUST explain the conflict before completion.

#### Scenario: Administrator performs batch approval
- **WHEN** an administrator selects multiple pending messages and chooses approve
- **THEN** the system approves all valid selected messages in one operation
- **THEN** the moderation queue refreshes to show the updated states

#### Scenario: Batch action contains invalid state combinations
- **WHEN** an administrator selects messages with incompatible states for the requested batch action
- **THEN** the system blocks the batch operation or excludes invalid items according to policy
- **THEN** the interface explains which records could not be processed and why
