const $ = (id) => document.getElementById(id);
const fields = ['age','bmi','parity','gestation','emergency','babyWeight','sbp','dbp','hr','bupivacaine','fluid'];

function baselineValues() {
  return Object.fromEntries(fields.map(id => [id, Number($(id).value)]));
}

function updateDerived() {
  const sbp = Number($('sbp').value), dbp = Number($('dbp').value), hr = Number($('hr').value);
  const hasBp = sbp > 0 && dbp > 0;
  $('map-value').textContent = hasBp ? (dbp + (sbp - dbp) / 3).toFixed(0) : '—';
  $('si-value').textContent = sbp > 0 && hr > 0 ? (hr / sbp).toFixed(2) : '—';
}

function sigmoid(value) { return 1 / (1 + Math.exp(-value)); }
function z(value, mean, sd) { return (value - mean) / sd; }

function estimateRisk(v) {
  const map = v.dbp + (v.sbp - v.dbp) / 3;
  const si = v.hr / v.sbp;
  // Transparent proxy: reported RF importance used as relative weights, centred on cohort means.
  // It deliberately retains cohort baseline prevalence and is not a reconstruction of the RF model.
  const score = 0.82
    + .73 * z(v.sbp, 128.28, 11.14)
    + .52 * z(map, 97.46, 8.48)
    + .38 * z(v.age, 27.84, 4.81)
    + .39 * z(v.hr, 95.98, 11.91)
    + .36 * z(si, .75, .07)
    + .37 * z(v.dbp, 82.03, 8.22)
    + .30 * z(v.bmi, 27.29, 3.29)
    - .22 * z(v.gestation, 38.10, 2.01)
    + .20 * z(v.fluid, 1474, 278.95)
    + .23 * z(v.babyWeight, 2.46, .46)
    - .08 * z(v.parity, .65, .48)
    + .07 * z(v.bupivacaine, 11.76, 1.17)
    + .08 * (v.emergency ? 1 : -1);
  return { risk: sigmoid(score), map, si };
}

function considerations(v, result) {
  const notes = [];
  if (v.hr > 92) notes.push(`Baseline heart rate is ${v.hr} bpm; elevated pre-spinal HR was associated with risk in the study and should prompt close observation.`);
  if (result.si >= .9) notes.push(`Shock index is ${result.si.toFixed(2)} (≥0.90). Treat this as a haemodynamic warning signal, not a stand-alone diagnosis.`);
  if (v.sbp >= 130 || result.map >= 100) notes.push('Baseline blood pressure is above the cohort average; SBP and MAP were the leading reported model features.');
  if (v.gestation < 37) notes.push('Gestational age is below term. The cohort analysis found gestational age independently associated with outcome.');
  notes.push('Use local obstetric-anaesthesia protocols for vasopressor planning, fluid co-loading and monitoring; reassess at the bedside.');
  return notes;
}

function showResult(v) {
  const r = estimateRisk(v), pct = Math.round(r.risk * 100);
  let label = 'Lower screening signal', color = '#167378';
  if (pct >= 80) { label = 'High screening signal'; color = '#b7433d'; }
  else if (pct >= 60) { label = 'Elevated screening signal'; color = '#b96818'; }
  $('empty-state').hidden = true; $('result-state').hidden = false;
  $('risk-label').textContent = label; $('risk-label').style.cssText = `color:${color};background:${color}1a`;
  $('risk-percent').textContent = `${pct}%`; $('risk-percent').style.color = color;
  $('meter-fill').style.width = `${pct}%`; $('meter-fill').style.background = color;
  $('risk-summary').textContent = `This profile produces an ${label.toLowerCase()} for the study outcome: severe hypotension after spinal anaesthesia.`;
  $('result-map').textContent = `${r.map.toFixed(0)} mmHg`; $('result-si').textContent = r.si.toFixed(2);
  $('considerations').replaceChildren(...considerations(v, r).map(t => { const li=document.createElement('li'); li.textContent=t; return li; }));
}

fields.forEach(id => $(id).addEventListener('input', updateDerived));
$('risk-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!event.currentTarget.checkValidity()) { $('form-error').textContent = 'Complete all fields with values in the shown range.'; event.currentTarget.reportValidity(); return; }
  const values = baselineValues();
  if (values.dbp >= values.sbp) { $('form-error').textContent = 'Diastolic BP must be lower than systolic BP.'; return; }
  $('form-error').textContent = ''; showResult(values);
});
$('reset-button').addEventListener('click', () => { $('risk-form').reset(); $('form-error').textContent=''; updateDerived(); $('empty-state').hidden=false; $('result-state').hidden=true; });
