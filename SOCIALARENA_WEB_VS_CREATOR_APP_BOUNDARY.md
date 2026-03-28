# SocialArena Web vs Creator App Boundary

## Purpose

This document defines the product boundary between the SocialArena web platform and the standalone SocialArena Creator App.

It exists to stop product drift, reduce duplicated surfaces, and make it clear where new features should live.

This is a system-level product and architecture decision, not just a UI preference.

## Decision Summary

SocialArena should operate as one platform with two role-specific clients:

- **SocialArena Web**
  - studio operations, oversight, collaboration, analytics, and publishing management
- **SocialArena Creator App**
  - idea development, AI generation, editing, production, and export

This is the canonical split going forward.

## Core Principle

Do not make both clients the main client.

That creates:

- duplicated product surfaces
- conflicting feature ownership
- behavior drift
- more bugs
- slower development
- weaker product clarity

The rule is:

- **Web = management**
- **Desktop = creation**

## Product Model

SocialArena is:

- one database
- one backend/API layer
- one studio model
- one project model
- one permission model

But it has two primary client experiences with different responsibilities.

This is **not**:

- a separate web product
- a separate desktop product

It is:

- one platform
- two purpose-built interfaces

## Why This Split Is Correct

### 1. Creative work belongs in the Creator App

Creative production benefits from:

- dense interfaces
- heavy local state
- file system access
- better keyboard interaction
- timeline workflows
- export handling
- local caching
- media-heavy interaction

Those are desktop strengths.

### 2. Coordination belongs on the web

Studio management and oversight benefit from:

- easy access from anywhere
- lightweight interaction
- multi-user review
- task/status visibility
- collaboration surfaces
- approvals and tracking

Those are browser strengths.

### 3. It makes the product easier to explain

To creators:

- use the Creator App to make the work

To producers and studio owners:

- use the web platform to manage, review, and track the work

To internal development:

- creative features go in desktop
- coordination features go in web

## Canonical Responsibility Split

## Web Platform Responsibilities

The web platform should own:

- login and account
- studio creation
- studio management
- studio members
- permissions and roles
- analytics
- project lists and status overviews
- task setting and production tracking
- communication and studio discussion
- approvals and review queues
- release and publishing management
- billing, subscriptions, and admin
- public pages, discovery, and distribution surfaces

## Creator App Responsibilities

The Creator App should own:

- idea board authoring
- project pitch authoring
- script authoring
- starting image generation
- video clip generation
- shot planning
- scene metadata authoring
- continuity workflows
- bridge clips
- timeline editing
- asset curation for the active production session
- rough cut and final cut assembly
- export preparation and generation

## Shared Features With Different Roles

Some features exist in both clients, but not for the same purpose.

### Shared but management-first on web

- project browser
- asset browser
- comments
- review notes
- approvals
- progress and statuses
- preview of generated outputs

### Shared but creation-first in desktop

- project details needed for active editing
- active project assets
- scene context
- generation history relevant to current work
- export configuration for the current cut

## Hard Product Rules

These rules should guide future implementation.

### Rule 1

No new creative feature should be added to the web platform unless it is explicitly **review-only**.

### Rule 2

The Creator App is the canonical place for:

- authoring
- generation
- editing
- export

### Rule 3

The web platform is the canonical place for:

- coordination
- oversight
- review
- approval
- administration
- publishing management

### Rule 4

If a feature exists in both clients, define:

- which client is the canonical owner
- whether the other client is read-only, review-only, or summary-only

Do not leave dual ownership ambiguous.

## Feature Placement Matrix

## Keep in Web

- login/account
- studio creation
- studio members
- roles and permissions
- analytics
- project list and status overview
- tasks
- messaging/discussion
- approvals/review
- release management
- public-facing pages
- subscriptions/admin

## Keep in Creator App

- idea board authoring
- project pitch authoring
- script authoring
- image generation workflows
- video generation workflows
- scene planning for active production
- timeline editing
- continuity workflows
- active asset curation
- export generation

## Shared, But Presented Differently

- project browser
- assets
- comments
- statuses
- review notes

Web should emphasize:

- visibility
- review
- oversight

Creator App should emphasize:

- active creation
- active editing
- direct manipulation

## Architecture Implications

This split requires:

- one shared studio-scoped backend model
- one shared project model
- one shared permission system
- one shared sync model

The Creator App must not become disconnected from the platform.

Even though creative work happens in desktop, it still must remain tightly synced with:

- studio context
- project ownership
- task state
- comments
- approvals
- publishing state
- review status

## Required Technical Direction

### Backend

The backend should remain unified.

It should not fork business logic into:

- web-only project logic
- desktop-only project logic

Instead:

- one API surface
- one studio model
- one project hierarchy
- client-specific presentation layers

### Client Separation

The difference between the clients should primarily be:

- what they expose
- what they optimize for
- what workflows they prioritize

Not different core data models.

## What Must Move Out of Web Over Time

If the web platform currently contains creative-production surfaces, they should be audited and categorized:

- move to Creator App
- keep as review-only on web
- remove from web

Priority candidates to remove or downgrade on web:

- script authoring surface
- image generation workspace
- video generation workspace
- timeline editing surface
- creative asset editing interfaces

## What Must Remain Visible on Web

Even when authoring lives in the Creator App, the web platform should still support:

- project preview
- scene progress visibility
- review of generated outputs
- approve/reject workflows
- analytics and status
- comments and discussion
- project summary views

The web platform should be able to understand the work without becoming the primary place the work is made.

## Recommended Product Language

Use this language consistently:

### SocialArena Web

Studio operations, review, communication, analytics, and publishing management.

### SocialArena Creator App

AI-native film and series creation, generation, editing, and export.

## Implementation Guidance

This decision should be applied as an explicit development rule.

### New Feature Rule

Before implementing a feature, answer:

1. Is this creative production work?
2. Is this management/review/coordination work?
3. Is one client canonical and the other secondary?

If the answer is unclear, the feature boundary is still underspecified.

### Audit Rule

For duplicated surfaces, classify each one:

- desktop canonical
- web review-only
- web canonical
- remove duplication

## Immediate Next Steps

1. Audit all duplicated creative surfaces currently on the web platform.
2. Mark each one as:
   - move to Creator App
   - keep as review-only
   - remove
3. Add a development rule:
   - no new creative feature goes into web unless explicitly review-only
4. Update architecture docs so both clients are described as one system with two roles.
5. Align roadmap priorities with this split so future work does not reintroduce duplication.

## Bottom Line

This is the cleaner product boundary:

- **Web = control tower**
- **Creator App = production floor**

That split is more coherent architecturally, clearer for users, and cheaper to maintain over time.
