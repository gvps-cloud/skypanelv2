# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Invoice Missing User and Organization Display
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that invoices generated with userId or organizationId display user name, email, organization ID, and organization name in the HTML
  - The test assertions should match the Expected Behavior Properties from design
  - Create test invoices from transactions and billing cycles with known userId and organizationId
  - Parse generated HTML to verify presence of user name, email, organization ID, and organization name
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause:
    - Invoice HTML contains only UUID in "Account ID" field
    - Invoice HTML has no "Bill To" section with user name and email
    - Invoice HTML has no organization ID or organization name displayed
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Invoice Functionality
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Test invoice calculation logic (subtotal, tax, total) remains unchanged
  - Test invoice storage in billing_invoices table continues to work correctly
  - Test invoice HTML structure, styling, and theme colors remain unchanged
  - Test invoice listing, retrieval, and download endpoints continue to function
  - Test invoice items display and formatting remain unchanged
  - Test invoice generation without userId continues to work (no crash)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for invoice user and organization display

  - [x] 3.1 Extend InvoiceData interface in api/services/invoiceService.ts
    - Add optional userName?: string field
    - Add optional userEmail?: string field
    - Add optional organizationName?: string field
    - _Bug_Condition: isBugCondition(input) where (input.userId IS NOT NULL OR input.organizationId IS NOT NULL) AND (input.userName IS NULL OR input.userEmail IS NULL OR input.organizationName IS NULL)_
    - _Expected_Behavior: Invoice HTML displays user name, email, organization ID, and organization name when available_
    - _Preservation: Invoice structure, calculations, storage, and retrieval behavior remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Update generateInvoiceHTML function to display user and organization information
    - Add "Bill To" section in invoice metadata area after existing invoice-meta grid
    - Display user name when userName is provided
    - Display user email when userEmail is provided
    - Display organization ID when organizationId is provided
    - Display organization name when organizationName is provided
    - Use fallback text "N/A" when data is missing
    - Style consistently with existing invoice metadata section
    - Ensure printable and responsive layout
    - _Bug_Condition: isBugCondition(input) where invoice HTML does not display user/org information_
    - _Expected_Behavior: Invoice HTML contains user name, email, organization ID, and organization name in structured format_
    - _Preservation: Existing invoice HTML structure, styling, and theme colors remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.7_

  - [x] 3.3 Update generateInvoiceFromTransactions to accept and pass user/org data
    - Add optional userName parameter
    - Add optional userEmail parameter
    - Add optional organizationName parameter
    - Include these values in returned InvoiceData object
    - _Bug_Condition: isBugCondition(input) where function does not accept user/org data_
    - _Expected_Behavior: Function accepts and includes user/org data in InvoiceData_
    - _Preservation: Existing invoice generation logic remains unchanged_
    - _Requirements: 2.5, 2.6_

  - [x] 3.4 Update generateInvoiceFromBillingCycles to accept and pass user/org data
    - Add optional userName parameter
    - Add optional userEmail parameter
    - Add optional organizationName parameter
    - Include these values in returned InvoiceData object
    - _Bug_Condition: isBugCondition(input) where function does not accept user/org data_
    - _Expected_Behavior: Function accepts and includes user/org data in InvoiceData_
    - _Preservation: Existing invoice generation logic remains unchanged_
    - _Requirements: 2.5, 2.6_

  - [x] 3.5 Update /from-transaction/:transactionId route to fetch and pass user data
    - Query users table: SELECT name, email FROM users WHERE id = $1
    - Handle case where user might not exist (use fallback values)
    - Pass userName and userEmail to generateInvoiceFromTransactions
    - _Bug_Condition: isBugCondition(input) where route does not fetch user data_
    - _Expected_Behavior: Route fetches user name and email before generating invoice_
    - _Preservation: Existing route behavior and error handling remain unchanged_
    - _Requirements: 2.1, 2.2, 2.5, 2.7_

  - [x] 3.6 Update /from-transactions route to fetch and pass user data
    - Query users table: SELECT name, email FROM users WHERE id = $1
    - Handle case where user might not exist (use fallback values)
    - Pass userName and userEmail to generateInvoiceFromTransactions
    - _Bug_Condition: isBugCondition(input) where route does not fetch user data_
    - _Expected_Behavior: Route fetches user name and email before generating invoice_
    - _Preservation: Existing route behavior and error handling remain unchanged_
    - _Requirements: 2.1, 2.2, 2.5, 2.7_

  - [x] 3.7 Update /from-billing-cycles route to fetch and pass user and organization data
    - Query users table: SELECT name, email FROM users WHERE id = $1
    - Query organizations table: SELECT name FROM organizations WHERE id = $1
    - Handle cases where user or organization might not exist (use fallback values)
    - Pass userName, userEmail, and organizationName to generateInvoiceFromBillingCycles
    - _Bug_Condition: isBugCondition(input) where route does not fetch user/org data_
    - _Expected_Behavior: Route fetches user and organization data before generating invoice_
    - _Preservation: Existing route behavior and error handling remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.8 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Invoice Displays User and Organization Information
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify invoice HTML contains user name, email, organization ID, and organization name
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.9 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Invoice Functionality Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm invoice calculations, storage, retrieval, and styling remain unchanged
    - Confirm invoice generation without userId continues to work
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
