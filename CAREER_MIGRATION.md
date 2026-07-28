# Career Migration Notes

Status: **NO-GO** for multi-currency release.

## Current Save Schema

Current source reports save schema `13`. The monetization changes in this pass use existing optional `inventory`, `flags`, `managerStory.flags`, `wallet`, and entitlement fields to avoid forcing an unsafe partial migration.

## Required Future Migration

A future schema bump must migrate:

- Account wallet into a `PremiumWallet`-style shape with versioning.
- Club finances into typed Money values with `currencyCode`.
- Player contracts into typed salary/signing-bonus values.
- Auction and transfer state into currency-owned transaction records.
- Purchase ledger into durable, server-authoritative account storage.

## Legacy Currency Rule

Do not relabel old INR-designed values as GBP/AUD/etc. Non-INR clubs need documented rescaling or conversion using a versioned game economy table.

