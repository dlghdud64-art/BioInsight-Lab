---
name: feature-planner
description: Generate structured, phase-based plans with TDD integration and quality gates
---

# Feature Planner

## Purpose

Generate structured, phase-based plans where:

- Each phase delivers complete, runnable functionality
- Quality gates enforce validation before proceeding
- User approves plan before any work begins
- Progress tracked via markdown checkboxes
- Each phase is 1-4 hours maximum

## Planning Workflow

### Step 1: Requirements Analysis

- Read relevant files to understand codebase architecture
- Identify dependencies and integration points
- Assess complexity and risks
- Determine appropriate scope (small/medium/large)

### Step 2: Phase Breakdown with TDD Integration

Break feature into 3-7 phases where each phase:

- **Test-First**: Write tests BEFORE implementation
- Delivers working, testable functionality
- Takes 1-4 hours maximum
- Follows Red-Green-Refactor cycle
- Has measurable test coverage requirements
- Can be rolled back independently
- Has clear success criteria

#### Phase Structure:

- **Phase Name**: Clear deliverable
- **Goal**: What working functionality this produces
- **Test Strategy**: What test types, coverage target, test scenarios
- **Tasks** (ordered by TDD workflow):
  - **RED Tasks**: Write failing tests first
  - **GREEN Tasks**: Implement minimal code to make tests pass
  - **REFACTOR Tasks**: Improve code quality while tests stay green
- **Quality Gate**: TDD compliance + validation criteria
- **Dependencies**: What must exist before starting
- **Coverage Target**: Specific percentage or checklist for this phase

### Step 3: Plan Document Creation

Use plan-template.md to generate: `docs/plans/PLAN_<feature-name>.md`

Include:

- Overview and objectives
- Architecture decisions with rationale
- Complete phase breakdown with checkboxes
- Quality gate checklists
- Risk assessment table
- Rollback strategy per phase
- Progress tracking section
- Notes & learnings area

### Step 4: User Approval

**CRITICAL**: Use AskUserQuestion to get explicit approval before proceeding.

Ask:

- "Does this phase breakdown make sense for your project?"
- "Any concerns about the proposed approach?"
- "Should I proceed with creating the plan document?"

Only create plan document after user confirms approval.

### Step 5: Document Generation

- Create `docs/plans/` directory if not exists
- Generate plan document with all checkboxes unchecked
- Add clear instructions in header about quality gates
- Inform user of plan location and next steps

## Quality Gate Standards

Each phase MUST validate these items before proceeding to next phase:

### Build & Compilation:

- ✅ Project builds/compiles without errors
- ✅ No syntax errors

### Test-Driven Development (TDD):

- ✅ Tests written BEFORE production code
- ✅ Red-Green-Refactor cycle followed
- ✅ Unit tests: ≥80% coverage for business logic
- ✅ Integration tests: Critical user flows validated
- ✅ Test suite runs in acceptable time (<5 minutes)

### Testing:

- ✅ All existing tests pass
- ✅ New tests added for new functionality
- ✅ Test coverage maintained or improved

### Code Quality:

- ✅ Linting passes with no errors
- ✅ Type checking passes (if applicable)
- ✅ Code formatting consistent

### Functionality:

- ✅ Manual testing confirms feature works
- ✅ No regressions in existing functionality
- ✅ Edge cases tested

### Security & Performance:

- ✅ No new security vulnerabilities
- ✅ No performance degradation
- ✅ Resource usage acceptable

### Documentation:

- ✅ Code comments updated
- ✅ Documentation reflects changes

## Progress Tracking Protocol

Add this to plan document header:

```
**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to next phase

⛔ DO NOT skip quality gates or proceed with failing checks
```

## Phase Sizing Guidelines

### Small Scope (2-3 phases, 3-6 hours total):

- Single component or simple feature
- Minimal dependencies
- Clear requirements
- **Example**: Add dark mode toggle, create new form component

### Medium Scope (4-5 phases, 8-15 hours total):

- Multiple components or moderate feature
- Some integration complexity
- Database changes or API work
- **Example**: User authentication system, search functionality

### Large Scope (6-7 phases, 15-25 hours total):

- Complex feature spanning multiple areas
- Significant architectural impact
- Multiple integrations
- **Example**: AI-powered search with embeddings, real-time collaboration

## Risk Assessment

Identify and document:

- **Technical Risks**: API changes, performance issues, data migration
- **Dependency Risks**: External library updates, third-party service availability
- **Timeline Risks**: Complexity unknowns, blocking dependencies
- **Quality Risks**: Test coverage gaps, regression potential

