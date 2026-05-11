# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Application Compilation and Data Consistency Failures
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing cases to ensure reproducibility
  - Test that compilation fails due to duplicate `export default function App()` declarations
  - Test that data operations use conflicting storage mechanisms (both Supabase and localStorage)
  - Test that import statement is incorrectly placed within component logic
  - Test that schema field naming mismatches cause operation failures
  - The test assertions should match the Expected Behavior Properties from design (successful compilation, Supabase-only storage, proper imports, consistent field naming)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause (compilation errors, storage conflicts, import failures, schema mismatches)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - UI and User Experience Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for UI interactions that don't involve data storage mechanism
  - Observe dashboard display with stats, alerts, and today's appointments
  - Observe navigation between views (dashboard, lookup, alerts, schedule, clients)
  - Observe UI component interactions (modals, forms, buttons, styling)
  - Observe data display formatting and search functionality
  - Write property-based tests capturing observed UI behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees that user experience is unchanged
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline UI behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix automobile showroom compilation and data consistency bugs

  - [x] 3.1 Remove duplicate App component declaration
    - Delete the second `export default function App()` declaration starting at line 1266
    - Merge any unique Supabase logic from the second declaration into the first declaration (lines 1165-1264)
    - Ensure only one complete App component remains
    - _Bug_Condition: isBugCondition(input) where input.type == "compilation" AND duplicateExportsExist(input.code)_
    - _Expected_Behavior: expectedBehavior(result) where result.compilation == "success" AND result.duplicateExports == false_
    - _Preservation: UI components, navigation, styling, and user interactions remain unchanged_
    - _Requirements: 1.1, 2.1_

  - [x] 3.2 Move Supabase import to correct location
    - Move `import { supabase } from './src/supabaseClient'` from line 1265 to the top of the file with other imports
    - Correct the import path to `'./src/supabaseClient'` (remove extra './')
    - Place import at line 4 after lucide-react imports
    - _Bug_Condition: isBugCondition(input) where input.type == "import" AND importPlacementIncorrect(input.statement)_
    - _Expected_Behavior: expectedBehavior(result) where result.importsAtTop == true AND result.importPath == correct_
    - _Preservation: All existing functionality remains unchanged_
    - _Requirements: 1.3, 2.3_

  - [x] 3.3 Replace localStorage operations with Supabase-only storage
    - Remove all `window.storage.set/get` calls in useEffect and save functions
    - Remove the `save` function that writes to localStorage
    - Replace with direct Supabase insert/update operations for all data types
    - Ensure all CRUD operations (cars, services, appointments, clients) use Supabase consistently
    - _Bug_Condition: isBugCondition(input) where input.type == "dataOperation" AND conflictingStorageUsed(input.operation)_
    - _Expected_Behavior: expectedBehavior(result) where result.storageType == "supabase_only" AND result.consistency == true_
    - _Preservation: UI behavior and user experience remain identical_
    - _Requirements: 1.2, 1.5, 2.2, 2.5_

  - [x] 3.4 Implement consistent schema field mapping
    - Add proper field name conversion between frontend (`clientId`) and database (`client_id`)
    - Ensure all Supabase queries use correct database field names (snake_case)
    - Transform data when loading from database to match frontend expectations (camelCase)
    - Apply consistent mapping to all data types (cars, services, appointments, clients)
    - _Bug_Condition: isBugCondition(input) where input.type == "schemaOperation" AND fieldNamingMismatch(input.fields)_
    - _Expected_Behavior: expectedBehavior(result) where result.fieldMapping == consistent AND result.schemaErrors == none_
    - _Preservation: Data display formatting and presentation remain unchanged_
    - _Requirements: 1.4, 2.4_

  - [x] 3.5 Complete Supabase integration with error handling
    - Implement missing CRUD operations for all data types using Supabase
    - Add proper error handling for all database operations
    - Ensure all data modifications update both database and local state correctly
    - Add loading states and user feedback for database operations
    - _Bug_Condition: All bug conditions from design document_
    - _Expected_Behavior: Complete Supabase integration with proper error handling_
    - _Preservation: All UI components and user interactions remain unchanged_
    - _Requirements: 2.2, 2.5_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Application Compilation and Data Consistency Success
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - Verify application compiles successfully without duplicate export errors
    - Verify all data operations use Supabase consistently
    - Verify imports are properly placed and functional
    - Verify schema field mapping works correctly
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - UI and User Experience Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm dashboard display, navigation, UI components, and search functionality work identically
    - Confirm all visual styling and user interactions are preserved
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Verify application compiles and runs successfully
  - Verify all data operations use Supabase consistently
  - Verify UI functionality and user experience are preserved
  - Verify no compilation errors or runtime failures
  - Ensure all tests pass, ask the user if questions arise