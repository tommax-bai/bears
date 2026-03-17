## ADDED Requirements

### Requirement: Mobile visitors can browse approved messages efficiently
The system SHALL present a mobile-first message list that prioritizes readability, fast scanning, and one-handed use. Only approved messages MUST appear in the public list. Each visible message MUST show at least the display name, message content, and publish time.

#### Scenario: Visitor opens the message board on a phone
- **WHEN** a visitor opens the public message board on a mobile viewport
- **THEN** the system displays a vertically scrolling list optimized for narrow screens
- **THEN** each item shows only approved content
- **THEN** the primary submission action remains easy to reach without requiring desktop-only interactions

### Requirement: Visitors can submit a message with immediate validation feedback
The system SHALL allow visitors to submit a message from the public board using a lightweight form. The form MUST validate required fields, text length, and blocked content before accepting the submission. After successful submission, the system MUST clearly communicate that the message is pending review unless auto-approval is explicitly enabled.

#### Scenario: Valid message submission enters review
- **WHEN** a visitor submits a message that passes client and server validation
- **THEN** the system stores the message in a pending state
- **THEN** the public board does not display the new message until it is approved
- **THEN** the visitor sees a confirmation state explaining the review step

#### Scenario: Invalid message is rejected before submission completes
- **WHEN** a visitor submits a message with missing required fields, excessive length, or blocked content
- **THEN** the system rejects the submission
- **THEN** the visitor receives actionable validation feedback
- **THEN** no public message is created

### Requirement: Submission flow is protected against basic abuse
The system MUST protect the public submission flow with rate limiting and duplicate-submission safeguards. Repeated requests from the same source within a restricted window MUST be throttled, and repeated identical content within a configured interval MUST be rejected or flagged for moderation.

#### Scenario: Visitor posts too frequently
- **WHEN** a visitor exceeds the configured submission frequency threshold
- **THEN** the system blocks the new submission attempt
- **THEN** the visitor receives a rate-limit response that does not expose internal rule details

#### Scenario: Visitor repeats the same message content
- **WHEN** a visitor submits identical content within the duplicate-detection window
- **THEN** the system rejects or flags the submission according to moderation policy
- **THEN** the event is available for administrators to review if it is flagged
