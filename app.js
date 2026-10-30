const $ = (id) => document.getElementById(id);
const fields = ['age','bmi','parity','gestation','emergency','sbp','dbp','hr'];

function baselineValues() {
  return Object.fromEntries(fields.map(id => [id, Number($(id).value)]));
}

function updateDerived() {
  const sbp = Number($('sbp').value), dbp = Number($('dbp').value), hr = Number($('hr').value);
  const hasBp = sbp > 0 && dbp > 0;
  $('map-value').textContent = hasBp ? (dbp + (sbp - dbp) / 3).toFixed(0) : '—';
  $('si-value').textContent = sbp > 0 && hr > 0 ? (hr / sbp).toFixed(2) : '—';
}

function derivedValues(v) {
  const map = v.dbp + (v.sbp - v.dbp) / 3;
  const si = v.hr / v.sbp;
  return { map: Math.round(map), si };
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

function showResult(v, r) {
  const pct = Math.round(r.risk * 100);
  let label = 'Lower screening signal', color = '#167378';
  if (pct >= 80) { label = 'High screening signal'; color = '#b7433d'; }
  else if (pct >= 60) { label = 'Elevated screening signal'; color = '#b96818'; }
  $('empty-state').hidden = true; $('result-state').hidden = false;
  $('risk-label').textContent = label; $('risk-label').style.cssText = `color:${color};background:${color}1a`;
  $('risk-percent').textContent = `${pct}%`; $('risk-percent').style.color = color;
  $('meter-fill').style.width = `${pct}%`; $('meter-fill').style.background = color;
  $('risk-summary').textContent = `The thesis Random Forest estimates a ${pct}% probability of the study outcome: severe hypotension after spinal anaesthesia.`;
  $('result-map').textContent = `${r.map.toFixed(0)} mmHg`; $('result-si').textContent = r.si.toFixed(2);
  $('considerations').replaceChildren(...considerations(v, r).map(t => { const li=document.createElement('li'); li.textContent=t; return li; }));
}

fields.forEach(id => $(id).addEventListener('input', updateDerived));
$('risk-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!event.currentTarget.checkValidity()) { $('form-error').textContent = 'Complete all fields with values in the shown range.'; event.currentTarget.reportValidity(); return; }
  const values = baselineValues();
  if (values.dbp >= values.sbp) { $('form-error').textContent = 'Diastolic BP must be lower than systolic BP.'; return; }
  $('form-error').textContent = '';
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = 'Calculating…';
  try {
    const derived = derivedValues(values);
    const response = await fetch('/api/predict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, map: derived.map, shockIndex: derived.si }) });
    if (!response.ok) throw new Error('Prediction service unavailable');
    const prediction = await response.json();
    showResult(values, { ...derived, risk: prediction.risk });
  } catch (error) {
    $('form-error').textContent = 'The prediction service is unavailable. Start the model server, then try again.';
  } finally {
    button.disabled = false; button.innerHTML = 'Estimate screening risk <span>→</span>';
  }
});
$('reset-button').addEventListener('click', () => { $('risk-form').reset(); $('form-error').textContent=''; updateDerived(); $('empty-state').hidden=false; $('result-state').hidden=true; });
