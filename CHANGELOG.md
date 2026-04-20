# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0.0] - 2026-04-20

### Added
- **Quién pagó (Payer) Field**: Added new field to track who made each payment
  - Database migration with `quien` column (defaults to "Yo")
  - Smart suggestions based on previously used payer names
  - Integration with finance entries form and table
  - Integration with recurring records system
  - Search and sort by payer functionality
  - Excel export includes payer column
- Type definitions updated to include `quien` field across all entry types
- Test coverage updated for new field

### Fixed
- Removed duplicate `tipo` condition in SQL query
- API response field alignment (`totalItems` vs `total`)
- Form default values now include `quien` field
- Type definitions for `ParsedData` interface

