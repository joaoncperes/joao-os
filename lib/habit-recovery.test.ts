import assert from 'node:assert/strict';
import { needsHabitRecovery } from './habit-recovery';
import { addDays, dateInTz } from './date';

assert.equal(needsHabitRecovery({ completed_at: null, missed_yesterday: true }, true), true);
assert.equal(needsHabitRecovery({ completed_at: '2026-09-08T12:00:00Z', missed_yesterday: true }, true), false);
assert.equal(needsHabitRecovery({ completed_at: null, missed_yesterday: false }, true), false);
assert.equal(needsHabitRecovery({ completed_at: null }, true), false);
assert.equal(needsHabitRecovery({ completed_at: null, missed_yesterday: true }, false), false);
// Yesterday follows the account's calendar, not the browser's UTC day.
assert.equal(addDays(dateInTz('2026-01-01T02:59:59Z'), -1), '2025-12-30');
assert.equal(addDays(dateInTz('2026-01-01T03:00:00Z'), -1), '2025-12-31');
assert.equal(addDays('2024-03-01', -1), '2024-02-29');
console.log('Habit recovery tests passed');
