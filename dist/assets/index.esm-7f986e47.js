import{K as A,_ as S,M as k,N as R,Q as J,T as Q,V as Ce,W as b,Y as Ee,Z as Re,$ as X,a0 as Z,a1 as ee,a2 as te,a3 as Pe,a4 as U}from"./App-eb864cfb.js";import"./index-076dcfcc.js";const ne="@firebase/installations",j="0.6.9";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ae=1e4,ie=`w:${j}`,re="FIS_v2",_e="https://firebaseinstallations.googleapis.com/v1",Oe=60*60*1e3,De="installations",Fe="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $e={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},I=new J(De,Fe,$e);function se(e){return e instanceof Q&&e.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oe({projectId:e}){return`${_e}/projects/${e}/installations`}function ce(e){return{token:e.token,requestStatus:2,expiresIn:Ne(e.expiresIn),creationTime:Date.now()}}async function le(e,t){const a=(await t.json()).error;return I.create("request-failed",{requestName:e,serverCode:a.code,serverMessage:a.message,serverStatus:a.status})}function ue({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function Me(e,{refreshToken:t}){const n=ue(e);return n.append("Authorization",je(t)),n}async function de(e){const t=await e();return t.status>=500&&t.status<600?e():t}function Ne(e){return Number(e.replace("s","000"))}function je(e){return`${re} ${e}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function xe({appConfig:e,heartbeatServiceProvider:t},{fid:n}){const a=oe(e),i=ue(e),r=t.getImmediate({optional:!0});if(r){const l=await r.getHeartbeatsHeader();l&&i.append("x-firebase-client",l)}const s={fid:n,authVersion:re,appId:e.appId,sdkVersion:ie},o={method:"POST",headers:i,body:JSON.stringify(s)},c=await de(()=>fetch(a,o));if(c.ok){const l=await c.json();return{fid:l.fid||n,registrationStatus:2,refreshToken:l.refreshToken,authToken:ce(l.authToken)}}else throw await le("Create Installation",c)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fe(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Le(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const qe=/^[cdef][\w-]{21}$/,F="";function Be(){try{const e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;const n=Ue(e);return qe.test(n)?n:F}catch{return F}}function Ue(e){return Le(e).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function P(e){return`${e.appName}!${e.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pe=new Map;function ge(e,t){const n=P(e);he(n,t),Ve(n,t)}function he(e,t){const n=pe.get(e);if(n)for(const a of n)a(t)}function Ve(e,t){const n=Ge();n&&n.postMessage({key:e,fid:t}),ze()}let w=null;function Ge(){return!w&&"BroadcastChannel"in self&&(w=new BroadcastChannel("[Firebase] FID Change"),w.onmessage=e=>{he(e.data.key,e.data.fid)}),w}function ze(){pe.size===0&&w&&(w.close(),w=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ke="firebase-installations-database",He=1,y="firebase-installations-store";let O=null;function x(){return O||(O=Ce(Ke,He,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(y)}}})),O}async function C(e,t){const n=P(e),i=(await x()).transaction(y,"readwrite"),r=i.objectStore(y),s=await r.get(n);return await r.put(t,n),await i.done,(!s||s.fid!==t.fid)&&ge(e,t.fid),t}async function me(e){const t=P(e),a=(await x()).transaction(y,"readwrite");await a.objectStore(y).delete(t),await a.done}async function _(e,t){const n=P(e),i=(await x()).transaction(y,"readwrite"),r=i.objectStore(y),s=await r.get(n),o=t(s);return o===void 0?await r.delete(n):await r.put(o,n),await i.done,o&&(!s||s.fid!==o.fid)&&ge(e,o.fid),o}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function L(e){let t;const n=await _(e.appConfig,a=>{const i=We(a),r=Ye(e,i);return t=r.registrationPromise,r.installationEntry});return n.fid===F?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function We(e){const t=e||{fid:Be(),registrationStatus:0};return we(t)}function Ye(e,t){if(t.registrationStatus===0){if(!navigator.onLine){const i=Promise.reject(I.create("app-offline"));return{installationEntry:t,registrationPromise:i}}const n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},a=Je(e,n);return{installationEntry:n,registrationPromise:a}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:Qe(e)}:{installationEntry:t}}async function Je(e,t){try{const n=await xe(e,t);return C(e.appConfig,n)}catch(n){throw se(n)&&n.customData.serverCode===409?await me(e.appConfig):await C(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function Qe(e){let t=await V(e.appConfig);for(;t.registrationStatus===1;)await fe(100),t=await V(e.appConfig);if(t.registrationStatus===0){const{installationEntry:n,registrationPromise:a}=await L(e);return a||n}return t}function V(e){return _(e,t=>{if(!t)throw I.create("installation-not-found");return we(t)})}function we(e){return Xe(e)?{fid:e.fid,registrationStatus:0}:e}function Xe(e){return e.registrationStatus===1&&e.registrationTime+ae<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ze({appConfig:e,heartbeatServiceProvider:t},n){const a=et(e,n),i=Me(e,n),r=t.getImmediate({optional:!0});if(r){const l=await r.getHeartbeatsHeader();l&&i.append("x-firebase-client",l)}const s={installation:{sdkVersion:ie,appId:e.appId}},o={method:"POST",headers:i,body:JSON.stringify(s)},c=await de(()=>fetch(a,o));if(c.ok){const l=await c.json();return ce(l)}else throw await le("Generate Auth Token",c)}function et(e,{fid:t}){return`${oe(e)}/${t}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function q(e,t=!1){let n;const a=await _(e.appConfig,r=>{if(!Ie(r))throw I.create("not-registered");const s=r.authToken;if(!t&&at(s))return r;if(s.requestStatus===1)return n=tt(e,t),r;{if(!navigator.onLine)throw I.create("app-offline");const o=rt(r);return n=nt(e,o),o}});return n?await n:a.authToken}async function tt(e,t){let n=await G(e.appConfig);for(;n.authToken.requestStatus===1;)await fe(100),n=await G(e.appConfig);const a=n.authToken;return a.requestStatus===0?q(e,t):a}function G(e){return _(e,t=>{if(!Ie(t))throw I.create("not-registered");const n=t.authToken;return st(n)?Object.assign(Object.assign({},t),{authToken:{requestStatus:0}}):t})}async function nt(e,t){try{const n=await Ze(e,t),a=Object.assign(Object.assign({},t),{authToken:n});return await C(e.appConfig,a),n}catch(n){if(se(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await me(e.appConfig);else{const a=Object.assign(Object.assign({},t),{authToken:{requestStatus:0}});await C(e.appConfig,a)}throw n}}function Ie(e){return e!==void 0&&e.registrationStatus===2}function at(e){return e.requestStatus===2&&!it(e)}function it(e){const t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+Oe}function rt(e){const t={requestStatus:1,requestTime:Date.now()};return Object.assign(Object.assign({},e),{authToken:t})}function st(e){return e.requestStatus===1&&e.requestTime+ae<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ot(e){const t=e,{installationEntry:n,registrationPromise:a}=await L(t);return a?a.catch(console.error):q(t).catch(console.error),n.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ct(e,t=!1){const n=e;return await lt(n),(await q(n,t)).token}async function lt(e){const{registrationPromise:t}=await L(e);t&&await t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ut(e){if(!e||!e.options)throw D("App Configuration");if(!e.name)throw D("App Name");const t=["projectId","apiKey","appId"];for(const n of t)if(!e.options[n])throw D(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function D(e){return I.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ye="installations",dt="installations-internal",ft=e=>{const t=e.getProvider("app").getImmediate(),n=ut(t),a=R(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:a,_delete:()=>Promise.resolve()}},pt=e=>{const t=e.getProvider("app").getImmediate(),n=R(t,ye).getImmediate();return{getId:()=>ot(n),getToken:i=>ct(n,i)}};function gt(){S(new k(ye,ft,"PUBLIC")),S(new k(dt,pt,"PRIVATE"))}gt();A(ne,j);A(ne,j,"esm2017");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const E="analytics",ht="firebase_id",mt="origin",wt=60*1e3,It="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig",B="https://www.googletagmanager.com/gtag/js";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const u=new Pe("@firebase/analytics");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yt={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":"Firebase Analytics Interop Component failed to instantiate: {$reason}","invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":"Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}","no-api-key":'The "apiKey" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.',"no-app-id":'The "appId" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.',"no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":"Trusted Types detected an invalid gtag resource: {$gtagURL}."},d=new J("analytics","Analytics",yt);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function bt(e){if(!e.startsWith(B)){const t=d.create("invalid-gtag-resource",{gtagURL:e});return u.warn(t.message),""}return e}function be(e){return Promise.all(e.map(t=>t.catch(n=>n)))}function Tt(e,t){let n;return window.trustedTypes&&(n=window.trustedTypes.createPolicy(e,t)),n}function vt(e,t){const n=Tt("firebase-js-sdk-policy",{createScriptURL:bt}),a=document.createElement("script"),i=`${B}?l=${e}&id=${t}`;a.src=n?n==null?void 0:n.createScriptURL(i):i,a.async=!0,document.head.appendChild(a)}function At(e){let t=[];return Array.isArray(window[e])?t=window[e]:window[e]=t,t}async function St(e,t,n,a,i,r){const s=a[i];try{if(s)await t[s];else{const c=(await be(n)).find(l=>l.measurementId===i);c&&await t[c.appId]}}catch(o){u.error(o)}e("config",i,r)}async function kt(e,t,n,a,i){try{let r=[];if(i&&i.send_to){let s=i.send_to;Array.isArray(s)||(s=[s]);const o=await be(n);for(const c of s){const l=o.find(m=>m.measurementId===c),f=l&&t[l.appId];if(f)r.push(f);else{r=[];break}}}r.length===0&&(r=Object.values(t)),await Promise.all(r),e("event",a,i||{})}catch(r){u.error(r)}}function Ct(e,t,n,a){async function i(r,...s){try{if(r==="event"){const[o,c]=s;await kt(e,t,n,o,c)}else if(r==="config"){const[o,c]=s;await St(e,t,n,a,o,c)}else if(r==="consent"){const[o,c]=s;e("consent",o,c)}else if(r==="get"){const[o,c,l]=s;e("get",o,c,l)}else if(r==="set"){const[o]=s;e("set",o)}else e(r,...s)}catch(o){u.error(o)}}return i}function Et(e,t,n,a,i){let r=function(...s){window[a].push(arguments)};return window[i]&&typeof window[i]=="function"&&(r=window[i]),window[i]=Ct(r,e,t,n),{gtagCore:r,wrappedGtag:window[i]}}function Rt(e){const t=window.document.getElementsByTagName("script");for(const n of Object.values(t))if(n.src&&n.src.includes(B)&&n.src.includes(e))return n;return null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pt=30,_t=1e3;class Ot{constructor(t={},n=_t){this.throttleMetadata=t,this.intervalMillis=n}getThrottleMetadata(t){return this.throttleMetadata[t]}setThrottleMetadata(t,n){this.throttleMetadata[t]=n}deleteThrottleMetadata(t){delete this.throttleMetadata[t]}}const Te=new Ot;function Dt(e){return new Headers({Accept:"application/json","x-goog-api-key":e})}async function Ft(e){var t;const{appId:n,apiKey:a}=e,i={method:"GET",headers:Dt(a)},r=It.replace("{app-id}",n),s=await fetch(r,i);if(s.status!==200&&s.status!==304){let o="";try{const c=await s.json();!((t=c.error)===null||t===void 0)&&t.message&&(o=c.error.message)}catch{}throw d.create("config-fetch-failed",{httpStatus:s.status,responseMessage:o})}return s.json()}async function $t(e,t=Te,n){const{appId:a,apiKey:i,measurementId:r}=e.options;if(!a)throw d.create("no-app-id");if(!i){if(r)return{measurementId:r,appId:a};throw d.create("no-api-key")}const s=t.getThrottleMetadata(a)||{backoffCount:0,throttleEndTimeMillis:Date.now()},o=new jt;return setTimeout(async()=>{o.abort()},n!==void 0?n:wt),ve({appId:a,apiKey:i,measurementId:r},s,o,t)}async function ve(e,{throttleEndTimeMillis:t,backoffCount:n},a,i=Te){var r;const{appId:s,measurementId:o}=e;try{await Mt(a,t)}catch(c){if(o)return u.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${o} provided in the "measurementId" field in the local Firebase config. [${c==null?void 0:c.message}]`),{appId:s,measurementId:o};throw c}try{const c=await Ft(e);return i.deleteThrottleMetadata(s),c}catch(c){const l=c;if(!Nt(l)){if(i.deleteThrottleMetadata(s),o)return u.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${o} provided in the "measurementId" field in the local Firebase config. [${l==null?void 0:l.message}]`),{appId:s,measurementId:o};throw c}const f=Number((r=l==null?void 0:l.customData)===null||r===void 0?void 0:r.httpStatus)===503?U(n,i.intervalMillis,Pt):U(n,i.intervalMillis),m={throttleEndTimeMillis:Date.now()+f,backoffCount:n+1};return i.setThrottleMetadata(s,m),u.debug(`Calling attemptFetch again in ${f} millis`),ve(e,m,a,i)}}function Mt(e,t){return new Promise((n,a)=>{const i=Math.max(t-Date.now(),0),r=setTimeout(n,i);e.addEventListener(()=>{clearTimeout(r),a(d.create("fetch-throttle",{throttleEndTimeMillis:t}))})})}function Nt(e){if(!(e instanceof Q)||!e.customData)return!1;const t=Number(e.customData.httpStatus);return t===429||t===500||t===503||t===504}class jt{constructor(){this.listeners=[]}addEventListener(t){this.listeners.push(t)}abort(){this.listeners.forEach(t=>t())}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let $;async function xt(e,t,n,a,i){if(i&&i.global){e("event",n,a);return}else{const r=await t,s=Object.assign(Object.assign({},a),{send_to:r});e("event",n,s)}}async function Lt(e,t,n,a){if(a&&a.global)return e("set",{screen_name:n}),Promise.resolve();{const i=await t;e("config",i,{update:!0,screen_name:n})}}async function qt(e,t,n,a){if(a&&a.global)return e("set",{user_id:n}),Promise.resolve();{const i=await t;e("config",i,{update:!0,user_id:n})}}async function Bt(e,t,n,a){if(a&&a.global){const i={};for(const r of Object.keys(n))i[`user_properties.${r}`]=n[r];return e("set",i),Promise.resolve()}else{const i=await t;e("config",i,{update:!0,user_properties:n})}}async function Ut(e,t){const n=await t;return new Promise((a,i)=>{e("get",n,"client_id",r=>{r||i(d.create("no-client-id")),a(r)})})}async function Vt(e,t){const n=await e;window[`ga-disable-${n}`]=!t}let M;function Ae(e){M=e}function Se(e){$=e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Gt(){if(ee())try{await te()}catch(e){return u.warn(d.create("indexeddb-unavailable",{errorInfo:e==null?void 0:e.toString()}).message),!1}else return u.warn(d.create("indexeddb-unavailable",{errorInfo:"IndexedDB is not available in this environment."}).message),!1;return!0}async function zt(e,t,n,a,i,r,s){var o;const c=$t(e);c.then(h=>{n[h.measurementId]=h.appId,e.options.measurementId&&h.measurementId!==e.options.measurementId&&u.warn(`The measurement ID in the local Firebase config (${e.options.measurementId}) does not match the measurement ID fetched from the server (${h.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(h=>u.error(h)),t.push(c);const l=Gt().then(h=>{if(h)return a.getId()}),[f,m]=await Promise.all([c,l]);Rt(r)||vt(r,f.measurementId),M&&(i("consent","default",M),Ae(void 0)),i("js",new Date);const T=(o=s==null?void 0:s.config)!==null&&o!==void 0?o:{};return T[mt]="firebase",T.update=!0,m!=null&&(T[ht]=m),i("config",f.measurementId,T),$&&(i("set",$),Se(void 0)),f.measurementId}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Kt{constructor(t){this.app=t}_delete(){return delete p[this.app.options.appId],Promise.resolve()}}let p={},z=[];const K={};let v="dataLayer",ke="gtag",H,g,N=!1;function en(e){if(N)throw d.create("already-initialized");e.dataLayerName&&(v=e.dataLayerName),e.gtagName&&(ke=e.gtagName)}function Ht(){const e=[];if(X()&&e.push("This is a browser extension environment."),Z()||e.push("Cookies are not available."),e.length>0){const t=e.map((a,i)=>`(${i+1}) ${a}`).join(" "),n=d.create("invalid-analytics-context",{errorInfo:t});u.warn(n.message)}}function Wt(e,t,n){Ht();const a=e.options.appId;if(!a)throw d.create("no-app-id");if(!e.options.apiKey)if(e.options.measurementId)u.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${e.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);else throw d.create("no-api-key");if(p[a]!=null)throw d.create("already-exists",{id:a});if(!N){At(v);const{wrappedGtag:r,gtagCore:s}=Et(p,z,K,v,ke);g=r,H=s,N=!0}return p[a]=zt(e,z,K,t,H,v,n),new Kt(e)}function tn(e=Ee()){e=b(e);const t=R(e,E);return t.isInitialized()?t.getImmediate():Yt(e)}function Yt(e,t={}){const n=R(e,E);if(n.isInitialized()){const i=n.getImmediate();if(Re(t,n.getOptions()))return i;throw d.create("already-initialized")}return n.initialize({options:t})}async function nn(){if(X()||!Z()||!ee())return!1;try{return await te()}catch{return!1}}function an(e,t,n){e=b(e),Lt(g,p[e.app.options.appId],t,n).catch(a=>u.error(a))}async function rn(e){return e=b(e),Ut(g,p[e.app.options.appId])}function sn(e,t,n){e=b(e),qt(g,p[e.app.options.appId],t,n).catch(a=>u.error(a))}function on(e,t,n){e=b(e),Bt(g,p[e.app.options.appId],t,n).catch(a=>u.error(a))}function cn(e,t){e=b(e),Vt(p[e.app.options.appId],t).catch(n=>u.error(n))}function ln(e){g?g("set",e):Se(e)}function Jt(e,t,n,a){e=b(e),xt(g,p[e.app.options.appId],t,n,a).catch(i=>u.error(i))}function un(e){g?g("consent","update",e):Ae(e)}const W="@firebase/analytics",Y="0.10.8";function Qt(){S(new k(E,(t,{options:n})=>{const a=t.getProvider("app").getImmediate(),i=t.getProvider("installations-internal").getImmediate();return Wt(a,i,n)},"PUBLIC")),S(new k("analytics-internal",e,"PRIVATE")),A(W,Y),A(W,Y,"esm2017");function e(t){try{const n=t.getProvider(E).getImmediate();return{logEvent:(a,i,r)=>Jt(n,a,i,r)}}catch(n){throw d.create("interop-component-reg-failed",{reason:n})}}}Qt();export{tn as getAnalytics,rn as getGoogleAnalyticsClientId,Yt as initializeAnalytics,nn as isSupported,Jt as logEvent,cn as setAnalyticsCollectionEnabled,un as setConsent,an as setCurrentScreen,ln as setDefaultEventParameters,sn as setUserId,on as setUserProperties,en as settings};
