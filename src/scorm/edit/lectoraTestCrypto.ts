// Lectora can publish a course's test definition (_tobj<n>.txt) AES-encrypted:
// CryptoJS passphrase mode ("Salted__" → base64 "U2FsdGVkX1…", OpenSSL-compatible).
// The player decrypts it in the learner's browser with a passphrase built by an
// obfuscated expression in trivantis-titlemgr.js:
//
//   TMPr.bDc = function(str) { var rur = hlf(str, <expression>); … }
//
// We read that expression from the course's own player (so no key lives in this
// codebase), evaluate it only if it's made of plain string/number operations, and
// use it to edit the test's question list and re-encrypt it the same way.

import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import type JSZip from 'jszip';

const BDC_RE = /\.bDc\s*=\s*function\s*\(\s*\w+\s*\)\s*\{\s*var\s+\w+\s*=\s*\w+\(\s*\w+\s*,\s*(.*?)\);\s*\r?\n/;

// Everything the known obfuscation uses. No globals beyond Array/String, no
// bracket access, so the expression can't reach anything but string building.
const SAFE_IDS = new Set([
  'function', 'return', 'var', 'arguments', 'Array', 'String', 'prototype', 'slice', 'call', 'shift',
  'reverse', 'map', 'join', 'split', 'fromCharCode', 'charCodeAt', 'toString', 'toLowerCase', 'toUpperCase',
]);

function isSafeExpression(expr: string): boolean {
  const code = expr.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, '""');
  if (/[^\w$\s'"()+\-*,.;={}]/.test(code)) return false;
  for (const id of code.match(/[A-Za-z_$][\w$]*/g) ?? []) {
    if (!SAFE_IDS.has(id) && !/^[A-Za-z]{1,2}$/.test(id)) return false;
  }
  return true;
}

/** The test passphrase, derived from the course's own player script (or null). */
export async function findTestPassphrase(zip: JSZip): Promise<string | null> {
  const scripts: string[] = [];
  zip.forEach((p, e) => {
    if (!e.dir && /titlemgr[^/]*\.js$/i.test(p)) scripts.push(p);
  });
  for (const p of scripts) {
    const m = BDC_RE.exec(await zip.file(p)!.async('string'));
    if (!m || !isSafeExpression(m[1])) continue;
    try {
      const key = new Function(`"use strict"; return (${m[1]});`)();
      if (typeof key === 'string' && key.length >= 8 && key.length <= 256) return key;
    } catch {
      /* not the shape we expect */
    }
  }
  return null;
}

/** Decrypt a test object; returns the XML, or null if the passphrase doesn't fit. */
export function decryptTest(cipher: string, passphrase: string): string | null {
  try {
    const xml = AES.decrypt(cipher.trim(), passphrase).toString(Utf8);
    return xml.includes('<lectoratest') ? xml : null;
  } catch {
    return null;
  }
}

export function encryptTest(xml: string, passphrase: string): string {
  return AES.encrypt(xml, passphrase).toString();
}
