import {synthesizeLayout} from './template-synthesis.mjs';
import {applyUniversalLayout} from './universal-layout.mjs';
export function resolveLayout(project,capabilities=[]){return applyUniversalLayout(synthesizeLayout(project,capabilities),project)}
