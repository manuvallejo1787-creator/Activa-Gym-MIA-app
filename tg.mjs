import { generarPlanBase } from './src/generadorPlan.js';
import { checkRestriction } from '/tmp/cr.js';
import { readFileSync } from 'fs';
const cls=JSON.parse(readFileSync('/tmp/cls.json','utf8'));
const exs=JSON.parse(readFileSync('/tmp/exs.json','utf8'));
let ok=0,bloq=0,sumEj=0,sumPeso=0,vacios={};
let ej=null;
for(const c of cls){
  const {plan,diagnostico}=generarPlanBase({cliente:c,exs,tests:[],diasSemana:3,checkRestriction});
  diagnostico.listoParaAplicar?ok++:bloq++;
  sumEj+=diagnostico.cobertura.totalEj;
  plan.dias.forEach(d=>d.blocks.forEach(b=>{if(!b.exercises.length)vacios[b.type]=(vacios[b.type]||0)+1;}));
  if(!ej&&diagnostico.patronesDeficit.length>2) ej={c,plan,diagnostico};
}
console.log(`53 clientes · listos para aplicar: ${ok} · con bloqueantes: ${bloq}`);
console.log(`ejercicios promedio por plan (3 días): ${(sumEj/cls.length).toFixed(1)}`);
console.log('\n══ EJEMPLO:',ej.c.nombre,ej.c.apellido,'══');
console.log(ej.plan.nombre);
console.log('\nPROCEDENCIA:'); ej.diagnostico.procedencia.forEach(p=>console.log('  '+p));
console.log('\nPRIORIDADES:',ej.diagnostico.patronesDeficit.join(', '));
if(ej.diagnostico.avisos.length){console.log('\nAVISOS:');ej.diagnostico.avisos.forEach(a=>console.log('  ⚠ '+a));}
if(ej.diagnostico.bloqueantes.length){console.log('\nBLOQUEANTES:');ej.diagnostico.bloqueantes.forEach(a=>console.log('  ⛔ '+a));}
console.log('\nDÍA 1:');
ej.plan.dias[0].blocks.forEach(b=>{
  console.log(`  [${b.type}] ${b.params.series}x${b.params.reps} RPE${b.params.rpe} desc ${b.params.descanso}`);
  b.exercises.forEach(e=>{const x=exs.find(z=>z.id===e.exId);console.log(`     - ${x?.nombre||e.exId}${e.override?'  ⚠':''}`);});
});
console.log('\ncobertura:',JSON.stringify(ej.diagnostico.cobertura.totalEj)+' ejercicios');
