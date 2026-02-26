const path = require('path');
const fs = require('fs');
const { getEnvListForTenant, addEnvToTenantList, clearEnvListForTenant, findConnectionReferences, generateUniqueKey } = require('../src/flowCommands');

// Simple fake context implementing the globalState API used by the extension
function makeFakeContext() {
    const o = { _store: {} };
    o.globalState = {
        get: function (sKey, vDefault) {
            if (o._store.hasOwnProperty(sKey)) return o._store[sKey];
            return vDefault;
        },
        update: function (sKey, vValue) {
            o._store[sKey] = vValue;
            return Promise.resolve();
        }
    };
    return o;
}

let iTotal = 0;
let iPassed = 0;
function assert(b, sMsg) {
    iTotal++;
    if (b) { iPassed++; console.log(' PASS: ' + sMsg); }
    else { console.log(' FAIL: ' + sMsg); }
}

console.log('\nRunning flowCommands state tests...');

const oContext = makeFakeContext();
const sTenant = 'testtenant.onmicrosoft.com';

console.log('\n-- Initial state --');
let a = getEnvListForTenant(oContext, sTenant);
assert(Array.isArray(a) && a.length === 0, 'Initial env list should be empty');

console.log('\n-- Add environment --');
addEnvToTenantList(oContext, sTenant, 'https://env1.crm.dynamics.com');
a = getEnvListForTenant(oContext, sTenant);
assert(a.length === 1 && a[0] === 'https://env1.crm.dynamics.com', 'Env added');

console.log('\n-- Prevent duplicate --');
addEnvToTenantList(oContext, sTenant, 'https://env1.crm.dynamics.com');
a = getEnvListForTenant(oContext, sTenant);
assert(a.length === 1, 'Duplicate not added');

console.log('\n-- Add second environment --');
addEnvToTenantList(oContext, sTenant, 'https://env2.crm.dynamics.com');
a = getEnvListForTenant(oContext, sTenant);
assert(a.length === 2 && a[1] === 'https://env2.crm.dynamics.com', 'Second env added');

console.log('\n-- Clear env list --');
clearEnvListForTenant(oContext, sTenant);
a = getEnvListForTenant(oContext, sTenant);
assert(Array.isArray(a) && a.length === 0, 'Env list cleared');

console.log('\n-- findConnectionReferences: top level --');
let oDoc1 = { connectionReferences: { shared_outlook_1: {} } };
let oFound = findConnectionReferences(oDoc1);
assert(oFound !== null && oFound.hasOwnProperty('shared_outlook_1'), 'Found top-level connectionReferences');

console.log('\n-- findConnectionReferences: nested --');
let oDoc2 = { properties: { connectionReferences: { shared_sql_1: {} } } };
oFound = findConnectionReferences(oDoc2);
assert(oFound !== null && oFound.hasOwnProperty('shared_sql_1'), 'Found nested connectionReferences');

console.log('\n-- findConnectionReferences: missing --');
let oDoc3 = { properties: { triggers: {} } };
oFound = findConnectionReferences(oDoc3);
assert(oFound === null, 'Returns null when no connectionReferences');

console.log('\n-- generateUniqueKey: empty object --');
let sKey = generateUniqueKey('shared_outlook', {});
assert(sKey === 'shared_outlook_1', 'First key should be _1 (got ' + sKey + ')');

console.log('\n-- generateUniqueKey: _1 exists --');
sKey = generateUniqueKey('shared_outlook', { 'shared_outlook_1': {} });
assert(sKey === 'shared_outlook_2', 'Should skip to _2 (got ' + sKey + ')');

console.log('\n-- generateUniqueKey: _1 and _2 exist --');
sKey = generateUniqueKey('shared_outlook', { 'shared_outlook_1': {}, 'shared_outlook_2': {} });
assert(sKey === 'shared_outlook_3', 'Should skip to _3 (got ' + sKey + ')');

console.log('\n=======================================');
console.log('Results: ' + iPassed + '/' + iTotal + ' tests passed');
if (iPassed !== iTotal) process.exit(1);
