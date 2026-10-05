const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
process.env.TZ = 'Asia/Shanghai';
const source = fs.readFileSync('app.js','utf8').replace(/loadTheme\(\);\s*init\(\);\s*$/, '');
const ctx = vm.createContext({Date, String, Set, Number});
vm.runInContext(source, ctx);
const valid = () => ({workouts:[{id:'a',date:'2026-10-05',exercise:'Pull up',sets:[{weight:0,reps:10}]}]});
test('local morning stays on local calendar day', () => assert.equal(ctx.dateKey(new Date('2026-10-05T01:00:00+08:00')), '2026-10-05'));
test('weekly count deduplicates days and excludes future dates', () => {
  const today = ctx.dateKey(new Date());
  ctx.workouts = [{date:today},{date:today},{date:'2099-01-01'}];
  assert.equal(ctx.getWeekWorkouts(),1);
});
test('bodyweight sets and legacy backup are accepted', () => ctx.validateBackup(valid()));
test('pounds are stored as kilograms without rounding away precision', () => {
  assert.equal(ctx.weightToKg(100, 'lb'), 45.359237);
  assert.equal(ctx.weightFromKg(45.359237, 'lb'), 100);
  assert.equal(ctx.weightToKg(0, 'lb'), 0);
  assert.equal(ctx.weightToKg(20, 'kg'), 20);
});
test('100 kg survives repeated display conversion and copied rows', () => {
  const input = {value:'100', dataset:{}};
  for (let i = 0; i < 20; i++) {
    ctx.displayInputWeight(input, ctx.inputWeightKg(input, 'kg'), 'lb');
    const copied = {value:input.value, dataset:{}};
    ctx.displayInputWeight(copied, ctx.inputWeightKg(input, 'lb'), 'lb');
    ctx.displayInputWeight(input, ctx.inputWeightKg(copied, 'lb'), 'kg');
    assert.equal(input.value, '100');
    assert.equal(ctx.inputWeightKg(input, 'kg'), 100);
  }
  assert.equal(ctx.cleanWeight(99.9999991614095), 99.99999916);
});
test('custom presets accept decimals and separators but reject invalid values', () => {
  assert.deepEqual(Array.from(ctx.parseWeightPresets('5, 7，9 25 5')), [5,7,9,25]);
  for (const text of ['', '-5,7', '0,7', '5kg', 'Infinity', '5,,']) assert.throws(() => ctx.parseWeightPresets(text));
});
test('invalid dates, negative weights and duplicate IDs are rejected', () => {
  let data = valid(); data.workouts[0].date = '2026-02-30'; assert.throws(() => ctx.validateBackup(data));
  data = valid(); data.workouts[0].sets[0].weight = -1; assert.throws(() => ctx.validateBackup(data));
  data = valid(); data.workouts.push(data.workouts[0]); assert.throws(() => ctx.validateBackup(data));
});
test('invalid optional settings are rejected before import', () => {
  for (const settings of [{increment:0},{exerciseCategories:{chest:'bench'}},{exerciseFreq:{bench:-1}}]) assert.throws(() => ctx.validateBackup({...valid(),...settings}));
});