For each risk, specify:

- **Probability**: Low/Medium/High
- **Impact**: Low/Medium/High
- **Mitigation Strategy**: Specific action steps

## Rollback Strategy

For each phase, document how to revert changes if issues arise. Consider:

- What code changes need to be undone
- Database migrations to reverse (if applicable)
- Configuration changes to restore
- Dependencies to remove

## Test Specification Guidelines

### Test-First Development Workflow

#### For Each Feature Component:

**Specify Test Cases** (before writing ANY code)

- What inputs will be tested?
- What outputs are expected?
- What edge cases must be handled?
- What error conditions should be tested?

**Write Tests (Red Phase)**

- Write tests that WILL fail
- Verify tests fail for the right reason
- Run tests to confirm failure
- Commit failing tests to track TDD compliance

**Implement Code (Green Phase)**

- Write minimal code to make tests pass
- Run tests frequently (every 2-5 minutes)
- Stop when all tests pass
- No additional functionality beyond tests

**Refactor (Blue Phase)**

- Improve code quality while tests remain green
- Extract duplicated logic
- Improve naming and structure
- Run tests after each refactoring step
- Commit when refactoring complete

### Test Types

#### Unit Tests:

- **Target**: Individual functions, methods, classes
- **Dependencies**: None or mocked/stubbed
- **Speed**: Fast (<100ms per test)
- **Isolation**: Complete isolation from external systems
- **Coverage**: ≥80% of business logic

#### Integration Tests:

- **Target**: Interaction between components/modules
- **Dependencies**: May use real dependencies
- **Speed**: Moderate (<1s per test)
- **Isolation**: Tests component boundaries
- **Coverage**: Critical integration points

#### End-to-End (E2E) Tests:

- **Target**: Complete user workflows
- **Dependencies**: Real or near-real environment
- **Speed**: Slow (seconds to minutes)
- **Isolation**: Full system integration
- **Coverage**: Critical user journeys

### Test Coverage Calculation

#### Coverage Thresholds (adjust for your project):

- **Business Logic**: ≥90% (critical code paths)
- **Data Access Layer**: ≥80% (repositories, DAOs)
- **API/Controller Layer**: ≥70% (endpoints)
- **UI/Presentation**: Integration tests preferred over coverage

#### Coverage Commands by Ecosystem:

**JavaScript/TypeScript:**
```bash
jest --coverage
nyc report --reporter=html
```

**Python:**
```bash
pytest --cov=src --cov-report=html
coverage report
```

**Java:**
```bash
mvn jacoco:report
gradle jacocoTestReport
```

**Go:**
```bash
go test -cover ./...
go tool cover -html=coverage.out
```

**.NET:**
```bash
dotnet test /p:CollectCoverage=true /p:CoverageReporter=html
reportgenerator -reports:coverage.xml -targetdir:coverage
```

**Ruby:**
```bash
bundle exec rspec --coverage
open coverage/index.html
```

**PHP:**
```bash
phpunit --coverage-html coverage
```

### Common Test Patterns

#### Arrange-Act-Assert (AAA) Pattern:

```javascript
test('description of behavior', () => {
  // Arrange: Set up test data and dependencies
  const input = createTestData();

  // Act: Execute the behavior being tested
  const result = systemUnderTest.method(input);

  // Assert: Verify expected outcome
  expect(result).toBe(expectedOutput);
});
```

#### Given-When-Then (BDD Style):

```javascript
test('feature should behave in specific way', () => {
  // Given: Initial context/state
  given(userIsLoggedIn());

  // When: Action occurs
  when(userClicksButton());

  // Then: Observable outcome
  then(shouldSeeConfirmation());
});
```

#### Mocking/Stubbing Dependencies:

```javascript
test('component should call dependency', () => {
  // Create mock/stub
  const mockService = createMock(ExternalService);
  const component = new Component(mockService);

  // Configure mock behavior
  when(mockService.method()).thenReturn(expectedData);

  // Execute and verify
  component.execute();
  verify(mockService.method()).calledOnce();
});
```

### Test Documentation in Plan

In each phase, specify:

- **Test File Location**: Exact path where tests will be written
- **Test Scenarios**: List of specific test cases
- **Expected Failures**: What error should tests show initially?
- **Coverage Target**: Percentage for this phase
- **Dependencies to Mock**: What needs mocking/stubbing?
- **Test Data**: What fixtures/factories are needed?

## Supporting Files Reference

- `plan-template.md` - Complete plan document template

