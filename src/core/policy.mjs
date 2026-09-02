export function evaluatePolicy(plan) {
  const violations=[];
  for (const c of plan.selection.components) {
    if (c.trust !== 'approved') violations.push({policy:'deny-untrusted-resource',resource:c.id});
    if (!c.runtime.includes(plan.selection.runtime.id)) violations.push({policy:'require-runtime-compatibility',resource:c.id});
  }
  if (!plan.capabilities.includes('qa.core')) violations.push({policy:'require-core-qa'});
  return {status:violations.length?'FAIL':'PASS',violations};
}
