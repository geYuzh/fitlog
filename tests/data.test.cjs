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

function exportContext(plugin) {
  const values = new Map();
  const calls = [], toasts = [], modals = [];
  const mock = vm.createContext({Date, String, Set, Number, window: {Capacitor: {
    isNativePlatform: () => true, getPlatform: () => 'android',
    isPluginAvailable: () => true, registerPlugin: () => plugin
  }}, localStorage: {getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, String(v))}});
  vm.runInContext(source, mock);
  mock.workouts = valid().workouts;
  mock.showToast = text => toasts.push(text);
  mock.showExportModal = (...args) => modals.push(args);
  return {mock, calls, toasts, modals};
}
test('native export writes JSON and reports success only after completion', async () => {
  let complete, captured;
  const state = exportContext({save: options => { captured = options; return new Promise(resolve => {complete = resolve;}); }});
  const pending = state.mock.exportData();
  assert.equal(state.toasts.length, 0);
  assert.equal(state.modals.length, 0);
  assert.match(captured.filename, /^FitLog_backup_.*\.json$/);
  const data = JSON.parse(captured.data);
  assert.equal(data.workouts[0].exercise, valid().workouts[0].exercise);
  state.mock.validateBackup(data);
  complete({cancelled: false, filename: 'backup.json'});
  await pending;
  assert.equal(state.modals[0][2].title, '备份文件已保存');
});
test('cancelled native save does not report successful export', async () => {
  const state = exportContext({save: async () => ({cancelled:true})});
  await state.mock.exportData();
  assert.equal(state.modals.length, 0);
  assert.equal(state.toasts[0], '已取消保存，未导出备份');
});
test('native save failure displays failure instead of success', async () => {
  const state = exportContext({save: async () => {throw new Error('disk full');}});
  await state.mock.exportData();
  assert.equal(state.modals[0][2].title, '备份保存失败');
  assert.equal(state.modals[0][2].message, 'disk full');
});
test('share exports a JSON file and only reports opening the share sheet', async () => {
  let captured;
  const state = exportContext({share: async options => {captured = options;}});
  await state.mock.exportData('share');
  assert.equal(JSON.parse(captured.data).workouts.length, 1);
  assert.equal(state.toasts[0], '已打开系统分享窗口，请选择接收应用');
});
test('native export ignores repeated taps while a save is pending', async () => {
  let complete, count = 0;
  const state = exportContext({save: () => {count++; return new Promise(resolve => {complete = resolve;});}});
  const pending = state.mock.exportData();
  await state.mock.exportData();
  assert.equal(count, 1);
  complete({cancelled:true}); await pending;
});
